import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 将 build:demo 产出的 out/ 打成可直接拷到服务器运行的演示包（无需源码与 node_modules）。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'out');
if (!existsSync(resolve(outDir, 'index.html'))) {
  console.error('找不到 out/index.html，请先执行 npm run build:demo');
  process.exit(1);
}

const now = new Date();
const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
const name = `ruihai-demo-${stamp}`;
const distDir = resolve(root, 'dist');
const packageDir = resolve(distDir, name);

rmSync(packageDir, { recursive: true, force: true });
mkdirSync(resolve(packageDir, 'scripts'), { recursive: true });
cpSync(outDir, resolve(packageDir, 'out'), { recursive: true });
cpSync(resolve(root, 'scripts/serve-demo.mjs'), resolve(packageDir, 'scripts/serve-demo.mjs'));
for (const file of ['start-demo.sh', 'README.md']) {
  cpSync(resolve(root, 'deploy/demo', file), resolve(packageDir, file));
}
// cmd.exe / PowerShell 需要 CRLF 换行，否则可能逐行解析出错
const toCrlf = (source, target) => {
  const text = readFileSync(resolve(root, 'deploy/demo', source), 'utf8').replace(/\r?\n/g, '\r\n');
  writeFileSync(resolve(packageDir, target), text);
};
for (const file of ['start-demo.cmd', 'install-autostart.cmd', 'uninstall-autostart.cmd', 'demo-control.cmd']) {
  toCrlf(file, file);
}
toCrlf('demo-service.ps1', 'scripts/demo-service.ps1');
chmodSync(resolve(packageDir, 'start-demo.sh'), 0o755);

const tarFile = `${name}.tar.gz`;
rmSync(resolve(distDir, tarFile), { force: true });
execFileSync('tar', ['-czf', tarFile, name], { cwd: distDir, stdio: 'inherit' });
console.log(`已生成：dist/${tarFile}`);

try {
  const zipFile = `${name}.zip`;
  rmSync(resolve(distDir, zipFile), { force: true });
  execFileSync('zip', ['-qr', zipFile, name], { cwd: distDir, stdio: 'inherit' });
  console.log(`已生成：dist/${zipFile}`);
} catch {
  console.log('未找到 zip 命令，仅生成 tar.gz（Windows 10+ 可用 tar -xzf 解压）');
}
