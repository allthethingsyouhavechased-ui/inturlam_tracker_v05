"use server";

import { revalidatePath } from "next/cache";
import { ExpectedActionError, runAction, type ActionResult } from "@/lib/actionResult";
import { redirect } from "next/navigation";
import { clearLoginBlockForGuest, clearLoginBlockForPerson } from "@/lib/auth/loginGate";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import {
  assertCanDeactivatePerson,
  assertCanManageRoles,
  ROLE_ADMIN_PERSON_ID,
} from "@/lib/auth/authorization";
import { normalizeDepartment } from "@/lib/departments";
import { requireSession } from "@/lib/identity";
import {
  createPerson,
  getPerson,
  isUsernameTaken,
  setPersonActive,
  setPersonManager,
  updatePersonPassword,
  updatePersonProfile,
  updatePersonUsername,
} from "@/lib/repositories/people";
import { normalizeUsername, USERNAME_RULE } from "@/lib/username";
import { deleteAuthSessionsForPerson } from "@/lib/repositories/authSessions";
import { deleteAuthSessionsForAccount } from "@/lib/repositories/authSessions";
import { setGuestAccountActive, upsertGuestAccount } from "@/lib/repositories/accounts";
import { getBrand } from "@/lib/repositories/brands";
import { setRequestReviewer } from "@/lib/repositories/requestReviewers";
import {
  replaceBrandPersonAssignments,
  setPersonBrandAssignment,
} from "@/lib/repositories/brandAssignments";
import { deleteUploadedFile, validateImageFiles, withSavedImageFiles } from "@/lib/uploads";
import type { Person } from "@/lib/types";

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function assertAccountManager(actor: Person) {
  if (actor.is_manager !== 1) {
    throw new Error("Ekip hesaplarını yalnızca yöneticiler değiştirebilir.");
  }
}

export async function createPersonAction(formData: FormData) {
  const actor = await requireSession();
  assertAccountManager(actor);
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (!name) throw new Error("İsim zorunlu.");
  if (name.length > 80) throw new Error("İsim en fazla 80 karakter olabilir.");

  const username = normalizeUsername(String(formData.get("username") ?? ""));
  if (!username) throw new Error(USERNAME_RULE);
  if (isUsernameTaken(username)) throw new Error("Bu kullanıcı adı zaten kullanılıyor.");

  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);
  if (password !== confirmPassword) throw new Error("Şifreler eşleşmiyor.");

  createPerson(
    username,
    name,
    normalizeDepartment(formData.get("department")),
    hashPassword(password),
  );
  revalidatePath("/", "layout");
  revalidatePath("/team/manage");
}

/**
 * Kullanıcı adını değiştirir. Yetki profil düzenlemeyle AYNI kuralda: kişinin
 * kendisi ya da bir yönetici. Oturumlar token tabanlı olduğu için ad değişimi
 * açık oturumları düşürmez — kişi bir sonraki girişte yeni adı kullanır.
 */
export async function updatePersonUsernameAction(formData: FormData) {
  const actor = await requireSession();
  const personId = String(formData.get("personId") ?? "").trim();
  if (!personId) throw new Error("Kişi bulunamadı.");
  if (actor.id !== personId && actor.is_manager !== 1) {
    throw new Error("Kullanıcı adını yalnızca kendisi ya da bir yönetici değiştirebilir.");
  }

  const person = getPerson(personId);
  if (!person) throw new Error("Kişi bulunamadı.");

  const username = normalizeUsername(String(formData.get("username") ?? ""));
  if (!username) throw new Error(USERNAME_RULE);
  if (isUsernameTaken(username, person.id)) {
    throw new Error("Bu kullanıcı adı zaten kullanılıyor.");
  }

  updatePersonUsername(person.id, username);
  revalidatePath("/", "layout");
  revalidatePath("/team/manage");
  revalidatePath(`/team/${person.id}`);
  revalidatePath("/settings/profile");
}

export async function deactivatePersonAction(personId: string) {
  const actor = await requireSession();
  assertAccountManager(actor);
  const person = getPerson(personId);
  if (!person) throw new Error("Kişi bulunamadı.");
  assertCanDeactivatePerson(person.id);
  if (person.active !== 1) return;
  setPersonActive(person.id, false);
  deleteAuthSessionsForPerson(person.id);
  revalidatePath("/", "layout");
  revalidatePath("/team/manage");
}

