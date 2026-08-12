"use client";

import { useState } from "react";

function asDate(value: string): string {
  return value.slice(0, 10);
}

function asDateTime(value: string, fallbackTime: string): string {
  if (!value) return "";
  return value.includes("T") ? value.slice(0, 16) : `${value}T${fallbackTime}`;
}

const inputClass =
  "min-h-10 min-w-0 w-full rounded-lg border border-border-default bg-background px-3 text-sm outline-none focus:border-brand-500";

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
  const [guestVisible, setGuestVisible] = useState(
    initialGuestVisible && Boolean(initialBrandId),
  );
  const [allDay, setAllDay] = useState(initialAllDay);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);

  function changeAllDay(next: boolean) {
    setAllDay(next);
    setStart((value) => (next ? asDate(value) : asDateTime(value, "09:00")));
    setEnd((value) => (next ? asDate(value) : asDateTime(value, "10:00")));
  }

  return (
    <>
      <label className="grid min-w-0 gap-1.5 text-xs font-medium text-secondary">
        Marka
        <select
          name="brandId"
          value={brandId}
          onChange={(event) => {
            const next = event.target.value;
            setBrandId(next);
            if (!next) setGuestVisible(false);
          }}
          className={inputClass}
        >
          <option value="">Ajans geneli</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset
        data-calendar-section="timing"
        className="col-span-full min-w-0 border-t border-border-subtle pt-3"
      >
        <legend className="sr-only">Zamanlama</legend>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border-default bg-background px-3 text-xs font-medium text-secondary">
            <input
              type="checkbox"
              name="allDay"
              value="1"
              checked={allDay}
              onChange={(event) => changeAllDay(event.target.checked)}
            />
            Tüm gün
          </label>
          <label
            className={`flex min-h-10 items-center gap-2 rounded-lg border border-border-default bg-background px-3 text-xs font-medium ${
              brandId ? "cursor-pointer text-secondary" : "cursor-not-allowed text-muted opacity-60"
            }`}
          >
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

        <div
          data-calendar-datetime-layout="stacked"
          className="mt-3 grid min-w-0 grid-cols-1 gap-3"
        >
          <label className="grid min-w-0 gap-1.5 text-xs font-medium text-secondary">
            Başlangıç
            <input
              name="startAt"
              required
              type={allDay ? "date" : "datetime-local"}
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs font-medium text-secondary">
            Bitiş
            <input
              name="endAt"
              required
              type={allDay ? "date" : "datetime-local"}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </fieldset>
    </>
  );
}
