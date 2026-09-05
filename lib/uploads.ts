import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ALLOWED_IMAGE_EXTENSIONS, MAX_IMAGE_PIXELS, validateImageFiles } from "@/lib/imageUploadPolicy";
export { ALLOWED_IMAGE_EXTENSIONS, MAX_IMAGE_FILES, MAX_IMAGE_SIZE, validateImageFiles } from "@/lib/imageUploadPolicy";

function runtimeUploadRoot(): string {
  return process.env.INTURLAM_UPLOAD_ROOT || path.join(process.cwd(), "data", "uploads");
}

export interface SavedImageFile {
  filePath: string;
  originalName: string | null;
}

export function extractImageFiles(formData: FormData, field = "images"): File[] {
  return formData
    .getAll(field)
    .filter((v): v is File => v instanceof File && (v.size > 0 || v.name !== ""));
}

export async function validateImageContent(image: File): Promise<Buffer> {
  validateImageFiles([image]);
  const buffer = Buffer.from(await image.arrayBuffer());
  const decoder = sharp(buffer, { animated: true, limitInputPixels: MAX_IMAGE_PIXELS, failOn: "warning" });
  try {
    const metadata = await decoder.metadata();
    const expected = image.type === "image/jpeg" ? "jpeg" : ALLOWED_IMAGE_EXTENSIONS[image.type];
    if (metadata.format !== expected) throw new Error("Tür uyuşmazlığı");
    // Stats fully decodes pixel data, unlike metadata alone. Every animation
    // frame is included in the pixel budget. Original bytes remain unchanged.
    await decoder.stats();
  } catch {
    throw new Error(`${image.name}: görsel bozuk, türü uyuşmuyor veya toplam 24 milyon piksel sınırını aşıyor.`);
  } finally {
    decoder.destroy();
  }
  return buffer;
}

// `subdir` runtime `data/uploads` kökü altında ayrı bir klasör (ör. "comments", "tasks") —
// farklı varlık türlerinin ekleri karışmasın diye.
export async function saveImageFiles(
  images: File[],
  subdir: string,
): Promise<SavedImageFile[]> {
  if (images.length === 0) return [];
  validateImageFiles(images);
  const uploadDir = path.join(/* turbopackIgnore: true */ runtimeUploadRoot(), subdir);
  await fs.mkdir(uploadDir, { recursive: true });
  const saved: { filePath: string; originalName: string | null }[] = [];
  try {
    for (const image of images) {
      const ext = ALLOWED_IMAGE_EXTENSIONS[image.type];
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const buffer = await validateImageContent(image);
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

// Repodaki `public/logos` dosyaları yalnızca başlangıç varlığıdır. Kullanıcının
// sonradan yüklediği/değiştirdiği logolar diğer runtime ekleriyle aynı özel
// depoda yaşar ve DB yedeğine birlikte girer. Yeni dosya önce UUID ile yazılır;
// DB işlemi başarısızsa `withSavedImageFiles` onu geri alır. Eski runtime logo
// ise ancak yeni DB referansı güvenceye alındıktan sonra silinir. `/logos/...`
// biçimindeki repo varlıklarını deleteUploadedFile zaten bilinçli olarak korur.
export async function replaceBrandLogo<T>(
  image: File,
  previousFilePath: string | null,
  persist: (filePath: string) => T | Promise<T>,
): Promise<T> {
  validateImageFiles([image]);
  const saved = await withSavedImageFiles([image], "logos", async ([logo]) => ({
    filePath: logo.filePath,
    result: await persist(logo.filePath),
  }));
  if (previousFilePath && previousFilePath !== saved.filePath) {
    await deleteUploadedFile(previousFilePath);
  }
  return saved.result;
}
