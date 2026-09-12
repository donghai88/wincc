import { createReadStream, existsSync, statSync } from 'node:fs';
import http, { createServer, request as requestToBackend } from 'node:http';
import https from 'node:https';
import { dirname, extname, isAbsolute, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

// 相对本脚本定位 out/，避免启动时 cwd 不对而读到别的目录
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(process.env.STATIC_ROOT ?? resolve(packageRoot, 'out'));
const port = Number(process.env.PORT ?? 3001);
const backendUrl = new URL(process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8080');
const mediaAllowHosts = (process.env.MEDIA_PROXY_ALLOW_HOSTS ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const snapshotAllowRoots = (process.env.SNAPSHOT_ALLOW_ROOTS ?? 'D:\\data\\ladle')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
  .map((item) => resolve(normalize(item)));
const snapshotImageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']);
const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

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
  console.error(`找不到 out 目录：${root}`);
  console.error('请在包根目录启动，或设置 STATIC_ROOT 指向 out 的绝对路径。');
  process.exit(1);
}

console.log(`静态根目录：${root}`);
const probeChunk = resolve(root, '_next/static/chunks');
if (!existsSync(probeChunk)) {
  console.warn(`警告：未找到 ${probeChunk}，前端 JS 将无法加载`);
}

const getProxyPath = (requestUrl) => {
  const { pathname, search } = new URL(requestUrl ?? '/', 'http://localhost');
  return pathname.startsWith('/api/') ? `${pathname.slice(4)}${search}` : `${pathname}${search}`;
};

const isBackendProxyPath = (pathname) => (
  (pathname.startsWith('/api/') && !pathname.startsWith('/api/media/'))
  || pathname.startsWith('/ws/')
);

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

const isPrivateOrLocalHostname = (hostname) => {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return false;
};

const assertAllowedMediaTarget = (rawTarget) => {
  if (!rawTarget) {
    throw new Error('missing target');
  }

  const target = new URL(rawTarget);
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('unsupported protocol');
  }
  if (!/\.live\.flv(?:$|\?)/i.test(target.pathname + target.search) && !/\.live\.flv$/i.test(target.pathname)) {
    throw new Error('target must be an HTTP-FLV url');
  }
  if (mediaAllowHosts.length > 0) {
    if (!mediaAllowHosts.includes(target.hostname)) {
      throw new Error(`host not allowed: ${target.hostname}`);
    }
  } else if (!isPrivateOrLocalHostname(target.hostname)) {
    throw new Error(`host not allowed: ${target.hostname}`);
  }

  return target;
};

const flvWsServer = new WebSocketServer({ noServer: true });

const isPathInsideRoot = (filePath, rootPath) => {
  const relativeToRoot = relative(rootPath, filePath);
  return relativeToRoot !== ''
    && !relativeToRoot.startsWith('..')
    && !isAbsolute(relativeToRoot);
};

const resolveAllowedSnapshotFile = (rawPath) => {
  if (!rawPath) {
    throw new Error('missing path');
  }

  const normalizedInput = rawPath.replace(/\//g, '\\').trim();
  if (!normalizedInput || normalizedInput.includes('\0')) {
    throw new Error('invalid path');
  }

  const filePath = resolve(normalize(normalizedInput));
  const ext = extname(filePath).toLowerCase();
  if (!snapshotImageExts.has(ext)) {
    throw new Error('unsupported image type');
  }

  const allowed = snapshotAllowRoots.some((root) => (
    filePath === root || isPathInsideRoot(filePath, root)
  ));
  if (!allowed) {
    throw new Error('path not allowed');
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new Error('file not found');
  }

  return filePath;
};

const handleSnapshotFileRequest = (request, response) => {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');
  let filePath;
  try {
    filePath = resolveAllowedSnapshotFile(requestUrl.searchParams.get('path'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'bad path';
    const status = message === 'file not found' ? 404 : 400;
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(message);
    return;
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
};

const handleFlvWebSocketProxy = (request, socket, head) => {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');

  let target;
  try {
    target = assertAllowedMediaTarget(requestUrl.searchParams.get('target'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'bad target';
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n');
    socket.write(message);
    socket.destroy();
    return;
  }

  flvWsServer.handleUpgrade(request, socket, head, (ws) => {
    const transport = target.protocol === 'https:' ? https : http;
    const upstreamRequest = transport.request(target, {
      method: 'GET',
      agent: target.protocol === 'https:' ? insecureHttpsAgent : undefined,
      headers: {
        Accept: '*/*',
        Connection: 'keep-alive',
      },
    }, (upstreamResponse) => {
      if ((upstreamResponse.statusCode ?? 500) >= 400) {
        console.error(`[flv-ws] upstream ${target.href} -> HTTP ${upstreamResponse.statusCode}`);
        ws.close(1011, `upstream ${upstreamResponse.statusCode}`);
        upstreamResponse.resume();
        return;
      }

      console.log(`[flv-ws] proxying ${target.pathname}`);
      upstreamResponse.on('data', (chunk) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(chunk, { binary: true });
        }
      });
      upstreamResponse.on('end', () => {
        if (ws.readyState === ws.OPEN) ws.close();
      });
      upstreamResponse.on('error', (error) => {
        console.error(`[flv-ws] upstream read error: ${error.message}`);
        if (ws.readyState === ws.OPEN) ws.close();
      });
    });

    upstreamRequest.on('error', (error) => {
      console.error(`[flv-ws] upstream connect error: ${error.message}`);
      if (ws.readyState === ws.OPEN) ws.close();
    });

    ws.on('close', () => {
      upstreamRequest.destroy();
    });
    ws.on('error', () => {
      upstreamRequest.destroy();
    });

    upstreamRequest.end();
  });
};

const server = createServer((request, response) => {
  const startedAt = Date.now();
  response.once('finish', () => {
    console.log(`[access] ${request.method} ${request.url} ${response.statusCode} ${Date.now() - startedAt}ms`);
  });

  const pathname = decodeURIComponent(new URL(request.url ?? '/', `http://${request.headers.host}`).pathname);

  if (pathname === '/api/media/snapshot') {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    handleSnapshotFileRequest(request, response);
    return;
  }

  if (pathname.startsWith('/api/media/')) {
    response.writeHead(426, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Upgrade Required');
    return;
  }

  if (isBackendProxyPath(pathname)) {
    proxyHttpRequest(request, response);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // 静态页被浏览器原生 POST 时（JS 未 hydrate），改为回到同路径，避免 Chrome 405 白屏
    const acceptPostAsGet = pathname === '/'
      || pathname === '/login'
      || pathname.endsWith('.html');
    if (acceptPostAsGet && (request.method === 'POST' || request.method === 'PUT')) {
      response.writeHead(303, { Location: pathname || '/' });
      response.end();
      return;
    }
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
    const ext = extname(pathname);
    // 绝不能对缺失的 JS/CSS 回退成 HTML，否则浏览器会报 Unexpected token '<'
    if (ext === '.js') {
      response.writeHead(404, { 'Content-Type': 'application/javascript; charset=utf-8' });
      response.end(`throw new Error(${JSON.stringify(`Missing JS: ${pathname}`)});`);
      return;
    }
    if (ext === '.css') {
      response.writeHead(404, { 'Content-Type': 'text/css; charset=utf-8' });
      response.end(`/* Missing CSS: ${pathname} */`);
      return;
    }
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
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

  if (pathname === '/api/media/flv-ws') {
    handleFlvWebSocketProxy(request, socket, head);
    return;
  }

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
  console.log(`截图目录白名单：${snapshotAllowRoots.join(' | ') || '(empty)'}`);
  console.log('FLV 并发中转：ws(s)://<host>/api/media/flv-ws?target=<http-flv-url>');
  console.log('本地截图代理：/api/media/snapshot?path=<windows-absolute-path>');
});