export async function reactivatePersonAction(personId: string) {
  const actor = await requireSession();
  assertAccountManager(actor);
  const person = getPerson(personId);
  if (!person) throw new Error("Kişi bulunamadı.");
  if (person.active === 1) return;
  setPersonActive(person.id, true);
  revalidatePath("/", "layout");
  revalidatePath("/team/manage");
}

export async function setManagerRoleAction(personId: string, isManager: boolean) {
  const actor = await requireSession();
  assertCanManageRoles(actor);

  const person = getPerson(personId);
  if (!person) throw new Error("Kişi bulunamadı.");
  if (person.id === ROLE_ADMIN_PERSON_ID && !isManager) {
    throw new Error("Yunus Emre'nin yönetici yetkisi kaldırılamaz.");
  }

  setPersonManager(person.id, isManager);
  revalidatePath("/", "layout");
  revalidatePath("/team");
  revalidatePath("/team/manage");
  revalidatePath(`/team/${person.id}`);
}

export async function resetPersonPasswordAction(formData: FormData) {
  const actor = await requireSession();
  assertAccountManager(actor);

  const personId = String(formData.get("personId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const person = getPerson(personId);
  if (!person || person.active !== 1) throw new Error("Aktif hesap bulunamadı.");
  if (person.is_manager === 1 && actor.id !== ROLE_ADMIN_PERSON_ID) {
    throw new Error("Yönetici hesaplarının şifresini yalnızca sistem yöneticisi yenileyebilir.");
  }

  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);
  if (password !== confirmPassword) throw new Error("Şifreler eşleşmiyor.");

  updatePersonPassword(person.id, hashPassword(password));
  deleteAuthSessionsForPerson(person.id);
  // Kilidi de kaldır: şifre değiştiği anda "bilinmeyen şifreyi deneme" koruması
  // anlamını yitiriyor. Bu satır olmadan kişi elinde DOĞRU şifreyle 15 dakika
  // daha giremiyor ve ekranda "çok fazla hatalı deneme" yazıyordu.
  clearLoginBlockForPerson(person.id, person.username);
  revalidatePath("/", "layout");
  revalidatePath("/team/manage");
  revalidatePath("/whoami");
}

export async function saveBrandPersonAssignmentsAction(formData: FormData) {
  const actor = await requireSession();
  assertAccountManager(actor);
  const brandId = String(formData.get("brandId") ?? "").trim();
  if (!getBrand(brandId)) throw new Error("Marka bulunamadı.");
  const personIds = formData.getAll("personId").map(String);
  replaceBrandPersonAssignments(brandId, personIds, actor.id);
  revalidatePath("/");
  revalidatePath("/panom");
  revalidatePath("/panom/markalar");
  revalidatePath("/team/manage");
  revalidatePath(`/brands/${brandId}`);
}

/**
 * Ekip kartından TEK bir kişi–marka ilişkisi ekler/kaldırır. Marka bazlı toplu
 * kaydetme (`saveBrandPersonAssignmentsAction`) buradan çağrılmaz: o, markanın
 * bütün sorumlu listesini değiştirdiği için başkalarının ilişkisini silerdi.
 * Eski görevlerin sorumlusuna da dokunulmaz — bu kalıcı atama, görev ataması değil.
 */
export async function setPersonBrandAssignmentAction(
  personId: string,
  brandId: string,
  assigned: boolean,
): Promise<ActionResult> {
  const actor = await requireSession();
  return runAction("people.setBrandAssignment", async () => {
    assertAccountManager(actor);
    if (!personId.trim() || !brandId.trim()) {
      throw new ExpectedActionError("Kişi ve marka seçilmeli.");
    }
    if (!getBrand(brandId)) throw new ExpectedActionError("Marka bulunamadı.", "notFound");
    const changed = setPersonBrandAssignment(personId, brandId, assigned, actor.id);
    if (!changed && assigned) {
      throw new ExpectedActionError("İlişki yazılamadı: kişi pasif ya da marka arşivlenmiş olabilir.");
    }
    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

/**
 * Talep değerlendirme yetkisini verir/kaldırır. Yetkiyi yalnızca yöneticiler
 * dağıtabilir; yöneticilerin kendisi bu tabloda olmadan da değerlendirebilir
 * (bkz. lib/requestAccess.ts), bu yüzden onlara yazmaya gerek yok.
 */
export async function setRequestReviewerAction(
  personId: string,
  granted: boolean,
): Promise<ActionResult> {
  const actor = await requireSession();
  return runAction("people.setRequestReviewer", async () => {
    assertAccountManager(actor);
    const person = getPerson(personId);
    if (!person) throw new ExpectedActionError("Kişi bulunamadı.", "notFound");
    if (granted && person.active !== 1) {
      throw new ExpectedActionError("Pasif hesaba yetki verilemez.");
    }
    setRequestReviewer(personId, granted, actor.id);
    revalidatePath("/", "layout");
    revalidatePath("/team/manage");
    return { ok: true as const };
  });
}

export async function saveGuestAccountAction(formData: FormData) {
  const actor = await requireSession();
  assertAccountManager(actor);
  const brandId = String(formData.get("brandId") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (!brandId) throw new Error("Marka zorunlu.");
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
    throw new Error("Kullanıcı adı 3-40 karakter olmalı; yalnızca harf, rakam, nokta, tire ve alt çizgi kullanılabilir.");
  }
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);
  if (password !== confirmPassword) throw new Error("Şifreler eşleşmiyor.");
  const accountId = upsertGuestAccount({ brandId, username, passwordHash: hashPassword(password) });
  deleteAuthSessionsForAccount(accountId);
  // Ekip tarafındaki ile aynı gerekçe: yeni şifre verildiği anda giriş kilidi
  // anlamsızlaşıyor, marka 15 dakika kapıda beklemesin.
  clearLoginBlockForGuest(username);
  revalidatePath("/team/manage");
  revalidatePath("/whoami/guest");
}

export async function setGuestAccountActiveAction(accountId: string, active: boolean) {
  const actor = await requireSession();
  assertAccountManager(actor);
  setGuestAccountActive(accountId, active);
  if (!active) deleteAuthSessionsForAccount(accountId);
  revalidatePath("/team/manage");
}

export async function updatePersonProfileAction(formData: FormData) {
  const actor = await requireSession();
  const id = String(formData.get("personId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const title = optionalText(formData.get("title"));
  const bio = optionalText(formData.get("bio"));
  const department = normalizeDepartment(formData.get("department"));

  if (!id) throw new Error("Kişi bulunamadı.");
  if (!name) throw new Error("İsim zorunlu.");
  if (name.length > 80) throw new Error("İsim en fazla 80 karakter olabilir.");
  if ((title?.length ?? 0) > 120) throw new Error("Unvan en fazla 120 karakter olabilir.");
  if ((bio?.length ?? 0) > 1000) throw new Error("Tanıtım en fazla 1000 karakter olabilir.");

  // Yetki açığı (2026-08-11 tasarım revizyonunda bulundu): bu action önceden
  // HİÇBİR sahiplik kontrolü yapmıyordu — "sen kimsin" çerezi kolayca
  // taklit edilebildiği için, isteği yapanın gerçekten bu kişi ya da bir
  // yönetici olduğunu SUNUCUDA yeniden doğrula. Arayüz de aynı kuralla formu
  // zaten göstermiyor (bkz. app/settings/profile/page.tsx) — ama arayüz kontrolü
  // tek başına yeterli değil, bu action doğrudan da çağrılabilir.
  if (actor.id !== id && actor.is_manager !== 1) {
    throw new Error("Bu profili yalnızca kendisi ya da bir yönetici düzenleyebilir.");
  }

  const person = getPerson(id);
  if (!person) throw new Error("Kişi bulunamadı.");

  const avatarEntry = formData.get("avatar");
  const avatar = avatarEntry instanceof File && avatarEntry.size > 0 ? avatarEntry : null;
  if (avatar) validateImageFiles([avatar]);
  const saveProfile = (avatarPath: string | null) => updatePersonProfile({
    id,
    name,
    title,
    bio,
    department,
    avatarPath,
  });
  if (avatar) {
    const savedAvatar = await withSavedImageFiles([avatar], "people", (saved) => {
      saveProfile(saved[0].filePath);
      return saved[0];
    });
    if (person.avatar_path && person.avatar_path !== savedAvatar.filePath) {
      await deleteUploadedFile(person.avatar_path);
    }
  } else {
    saveProfile(person.avatar_path);
  }
  revalidatePath("/", "layout");
  revalidatePath(`/team/${id}`);
  revalidatePath("/settings/profile");
  redirect(`/settings/profile?person=${encodeURIComponent(id)}&saved=1`);
}
