import path from "path";
import fs from "fs";

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function getUploadsDir(): string {
  const dir = path.join(process.cwd(), "uploads");
  ensureDir(dir);
  return dir;
}

export function getGeneratedDir(): string {
  const dir = path.join(process.cwd(), "generated");
  ensureDir(dir);
  return dir;
}
