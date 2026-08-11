"use client";

import { usePathname } from "next/navigation";
import { routeContextForPathname } from "@/lib/nav";

export default function HeaderRouteContext() {
  const pathname = usePathname();
  const context = routeContextForPathname(pathname);

  return (
    <div className="min-w-0 leading-tight">
      <p className="hidden text-[10px] font-semibold tracking-[0.08em] text-muted sm:block">
        {context.section}
      </p>
      <p className="truncate text-[13px] font-semibold text-foreground">{context.label}</p>
    </div>
  );
}
