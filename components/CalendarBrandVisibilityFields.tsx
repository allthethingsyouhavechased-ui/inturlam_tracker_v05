"use client";

import { useState } from "react";

export default function CalendarBrandVisibilityFields({
  brands,
  initialBrandId,
  initialGuestVisible,
}: {
  brands: Array<{ id: string; name: string }>;
  initialBrandId: string;
  initialGuestVisible: boolean;
}) {
  const [brandId, setBrandId] = useState(initialBrandId);
  const [guestVisible, setGuestVisible] = useState(initialGuestVisible && Boolean(initialBrandId));

  return (
    <div className="min-w-0 space-y-2">
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
  );
}
