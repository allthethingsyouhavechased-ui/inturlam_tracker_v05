import type { SVGAttributes } from "react";
import type { IconName } from "@/lib/icons";
import { cn } from "@/lib/cn";

function IconGlyph({ name }: { name: IconName }) {
  switch (name) {
    case "home":
      return <><path d="M3.5 9.2 10 3.8l6.5 5.4"/><path d="M5.4 8.1v8h9.2v-8M8.4 16.1v-4.5h3.2v4.5"/></>;
    case "board":
      return <><rect x="3.2" y="3.2" width="5.2" height="13.6" rx="1.2"/><rect x="11.6" y="3.2" width="5.2" height="8.2" rx="1.2"/></>;
    case "ideas":
      return <><path d="M6.3 12.8c-1.2-1-2-2.5-2-4.2a5.7 5.7 0 0 1 11.4 0c0 1.7-.8 3.2-2 4.2-.7.6-1 1.2-1 2H7.3c0-.8-.3-1.4-1-2Z"/><path d="M7.6 17h4.8M8 8.7l1.4 1.4 2.9-3"/></>;
    case "tasks":
      return <><path d="m3.5 5.4 1.3 1.3 2-2.3M9 5.6h7.5M3.5 10l1.3 1.3 2-2.3M9 10.2h7.5M3.5 14.6l1.3 1.3 2-2.3M9 14.8h7.5"/></>;
    case "inbox":
      return <><path d="M3.5 4h13l1.2 9.5a2 2 0 0 1-2 2.3H4.3a2 2 0 0 1-2-2.3L3.5 4Z"/><path d="M2.8 11.5h4l1.2 2h4l1.2-2h4"/></>;
    case "calendar":
      return <><rect x="2.8" y="4.2" width="14.4" height="13" rx="2"/><path d="M6.2 2.8v2.8M13.8 2.8v2.8M2.8 8h14.4M6 11h.01M10 11h.01M14 11h.01M6 14.5h.01M10 14.5h.01"/></>;
    case "brands":
      return <><path d="m10 2.8 6.5 3.6v7.2L10 17.2l-6.5-3.6V6.4L10 2.8Z"/><path d="m3.8 6.6 6.2 3.5 6.2-3.5M10 10.1v7"/></>;
    case "social":
      return <><circle cx="5" cy="10" r="2.2"/><circle cx="14.8" cy="5" r="2.2"/><circle cx="14.8" cy="15" r="2.2"/><path d="m6.9 8.9 6-3M6.9 11.1l6 3"/></>;
    case "team":
      return <><circle cx="7.2" cy="7" r="2.5"/><circle cx="14.2" cy="8.2" r="2"/><path d="M2.8 16.5c.4-3 2-4.6 4.5-4.6s4.1 1.6 4.5 4.6M12 12.4c.7-.5 1.5-.7 2.4-.7 2.2 0 3.4 1.5 3.7 4.1"/></>;
    case "reports":
      return <><path d="M4 17V9.5h3V17M8.5 17V5h3v12M13 17v-9h3v9M2.8 17.2h14.4"/></>;
    case "templates":
      return <><path d="M4 3.2h8.2l3.8 3.9v9.7H4V3.2Z"/><path d="M12 3.5v4h3.7M7 11h6M7 14h4"/></>;
    case "activity":
      return <path d="M2.5 10h3l2-5.3 3.5 10.6 2.1-5.3h4.4"/>;
    case "settings":
      return <><circle cx="10" cy="10" r="2.6"/><path d="M16 11.2v-2.4l-1.8-.5a6 6 0 0 0-.6-1.4l.9-1.6-1.8-1.8-1.6.9a6 6 0 0 0-1.4-.6L9.2 2H6.8l-.5 1.8a6 6 0 0 0-1.4.6l-1.6-.9-1.8 1.8.9 1.6a6 6 0 0 0-.6 1.4L0 8.8v2.4l1.8.5a6 6 0 0 0 .6 1.4l-.9 1.6 1.8 1.8 1.6-.9a6 6 0 0 0 1.4.6l.5 1.8h2.4l.5-1.8a6 6 0 0 0 1.4-.6l1.6.9 1.8-1.8-.9-1.6a6 6 0 0 0 .6-1.4l1.8-.5Z" transform="translate(2) scale(.8)"/></>;
    case "search":
      return <><circle cx="8.8" cy="8.8" r="5.4"/><path d="m12.8 12.8 4 4"/></>;
    case "plus":
      return <path d="M10 3.5v13M3.5 10h13"/>;
    case "bell":
      return <><path d="M15.5 8a5.5 5.5 0 0 0-11 0c0 5.8-2.2 7.3-2.2 7.3h15.4S15.5 13.8 15.5 8Z"/><path d="M12 17a2.2 2.2 0 0 1-4 0"/></>;
    case "sun":
      return <><circle cx="10" cy="10" r="3.2"/><path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"/></>;
    case "moon":
      return <path d="M16.8 12.8A7 7 0 0 1 7.2 3.2 7.3 7.3 0 1 0 16.8 12.8Z"/>;
    case "chevron-down":
      return <path d="m5 7.5 5 5 5-5"/>;
    case "chevron-left":
      return <path d="m12.5 4.5-5.5 5.5 5.5 5.5"/>;
    case "chevron-right":
    case "arrow-right":
      return <path d={name === "arrow-right" ? "M3 10h13M11.5 5.5 16 10l-4.5 4.5" : "m7.5 4.5 5.5 5.5-5.5 5.5"}/>;
    case "panel":
      return <><rect x="2.8" y="3" width="14.4" height="14" rx="1.8"/><path d="M7.4 3v14"/></>;
    case "close":
      return <path d="m4.5 4.5 11 11M15.5 4.5l-11 11"/>;
    case "user":
      return <><circle cx="10" cy="7" r="3"/><path d="M4 17c.5-3.4 2.5-5 6-5s5.5 1.6 6 5"/></>;
    case "shield":
      return <><path d="M10 2.7 16 5v4.6c0 3.8-2.2 6.3-6 7.7-3.8-1.4-6-3.9-6-7.7V5l6-2.3Z"/><path d="m7.2 10 1.8 1.8 3.8-4"/></>;
    case "switch":
      return <><path d="M3 6h12M12 3l3 3-3 3M17 14H5M8 11l-3 3 3 3"/></>;
    case "check":
      return <path d="m4 10 3.5 3.5L16 5.5"/>;
    case "clock":
      return <><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.8 1.8"/></>;
    case "alert":
      return <><path d="M10 2.8 18 17H2L10 2.8Z"/><path d="M10 7.2v4.5M10 14.5h.01"/></>;
    case "filter":
      return <path d="M3 5h14M5.8 10h8.4M8.3 15h3.4"/>;
    case "archive":
      return <><rect x="2.8" y="3" width="14.4" height="4" rx="1"/><path d="M4.2 7.5v8.7h11.6V7.5M7.5 11h5"/></>;
  }
}

export default function Icon({
  name,
  className,
  ...props
}: { name: IconName; className?: string } & Omit<SVGAttributes<SVGSVGElement>, "children">) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-5 shrink-0", className)}
      {...props}
    >
      <IconGlyph name={name} />
    </svg>
  );
}
