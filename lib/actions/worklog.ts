"use server";

import { revalidatePath } from "next/cache";
import { ExpectedActionError, runAction, type ActionResult } from "@/lib/actionResult";
import { requireManager, requireSession } from "@/lib/identity";
import {
  decideWorkCorrection,
  endBreak,
  endWorkSession,
  requestWorkCorrection,
  startBreak,
  startWorkSession,
} from "@/lib/repositories/worklog";

function expected<T>(run: () => T, fallback: string): T {
  try { return run(); }
  catch (error) { throw new ExpectedActionError(error instanceof Error ? error.message : fallback); }
}

/** Mesai zamanı SUNUCUDAN alınır; istemcinin saatine güvenilmez. */
export async function startWorkAction(): Promise<ActionResult> {
  const actor = await requireSession();
  return runAction("worklog.start", async () => {
    expected(() => startWorkSession(actor.id), "Mesai başlatılamadı.");
    revalidatePath("/mesai");
    return { ok: true as const, message: "Mesai başladı." };
  });
}

export async function startBreakAction(): Promise<ActionResult> {
  const actor = await requireSession();
  return runAction("worklog.startBreak", async () => {
    expected(() => startBreak(actor.id), "Mola başlatılamadı.");
    revalidatePath("/mesai");
    return { ok: true as const, message: "Mola başladı." };
  });
}

export async function endBreakAction(): Promise<ActionResult> {
  const actor = await requireSession();
  return runAction("worklog.endBreak", async () => {
    expected(() => endBreak(actor.id), "Mola bitirilemedi.");
    revalidatePath("/mesai");
    return { ok: true as const, message: "Molan bitti." };
  });
}

/** Moladayken günü bitirmek açık molayı da kapatır (repository'de). */
export async function endWorkAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireSession();
  return runAction("worklog.end", async () => {
    const note = String(formData.get("note") ?? "").trim() || null;
    if (note && note.length > 500) throw new ExpectedActionError("Not en fazla 500 karakter olabilir.");
    expected(() => endWorkSession(actor.id, note), "Gün bitirilemedi.");
    revalidatePath("/mesai");
    return { ok: true as const, message: "Gün kapatıldı." };
  });
}

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * Gerekçeli düzeltme isteği. Saat OTOMATİK uydurulmaz: kullanıcı önerir,
 * yönetici onaylar, eski ve yeni değerler birlikte korunur.
 */
export async function requestWorkCorrectionAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireSession();
  return runAction("worklog.requestCorrection", async () => {
    const sessionId = String(formData.get("sessionId") ?? "").trim();
    if (!sessionId) throw new ExpectedActionError("Mesai kaydı bulunamadı.", "notFound");
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) throw new ExpectedActionError("Gerekçe zorunlu.");
    // `datetime-local` yerel saat verir; kullanıcı İstanbul saatiyle yazıyor.
    const toUtc = (value: string): string | null => {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (!STAMP.test(trimmed)) throw new ExpectedActionError("Saat biçimi geçersiz.");
      return new Date(`${trimmed}:00+03:00`).toISOString().replace(/\.\d{3}Z$/, "Z");
    };
    const proposedStartedAt = toUtc(String(formData.get("startedAt") ?? ""));
    const proposedEndedAt = toUtc(String(formData.get("endedAt") ?? ""));
    expected(
      () => requestWorkCorrection({
        sessionId,
        personId: actor.id,
        reason,
        proposedStartedAt,
        proposedEndedAt,
      }),
      "Düzeltme isteği kaydedilemedi.",
    );
    revalidatePath("/mesai");
    return { ok: true as const, message: "Düzeltme isteği yöneticiye iletildi." };
  });
}

export async function decideWorkCorrectionAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireManager();
  return runAction("worklog.decideCorrection", async () => {
    const correctionId = String(formData.get("correctionId") ?? "").trim();
    if (!correctionId) throw new ExpectedActionError("İstek bulunamadı.", "notFound");
    const approve = String(formData.get("decision") ?? "") === "approve";
    const note = String(formData.get("note") ?? "").trim() || null;
    expected(
      () => decideWorkCorrection({
        correctionId,
        approve,
        decidedBy: actor.person.id,
        note,
      }),
      "Karar kaydedilemedi.",
    );
    revalidatePath("/mesai");
    return { ok: true as const, message: approve ? "Düzeltme onaylandı." : "Düzeltme reddedildi." };
  });
}
