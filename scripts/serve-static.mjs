import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request as requestToBackend } from 'node:http';
import { extname, isAbsolute, normalize, relative, resolve } from 'node:path';

const root = resolve('out');
const port = Number(process.env.PORT ?? 3001);
const backendUrl = new URL(process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8080');

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

const getProxyPath = (requestUrl) => {
  const { pathname, search } = new URL(requestUrl ?? '/', 'http://localhost');
  return pathname.startsWith('/api/') ? `${pathname.slice(4)}${search}` : `${pathname}${search}`;
};

const isProxyPath = (pathname) => pathname.startsWith('/api/') || pathname.startsWith('/ws/');

const getProxyOptions = (request) => ({
  hostname: backendUrl.hostname,
  port: backendUrl.port || 80,
  protocol: backendUrl.protocol,
  method: request.method,
  path: getProxyPath(request.url),
  headers: {
    ...request.headers,
    host: backendUrl.host,
  },
});

const proxyHttpRequest = (request, response) => {
  const backendRequest = requestToBackend(getProxyOptions(request), (backendResponse) => {
    response.writeHead(backendResponse.statusCode ?? 502, backendResponse.headers);
    backendResponse.pipe(response);
  });

  backendRequest.on('error', (error) => {
    console.error(`[proxy] ${request.method} ${request.url} -> ${error.message}`);
    if (!response.headersSent) {
      response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    response.end('Bad Gateway');
  });

  request.pipe(backendRequest);
};

const server = createServer((request, response) => {
  const startedAt = Date.now();
  response.once('finish', () => {
    console.log(`[access] ${request.method} ${request.url} ${response.statusCode} ${Date.now() - startedAt}ms`);
  });

  const pathname = decodeURIComponent(new URL(request.url ?? '/', `http://${request.headers.host}`).pathname);

  if (isProxyPath(pathname)) {
    proxyHttpRequest(request, response);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

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
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;

  if (!pathname.startsWith('/ws/')) {
    socket.destroy();
    return;
  }

  const backendRequest = requestToBackend(getProxyOptions(request));

  backendRequest.on('upgrade', (backendResponse, backendSocket, backendHead) => {
    const statusLine = `HTTP/${backendResponse.httpVersion} ${backendResponse.statusCode} ${backendResponse.statusMessage}`;
    const headers = Object.entries(backendResponse.headers)
      .flatMap(([name, value]) => Array.isArray(value)
        ? value.map((item) => `${name}: ${item}`)
        : value === undefined ? [] : [`${name}: ${value}`]);

    socket.write(`${[statusLine, ...headers].join('\r\n')}\r\n\r\n`);
    if (backendHead.length) socket.write(backendHead);
    if (head.length) backendSocket.write(head);

    console.log(`[ws] connected ${request.url}`);
    backendSocket.pipe(socket);
    socket.pipe(backendSocket);
  });

  backendRequest.on('error', (error) => {
    console.error(`[proxy] WebSocket ${request.url} -> ${error.message}`);
    socket.destroy();
  });

  backendRequest.end();
});

server.listen(port, '0.0.0.0', () => {
  console.log(`演示服务已启动：http://127.0.0.1:${port}`);
  console.log(`接口代理目标：${backendUrl.origin}`);
});
