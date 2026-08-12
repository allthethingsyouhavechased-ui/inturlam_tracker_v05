"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import { LoginThrottle } from "@/lib/auth/loginThrottle";
import { IDENTITY_COOKIE } from "@/lib/auth/constants";
import { getCurrentPerson } from "@/lib/identity";
import {
  createAuthSession,
  createGuestAuthSession,
  deleteAuthSession,
  deleteAuthSessionsForPerson,
} from "@/lib/repositories/authSessions";
import { getGuestCredentials } from "@/lib/repositories/accounts";
import {
  getPersonCredentials,
  updatePersonPassword,
} from "@/lib/repositories/people";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const loginThrottle = new LoginThrottle(MAX_LOGIN_FAILURES, LOGIN_WINDOW_MS);

export interface IdentityActionState {
  error?: string;
}

async function replaceSession(createToken: () => string): Promise<void> {
  const store = await cookies();
  const previousToken = store.get(IDENTITY_COOKIE)?.value;
  if (previousToken) deleteAuthSession(previousToken);
  store.delete("inturlam_pid");

  const token = createToken();
  store.set(IDENTITY_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
  });
}

export async function loginPerson(
  _state: IdentityActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  const personId = String(formData.get("personId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const credentials = getPersonCredentials(personId);
  if (!credentials || credentials.active !== 1) return { error: "Hesap bulunamadı." };
  if (loginThrottle.isBlocked(personId)) {
    return { error: "Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar dene." };
  }

  if (!credentials.password_hash) {
    return { error: "Bu hesabın şifresi henüz etkin değil. Bir yöneticiden şifre belirlemesini iste." };
  } else if (!verifyPassword(password, credentials.password_hash)) {
    loginThrottle.recordFailure(personId);
    return { error: "Şifre hatalı." };
  }

  loginThrottle.reset(personId);
  await replaceSession(() => createAuthSession(personId));
  revalidatePath("/", "layout");
  redirect("/");
}

export async function loginGuest(
  _state: IdentityActionState,
  formData: FormData,
): Promise<IdentityActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const throttleKey = `guest:${username.toLocaleLowerCase("tr-TR")}`;
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
