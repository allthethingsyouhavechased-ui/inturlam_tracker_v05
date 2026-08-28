/** Modal kapanırken yalnızca modalı temsil eden parametreleri temizler. */
export function clearCalendarDialogParams(url: URL): string {
  url.searchParams.delete("event");
  url.searchParams.delete("day");
  // Eski açılır panel bağlantıları dolaşımda kalmış olabilir.
  url.searchParams.delete("yeni");
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}
