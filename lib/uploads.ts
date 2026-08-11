import fs from "node:fs/promises";
import path from "node:path";

const RUNTIME_UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

export const MAX_IMAGE_FILES = 6;
export const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB

export const ALLOWED_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export function extractImageFiles(formData: FormData, field = "images"): File[] {
  return formData
    .getAll(field)
    .filter((v): v is File => v instanceof File && v.size > 0)
    .slice(0, MAX_IMAGE_FILES);
}

export function validateImageFiles(images: File[]): void {
  for (const image of images) {
    if (image.size > MAX_IMAGE_SIZE) {
      throw new Error(`${image.name}: dosya çok büyük (max 8MB).`);
    }
    if (!(image.type in ALLOWED_IMAGE_EXTENSIONS)) {
      throw new Error(`${image.name}: sadece görsel dosyaları (PNG/JPG/GIF/WEBP) yüklenebilir.`);
    }
  }
}

// `subdir` public/uploads altında ayrı bir klasör (ör. "comments", "tasks") —
// farklı varlık türlerinin ekleri karışmasın diye.
export async function saveImageFiles(
  images: File[],
  subdir: string,
): Promise<{ filePath: string; originalName: string | null }[]> {
  if (images.length === 0) return [];
  const uploadDir = path.join(RUNTIME_UPLOAD_ROOT, subdir);
  await fs.mkdir(uploadDir, { recursive: true });
  const saved: { filePath: string; originalName: string | null }[] = [];
  for (const image of images) {
    const ext = ALLOWED_IMAGE_EXTENSIONS[image.type];
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await image.arrayBuffer());
    await fs.writeFile(path.join(uploadDir, fileName), buffer);
    saved.push({ filePath: `/uploads/${subdir}/${fileName}`, originalName: image.name || null });
  }
  return saved;
}

export async function deleteUploadedFile(filePath: string): Promise<void> {
  const relative = filePath.replace(/^\/uploads\//, "");
  const abs = path.resolve(RUNTIME_UPLOAD_ROOT, relative);
  const insideRoot = path.relative(RUNTIME_UPLOAD_ROOT, abs);
  if (insideRoot.startsWith("..") || path.isAbsolute(insideRoot)) return;
  await fs.unlink(abs).catch(() => {});
}

// Marka logoları `public/logos/<brandId>.<uzanti>` altında, `db/seed.mts`'in
// beklediği ADLANDIRMAYLA AYNI yere yazılır — böylece bu yoldan yüklenen bir
// logo, sonradan `db:seed` çalıştırıldığında da bulunur/korunur. Dosya adı
// UUID değil brandId olduğu için tek marka için tek dosya olur; önceki logo
// farklı bir uzantıdaysa (ör. .jpg -> .png değişimi) yetim kalmasın diye önce
// aynı brandId ile başlayan dosyalar temizlenir.
export async function saveBrandLogo(image: File, brandId: string): Promise<string> {
  validateImageFiles([image]);
  const logoDir = path.join(process.cwd(), "public", "logos");
  await fs.mkdir(logoDir, { recursive: true });
  const existing = await fs.readdir(logoDir).catch(() => [] as string[]);
  for (const file of existing) {
    if (file.startsWith(`${brandId}.`)) {
      await fs.unlink(path.join(logoDir, file)).catch(() => {});
    }
  }
  const ext = ALLOWED_IMAGE_EXTENSIONS[image.type];
  const fileName = `${brandId}.${ext}`;
  const buffer = Buffer.from(await image.arrayBuffer());
  await fs.writeFile(path.join(logoDir, fileName), buffer);
  return `/logos/${fileName}`;
}
