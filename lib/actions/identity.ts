"use server";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import {
  guestThrottleKey,
  loginThrottle,
  teamThrottleKey,
} from "@/lib/auth/loginGate";
import { SECURE_COOKIE_ENV, shouldUseSecureCookie } from "@/lib/auth/cookieSecurity";
import { IDENTITY_COOKIE, sessionTtlSeconds } from "@/lib/auth/constants";
import { getCurrentPerson } from "@/lib/identity";
import {
  createAuthSession,
  createGuestAuthSession,
  deleteAuthSession,
  deleteAuthSessionsForPerson,
} from "@/lib/repositories/authSessions";
import { getGuestCredentials } from "@/lib/repositories/accounts";
import {
  findLoginCandidate,
  getPersonCredentials,
  updatePersonPassword,
} from "@/lib/repositories/people";

// Sayaç ve anahtar üretimi `lib/auth/loginGate.ts`te — şifre sıfırlayan action
// da aynı sayaca erişip kilidi kaldırabilsin diye (bu dosya "use server",
// buradan async olmayan bir değer export edilemiyor).
const LOGIN_FAILED = "Kullanıcı adı veya şifre hatalı.";

// Olmayan, pasif veya şifresiz hesaplarda da gerçek bir scrypt doğrulaması
// çalıştırılır. Böylece hesap varlığı yanıt süresinden ölçülemez.
const DUMMY_PASSWORD_HASH = hashPassword(randomBytes(32).toString("hex"));

export interface IdentityActionState {
  error?: string;
}

async function replaceSession(
  createToken: () => string,
  cookieMaxAgeSeconds?: number,
): Promise<void> {
  const store = await cookies();
  const previousToken = store.get(IDENTITY_COOKIE)?.value;
  if (previousToken) deleteAuthSession(previousToken);
  store.delete("inturlam_pid");

  // `secure` bayrağı isteğin gerçek şemasından türetiliyor — gerekçe ve
  // env ile elle kontrolü için bkz. lib/auth/cookieSecurity.ts.
  const requestHeaders = await headers();
  const secure = shouldUseSecureCookie(
    requestHeaders.get("x-forwarded-proto"),
    process.env[SECURE_COOKIE_ENV],
  );

  const token = createToken();
  store.set(IDENTITY_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure,
    // Max-Age verilmezse çerez tarayıcı oturumuyla sınırlı kalır (mevcut
    // davranış). "Beni hatırla" seçildiğinde sunucudaki oturum süresiyle
    // BİREBİR aynı değer yazılır.
    ...(cookieMaxAgeSeconds === undefined ? {} : { maxAge: cookieMaxAgeSeconds }),
  });
}

export async function loginPerson(
  _state: IdentityActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: LOGIN_FAILED };

  const credentials = findLoginCandidate(username);
  const throttleKey = teamThrottleKey(credentials?.id ?? username);
  if (loginThrottle.isBlocked(throttleKey)) {
    return { error: "Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar dene." };
  }

  const usable =
    credentials?.active === 1 && credentials.password_hash ? credentials : undefined;
  if (!verifyPassword(password, usable?.password_hash ?? DUMMY_PASSWORD_HASH) || !usable) {
    loginThrottle.recordFailure(throttleKey);
    return { error: LOGIN_FAILED };
  }

  loginThrottle.reset(throttleKey);
  // Varsayılan KAPALI: kutu işaretlenmediyse 12 saatlik tarayıcı-oturumu
  // davranışı aynen korunuyor. Guest oturumları bu patch'te değişmiyor.
  const remember = String(formData.get("remember") ?? "") === "1";
  const ttl = sessionTtlSeconds(remember);
  await replaceSession(() => createAuthSession(usable.id, ttl), remember ? ttl : undefined);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function loginGuest(
  _state: IdentityActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const throttleKey = guestThrottleKey(username);
  const credentials = getGuestCredentials(username);
  if (!credentials || credentials.active !== 1 || !credentials.password_hash) {
    return { error: "Kullanıcı adı veya şifre hatalı." };
  }
  if (loginThrottle.isBlocked(throttleKey)) {
    return { error: "Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar dene." };
  }
  if (!verifyPassword(password, credentials.password_hash)) {
    loginThrottle.recordFailure(throttleKey);
    return { error: "Kullanıcı adı veya şifre hatalı." };
  }

  loginThrottle.reset(throttleKey);
  await replaceSession(() => createGuestAuthSession(credentials.id));
  revalidatePath("/", "layout");
  redirect("/guest");
}

export async function changePassword(
  _state: IdentityActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  const person = await getCurrentPerson();
  if (!person) return { error: "Şifre değiştirmek için giriş yapmalısın." };

  const credentials = getPersonCredentials(person.id);
  if (!credentials?.password_hash) return { error: "Hesabın mevcut şifresi bulunamadı." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (!verifyPassword(currentPassword, credentials.password_hash)) {
    return { error: "Mevcut şifre hatalı." };
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) return { error: passwordError };
  if (newPassword !== confirmPassword) return { error: "Yeni şifreler eşleşmiyor." };
  if (verifyPassword(newPassword, credentials.password_hash)) {
    return { error: "Yeni şifre mevcut şifreden farklı olmalı." };
  }

  updatePersonPassword(person.id, hashPassword(newPassword));
  deleteAuthSessionsForPerson(person.id);
  const store = await cookies();
  store.delete(IDENTITY_COOKIE);
  revalidatePath("/", "layout");
  redirect("/whoami/team?changed=1");
}

export async function clearIdentity() {
  const store = await cookies();
  const token = store.get(IDENTITY_COOKIE)?.value;
  if (token) deleteAuthSession(token);
  store.delete(IDENTITY_COOKIE);
  store.delete("inturlam_pid");
  revalidatePath("/", "layout");
  redirect("/whoami");
}
