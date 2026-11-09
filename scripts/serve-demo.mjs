import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'node:util';

// 演示包专用：只托管 out/ 静态文件，不代理任何后端，不依赖 node_modules。
const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : undefined;
};

// 计划任务后台运行时没有控制台，输出追加到 --log 指定的文件
const logFile = argValue('--log');
if (logFile) {
  mkdirSync(dirname(resolve(logFile)), { recursive: true });
  const stream = createWriteStream(resolve(logFile), { flags: 'a' });
  const write = (level) => (...args) => stream.write(`${new Date().toISOString()} ${level} ${format(...args)}\n`);
  console.log = write('INFO');
  console.error = write('ERROR');
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(process.env.STATIC_ROOT ?? resolve(packageRoot, 'out'));
const port = Number(argValue('--port') ?? process.env.PORT ?? 3001);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.glb': 'model/gltf-binary',
  '.fbx': 'application/octet-stream',
  '.pcd': 'application/octet-stream',
};

if (!existsSync(resolve(root, 'index.html'))) {
  console.error(`index.html not found: ${resolve(root, 'index.html')}`);
  console.error('Please extract the whole package, or set STATIC_ROOT to the out directory.');
  process.exit(1);
}

const resolveFile = (pathname) => {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let filePath = resolve(root, normalize(relativePath));
  const relativeToRoot = relative(root, filePath);
  if (relativeToRoot.startsWith('..') || isAbsolute(relativeToRoot)) return null;
  if (!extname(filePath) && existsSync(`${filePath}.html`)) filePath = `${filePath}.html`;
  if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = resolve(filePath, 'index.html');
  return existsSync(filePath) ? filePath : null;
};

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }

  const filePath = resolveFile(pathname);
  if (!filePath) {
    const notFound = resolve(root, '404.html');
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    if (request.method === 'HEAD' || !existsSync(notFound)) response.end('Not found');
    else createReadStream(notFound).pipe(response);
    return;
  }

  const { size } = statSync(filePath);
  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': size,
    // 带 hash 的构建产物可长期缓存；页面与点云保持协商缓存，便于替换演示包
    'Cache-Control': pathname.startsWith('/_next/static/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Close the other program or set another PORT.`);
  } else {
    console.error(error.message);
  }
  setTimeout(() => process.exit(1), 100);
});

server.listen(port, '0.0.0.0', () => {
  const url = `http://127.0.0.1:${port}/login`;
  // Windows 控制台默认 GBK 代码页，提示统一用英文避免乱码
  console.log(`Demo server is running: http://127.0.0.1:${port}`);
  console.log(`LAN access: http://<this-machine-ip>:${port}   account: admin / admin123`);
  console.log('Keep this window open. Press Ctrl+C to stop.');
  if (process.env.OPEN_BROWSER === '1') {
    const [command, args] = process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', url]]
      : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]];
    spawn(command, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: process.platform === 'win32' }).unref();
  }
});
