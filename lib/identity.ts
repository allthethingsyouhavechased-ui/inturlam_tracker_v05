import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { IDENTITY_COOKIE } from "@/lib/auth/constants";
import { getActorForSession } from "@/lib/repositories/authSessions";
import type { Actor, GuestActor, Person, TeamActor } from "@/lib/types";

export { IDENTITY_COOKIE } from "@/lib/auth/constants";

export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const store = await cookies();
  const token = store.get(IDENTITY_COOKIE)?.value;
  if (!token) return null;
  return getActorForSession(token) ?? null;
});

export const getCurrentPerson = cache(async (): Promise<Person | null> => {
  const actor = await getCurrentActor();
  return actor?.kind === "team" ? actor.person : null;
});

export async function requireSession(): Promise<Person> {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Bu işlem için giriş yapmalısınız.");
  return person;
}

export async function requireTeamSession(): Promise<TeamActor> {
  const actor = await getCurrentActor();
  if (!actor || actor.kind !== "team") {
    throw new Error("Bu işlem için ekip hesabıyla giriş yapmalısınız.");
  }
  return actor;
}

export async function requireManager(): Promise<TeamActor> {
  const actor = await requireTeamSession();
  if (actor.person.is_manager !== 1) throw new Error("Bu işlem için yönetici yetkisi gerekli.");
  return actor;
}

export async function requireGuestSession(): Promise<GuestActor> {
  const actor = await getCurrentActor();
  if (!actor || actor.kind !== "guest") {
    throw new Error("Bu işlem için guest hesabıyla giriş yapmalısınız.");
  }
  return actor;
}

export async function requireGuestBrand(brandId: string): Promise<GuestActor> {
  const actor = await requireGuestSession();
  if (actor.brand.id !== brandId) throw new Error("Bu markaya erişim yetkiniz yok.");
  return actor;
}

export async function requirePageSession(): Promise<Person> {
  const person = await getCurrentPerson();
  if (!person) redirect("/whoami");
  return person;
}

export async function requireReportAccess(): Promise<Person> {
  const person = await getCurrentPerson();
  if (!person) redirect("/whoami");
  if (person.is_manager !== 1) notFound();
  return person;
}
