import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(process.cwd());
const source = path.join(projectRoot, "public", "uploads");
const destination = path.join(projectRoot, "data", "uploads");
const quarantineRoot = path.join(projectRoot, "data", "runtime");

function assertInsideProject(target: string): void {
  const relative = path.relative(projectRoot, path.resolve(target));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Upload taşıma hedefi proje dışında: ${target}`);
  }
}

function filesUnder(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)));
}

function digest(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function verifySame(left: string, right: string): void {
  if (!fs.existsSync(right) || fs.statSync(left).size !== fs.statSync(right).size) {
    throw new Error(`Upload kopyası doğrulanamadı: ${path.basename(left)}`);
  }
  if (digest(left) !== digest(right)) {
    throw new Error(`Upload özeti eşleşmedi: ${path.basename(left)}`);
  }
}

assertInsideProject(source);
assertInsideProject(destination);
assertInsideProject(quarantineRoot);

if (!fs.existsSync(source)) {
  console.log("Upload deposu hazır; public altında taşınacak eski dosya yok.");
} else {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (!fs.existsSync(destination)) {
    fs.renameSync(source, destination);
    console.log(`Upload deposu özel alana taşındı: ${filesUnder(destination).length} dosya.`);
  } else {
    const sourceFiles = filesUnder(source);
    for (const relative of sourceFiles) {
      const from = path.join(source, relative);
      const to = path.join(destination, relative);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      if (!fs.existsSync(to)) fs.copyFileSync(from, to);
      verifySame(from, to);
    }

    fs.mkdirSync(quarantineRoot, { recursive: true });
    const quarantine = path.join(
      quarantineRoot,
      `migrated-public-uploads-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    );
    fs.renameSync(source, quarantine);
    console.log(`Upload deposu birleştirildi ve eski kopya karantinaya taşındı: ${sourceFiles.length} dosya.`);
  }
}
