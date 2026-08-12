import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { IDENTITY_COOKIE } from "@/lib/auth/constants";
import { getPersonForSession } from "@/lib/repositories/authSessions";
import type { Person } from "@/lib/types";

export { IDENTITY_COOKIE } from "@/lib/auth/constants";

export const getCurrentPerson = cache(async (): Promise<Person | null> => {
  const store = await cookies();
  const token = store.get(IDENTITY_COOKIE)?.value;
  if (!token) return null;
  return getPersonForSession(token) ?? null;
});

export async function requireSession(): Promise<Person> {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Bu işlem için giriş yapmalısınız.");
  return person;
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
