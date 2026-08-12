"use client";

import { useState } from "react";

function asDate(value: string): string { return value.slice(0, 10); }
function asDateTime(value: string, fallbackTime: string): string {
  if (!value) return "";
  return value.includes("T") ? value.slice(0, 16) : `${value}T${fallbackTime}`;
}

export default function CalendarDateTimeFields({
  brands,
  initialBrandId,
  initialGuestVisible,
  initialAllDay,
  initialStart,
  initialEnd,
}: {
  brands: Array<{ id: string; name: string }>;
  initialBrandId: string;
  initialGuestVisible: boolean;
  initialAllDay: boolean;
  initialStart: string;
  initialEnd: string;
}) {
  const [brandId, setBrandId] = useState(initialBrandId);
  const [guestVisible, setGuestVisible] = useState(initialGuestVisible && Boolean(initialBrandId));
  const [allDay, setAllDay] = useState(initialAllDay);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  return <>
    <label className="grid min-w-0 gap-1 text-xs text-secondary">
      Marka
      <select
        name="brandId"
        value={brandId}
        onChange={(event) => {
          const next = event.target.value;
          setBrandId(next);
          if (!next) setGuestVisible(false);
        }}
        className="min-h-10 min-w-0 w-full rounded-lg border border-border-default bg-background px-2 text-sm"
      >
        <option value="">Ajans geneli</option>
        {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
      </select>
    </label>
    <div className="col-span-full flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
      <label className="inline-flex items-center gap-2 text-xs font-medium text-secondary">
        <input type="checkbox" name="allDay" value="1" checked={allDay} onChange={(event) => { const next = event.target.checked; setAllDay(next); setStart((value) => next ? asDate(value) : asDateTime(value, "09:00")); setEnd((value) => next ? asDate(value) : asDateTime(value, "10:00")); }} />
        Tüm gün
      </label>
      <label className={`inline-flex items-center gap-2 text-xs font-medium ${brandId ? "text-secondary" : "text-muted"}`}>
        <input
          type="checkbox"
          name="guestVisible"
          value="1"
          checked={guestVisible}
          disabled={!brandId}
          onChange={(event) => setGuestVisible(event.target.checked)}
        />
        Guest ile paylaş
      </label>
    </div>
    <label className="grid gap-1 text-xs text-secondary">Başlangıç<input name="startAt" required type={allDay ? "date" : "datetime-local"} value={start} onChange={(event) => setStart(event.target.value)} className="min-h-10 rounded-lg border border-border-default bg-background px-2 text-sm" /></label>
    <label className="grid gap-1 text-xs text-secondary">Bitiş<input name="endAt" required type={allDay ? "date" : "datetime-local"} value={end} onChange={(event) => setEnd(event.target.value)} className="min-h-10 rounded-lg border border-border-default bg-background px-2 text-sm" /></label>
  </>;
}
