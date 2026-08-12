"use client";

import { useState } from "react";

function asDate(value: string): string { return value.slice(0, 10); }
function asDateTime(value: string, fallbackTime: string): string {
  if (!value) return "";
  return value.includes("T") ? value.slice(0, 16) : `${value}T${fallbackTime}`;
}

export default function CalendarDateTimeFields({ initialAllDay, initialStart, initialEnd }: { initialAllDay: boolean; initialStart: string; initialEnd: string }) {
  const [allDay, setAllDay] = useState(initialAllDay);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  return <>
    <label className="inline-flex items-center gap-2 text-xs text-secondary"><input type="checkbox" name="allDay" value="1" checked={allDay} onChange={(event) => { const next = event.target.checked; setAllDay(next); setStart((value) => next ? asDate(value) : asDateTime(value, "09:00")); setEnd((value) => next ? asDate(value) : asDateTime(value, "10:00")); }} />Tüm gün</label>
    <label className="grid gap-1 text-xs text-secondary">Başlangıç<input name="startAt" required type={allDay ? "date" : "datetime-local"} value={start} onChange={(event) => setStart(event.target.value)} className="min-h-10 rounded-lg border border-border-default bg-background px-2 text-sm" /></label>
    <label className="grid gap-1 text-xs text-secondary">Bitiş<input name="endAt" required type={allDay ? "date" : "datetime-local"} value={end} onChange={(event) => setEnd(event.target.value)} className="min-h-10 rounded-lg border border-border-default bg-background px-2 text-sm" /></label>
  </>;
}
