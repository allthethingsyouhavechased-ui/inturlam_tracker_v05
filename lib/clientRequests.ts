import type { BadgeTone } from "@/components/ui/Badge";
import type { ClientRequestStatus } from "@/lib/types";

export const CLIENT_REQUEST_STATUSES: ClientRequestStatus[] = [
  "Beklemede",
  "Incelemede",
  "Onaylandi",
  "Reddedildi",
];

export const CLIENT_REQUEST_STATUS_LABEL: Record<ClientRequestStatus, string> = {
  Beklemede: "Beklemede",
  Incelemede: "İncelemede",
  Onaylandi: "Onaylandı",
  Reddedildi: "Reddedildi",
};

export const CLIENT_REQUEST_STATUS_TONE: Record<ClientRequestStatus, BadgeTone> = {
  Beklemede: "warning",
  Incelemede: "violet",
  Onaylandi: "success",
  Reddedildi: "danger",
};

export const CLIENT_REQUEST_STATUS_DOT: Record<ClientRequestStatus, string> = {
  Beklemede: "bg-amber-500",
  Incelemede: "bg-violet-500",
  Onaylandi: "bg-emerald-500",
  Reddedildi: "bg-rose-500",
};
