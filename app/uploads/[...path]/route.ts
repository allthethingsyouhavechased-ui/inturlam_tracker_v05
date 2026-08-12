import fs from "node:fs/promises";
import path from "node:path";
import { getCurrentActor } from "@/lib/identity";
import { guestCanAccessUpload } from "@/lib/repositories/guestTasks";
import { resolveRuntimeUpload } from "@/lib/runtimeUploads";

export const dynamic = "force-dynamic";

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const requestedPath = (await context.params).path;
  const publicAvatar = requestedPath[0] === "people";
  const actor = await getCurrentActor();
  if (!publicAvatar) {
    if (!actor) return new Response(null, { status: 401 });
    if (actor.kind === "guest") {
      const filePath = `/uploads/${requestedPath.join("/")}`;
      if (!guestCanAccessUpload(actor.brand.id, filePath)) return new Response(null, { status: 403 });
    }
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
