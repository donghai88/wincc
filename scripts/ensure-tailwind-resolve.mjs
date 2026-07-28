/**
 * Next/Turbopack 会因上级 /Users/qihoo/package-lock.json 误判工作区根，
 * 将 CSS `@import "tailwindcss"` 解析上下文落在 /Users/qihoo/Project。
 * 在该目录补上指向本项目依赖的符号链接，避免 Can't resolve 'tailwindcss'。
 */
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrongContextModules = resolve(projectRoot, "../node_modules");
const target = resolve(projectRoot, "node_modules/tailwindcss");
const link = resolve(wrongContextModules, "tailwindcss");

if (!existsSync(target)) {
  console.error(
    "[ensure-tailwind-resolve] 未找到本项目的 tailwindcss，请先执行 npm install",
  );
  process.exit(1);
}

mkdirSync(wrongContextModules, { recursive: true });

const existing = lstatSync(link, { throwIfNoEntry: false });
if (existing?.isSymbolicLink()) {
  process.exit(0);
}
if (existing) {
  rmSync(link, { recursive: true, force: true });
}

symlinkSync(target, link);
console.log(`[ensure-tailwind-resolve] linked ${link} -> ${target}`);
