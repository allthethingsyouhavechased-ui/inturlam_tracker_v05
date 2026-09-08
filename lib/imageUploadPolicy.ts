// Shared by file pickers and the server. The 20 MB batch leaves room under
// the 25 MB Server Action body limit for multipart fields and metadata.
export const MAX_IMAGE_FILES = 6;
export const MAX_IMAGE_TOTAL_SIZE = 20 * 1024 * 1024;
export const MAX_IMAGE_SIZE = MAX_IMAGE_TOTAL_SIZE;
export const MAX_IMAGE_PIXELS = 24_000_000;
export const IMAGE_UPLOAD_HINT = "En fazla 6 görsel · dosya başına 20 MB · toplam 20 MB · PNG, JPG, GIF, WEBP";
export const ALLOWED_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp",
};


export function validateImageFiles(images: Pick<File, "name" | "size" | "type">[]): void {
  if (images.length > MAX_IMAGE_FILES) throw new Error("En fazla 6 görsel ekleyebilirsiniz. Hiçbir dosya eklenmedi.");
  if (images.reduce((sum, file) => sum + file.size, 0) > MAX_IMAGE_TOTAL_SIZE) throw new Error("Görsellerin toplam boyutu 20 MB'ı aşamaz.");
  for (const image of images) {
    if (!image.size || image.size > MAX_IMAGE_SIZE) throw new Error(`${image.name}: dosya boş veya 20 MB sınırını aşıyor.`);
    if (!Object.hasOwn(ALLOWED_IMAGE_EXTENSIONS, image.type)) throw new Error(`${image.name}: yalnız PNG, JPG, GIF veya WEBP yüklenebilir.`);
  }
}


export function imageUploadCapacity(images: Pick<File, "size">[]): string {
  const remaining = Math.max(0, (MAX_IMAGE_TOTAL_SIZE - images.reduce((sum, image) => sum + image.size, 0)) / 1024 / 1024);
  return `${images.length}/${MAX_IMAGE_FILES} görsel · ${remaining.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB kullanılabilir`;
}
