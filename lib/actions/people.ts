"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { assertCanManageRoles, ROLE_ADMIN_PERSON_ID } from "@/lib/auth/authorization";
import { normalizeDepartment } from "@/lib/departments";
import { requireSession } from "@/lib/identity";
import {
  createPerson,
  getPerson,
  setPersonActive,
  setPersonManager,
  updatePersonPassword,
  updatePersonProfile,
} from "@/lib/repositories/people";
import { deleteAuthSessionsForPerson } from "@/lib/repositories/authSessions";
import { deleteAuthSessionsForAccount } from "@/lib/repositories/authSessions";
import { setGuestAccountActive, upsertGuestAccount } from "@/lib/repositories/accounts";
import { replacePersonBrandAssignments } from "@/lib/repositories/brandAssignments";
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
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);
  if (password !== confirmPassword) throw new Error("Şifreler eşleşmiyor.");

  createPerson(
    name,
    normalizeDepartment(formData.get("department")),
    hashPassword(password),
  );
  revalidatePath("/", "layout");
  revalidatePath("/team/manage");
}

export async function deactivatePersonAction(personId: string) {
  const actor = await requireSession();
  assertAccountManager(actor);
  setPersonActive(personId, false);
  revalidatePath("/", "layout");
  revalidatePath("/team/manage");
}

export async function reactivatePersonAction(personId: string) {
  const actor = await requireSession();
  assertAccountManager(actor);
  setPersonActive(personId, true);
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
  revalidatePath("/", "layout");
  revalidatePath("/team/manage");
  revalidatePath("/whoami");
}

export async function savePersonBrandAssignmentsAction(formData: FormData) {
  const actor = await requireSession();
  assertAccountManager(actor);
  const personId = String(formData.get("personId") ?? "").trim();
  if (!getPerson(personId)) throw new Error("Kişi bulunamadı.");
  const brandIds = formData.getAll("brandId").map(String);
  replacePersonBrandAssignments(personId, brandIds, actor.id);
  revalidatePath("/panom");
  revalidatePath("/team/manage");
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
