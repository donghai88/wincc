/**
 * 启动 Next dev，并在 Ready 后后台预编译首屏路由，
 * 避免打开浏览器时才触发 Compiling /（常见要等几十秒）。
 */
import { spawn } from "child_process";
import { createInterface } from "readline";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const port = process.env.PORT || "3001";
const base = `http://127.0.0.1:${port}`;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const child = spawn("npx", ["next", "dev", "-p", port], {
  cwd: projectRoot,
  env: process.env,
  stdio: ["inherit", "pipe", "pipe"],
});

let warming = false;

const onLine = (line) => {
  process.stdout.write(`${line}\n`);
  if (!warming && /✓ Ready|Ready in/.test(line)) {
    warming = true;
    void warmup();
  }
};

createInterface({ input: child.stdout }).on("line", onLine);
createInterface({ input: child.stderr }).on("line", (line) => {
  process.stderr.write(`${line}\n`);
});

async function warmup() {
  const started = Date.now();
  console.log(`[warmup] 正在预编译 ${base}/ 与 ${base}/login ...`);
  for (const path of ["/", "/login"]) {
    try {
      const res = await fetch(`${base}${path}`, {
        signal: AbortSignal.timeout(180_000),
      });
      console.log(
        `[warmup] ${path} → ${res.status} (${((Date.now() - started) / 1000).toFixed(1)}s)`,
      );
    } catch (error) {
      console.warn(
        `[warmup] ${path} 失败:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  console.log(
    `[warmup] 完成，可打开 http://localhost:${port}（总耗时 ${((Date.now() - started) / 1000).toFixed(1)}s）`,
  );
}

const shutdown = (signal) => {
  child.kill(signal);
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code) => process.exit(code ?? 0));
