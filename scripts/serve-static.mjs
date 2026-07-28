import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, normalize, relative, resolve } from 'node:path';

const root = resolve('out');
const port = Number(process.env.PORT ?? 3001);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.fbx': 'application/octet-stream',
};

if (!existsSync(root)) {
  console.error('找不到 out 目录。请先在构建电脑执行 npm run build，并将 out 目录一同复制到演示机。');
  process.exit(1);
}

createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const pathname = decodeURIComponent(new URL(request.url ?? '/', `http://${request.headers.host}`).pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let filePath = resolve(root, normalize(relativePath));

  const relativeToRoot = relative(root, filePath);
  if (relativeToRoot.startsWith('..') || isAbsolute(relativeToRoot)) {
    response.writeHead(403).end();
    return;
  }

  if (!extname(filePath) && existsSync(`${filePath}.html`)) {
    filePath = `${filePath}.html`;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = resolve(filePath, 'index.html');
  }

  if (!existsSync(filePath)) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}).listen(port, '0.0.0.0', () => {
  console.log(`演示服务已启动：http://127.0.0.1:${port}`);
});
