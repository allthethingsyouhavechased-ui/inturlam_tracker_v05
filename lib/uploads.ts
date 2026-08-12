import fs from "node:fs/promises";
import path from "node:path";

function runtimeUploadRoot(): string {
  return process.env.INTURLAM_UPLOAD_ROOT || path.join(process.cwd(), "data", "uploads");
}

export interface SavedImageFile {
  filePath: string;
  originalName: string | null;
}

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
): Promise<SavedImageFile[]> {
  if (images.length === 0) return [];
  const uploadDir = path.join(/* turbopackIgnore: true */ runtimeUploadRoot(), subdir);
  await fs.mkdir(uploadDir, { recursive: true });
  const saved: { filePath: string; originalName: string | null }[] = [];
  try {
    for (const image of images) {
      const ext = ALLOWED_IMAGE_EXTENSIONS[image.type];
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const buffer = Buffer.from(await image.arrayBuffer());
      await fs.writeFile(path.join(/* turbopackIgnore: true */ uploadDir, fileName), buffer);
      saved.push({ filePath: `/uploads/${subdir}/${fileName}`, originalName: image.name || null });
    }
  } catch (error) {
    for (const image of saved) await deleteUploadedFile(image.filePath);
    throw error;
  }
  return saved;
}

export async function deleteUploadedFile(filePath: string): Promise<void> {
  const root = runtimeUploadRoot();
  if (!filePath.startsWith("/uploads/")) return;
  const relative = filePath.replace(/^\/uploads\//, "");
  const abs = path.resolve(root, relative);
  const insideRoot = path.relative(root, abs);
  if (insideRoot.startsWith("..") || path.isAbsolute(insideRoot)) return;
  await fs.unlink(abs).catch(() => {});
}

export async function deleteUploadedFiles(filePaths: string[]): Promise<void> {
  await Promise.all(Array.from(new Set(filePaths)).map(deleteUploadedFile));
}

export async function withSavedImageFiles<T>(
  images: File[],
  subdir: string,
  persist: (saved: SavedImageFile[]) => T | Promise<T>,
): Promise<T> {
  const saved = await saveImageFiles(images, subdir);
  try {
    return await persist(saved);
  } catch (error) {
    await deleteUploadedFiles(saved.map((file) => file.filePath));
    throw error;
  }
}

export async function cloneUploadedFile(
  filePath: string,
  subdir: string,
): Promise<{ filePath: string; originalName: string | null }> {
  const relative = filePath.replace(/^\/uploads\//, "");
  const root = runtimeUploadRoot();
  const source = path.resolve(root, relative);
  const insideRoot = path.relative(root, source);
  if (insideRoot.startsWith("..") || path.isAbsolute(insideRoot)) {
    throw new Error("Kopyalanacak görsel yolu geçersiz.");
  }
  const extension = path.extname(source).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(extension)) {
    throw new Error("Kopyalanacak dosya desteklenen bir görsel değil.");
  }
  const targetDir = path.join(/* turbopackIgnore: true */ root, subdir);
  await fs.mkdir(targetDir, { recursive: true });
  const targetName = `${crypto.randomUUID()}${extension === ".jpeg" ? ".jpg" : extension}`;
  await fs.copyFile(source, path.join(/* turbopackIgnore: true */ targetDir, targetName));
  return { filePath: `/uploads/${subdir}/${targetName}`, originalName: null };
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
