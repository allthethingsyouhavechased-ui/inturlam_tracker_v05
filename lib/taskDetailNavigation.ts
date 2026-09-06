export function taskDetailTabFromHash(hash: string): "details" | "delivery" | "revision" | null {
  const value = hash.replace(/^#/, "");
  if (value.startsWith("delivery-") || value === "teslim") return "delivery";
  if (value === "gorev-ayrintilari") return "details";
  if (value === "revize") return "revision";
  return null;
}
