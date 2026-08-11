import fs from "node:fs/promises";
import path from "node:path";
import { getCurrentPerson } from "@/lib/identity";
import { resolveRuntimeUpload } from "@/lib/runtimeUploads";

export const dynamic = "force-dynamic";

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const requestedPath = (await context.params).path;
  const publicAvatar = requestedPath[0] === "people";
  if (!publicAvatar && !(await getCurrentPerson())) {
    return new Response(null, { status: 401 });
  }

  const resolved = resolveRuntimeUpload(UPLOAD_ROOT, requestedPath);
  if (!resolved) return new Response(null, { status: 404 });

  try {
    const file = await fs.readFile(resolved.absolutePath);
    return new Response(file, {
      headers: {
        "Cache-Control": publicAvatar
          ? "public, max-age=3600, must-revalidate"
          : "private, no-store",
        "Content-Type": resolved.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EISDIR") {
      return new Response(null, { status: 404 });
    }
    throw error;
  }
}
