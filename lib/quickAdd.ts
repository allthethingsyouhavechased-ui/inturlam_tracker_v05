export const NEW_CONTENT_VALUE = "__new__";

export function resolveQuickAddContentId(
  selectedId: string,
  availableIds: string[],
): string {
  if (selectedId === NEW_CONTENT_VALUE) return NEW_CONTENT_VALUE;
  return availableIds.includes(selectedId) ? selectedId : NEW_CONTENT_VALUE;
}
