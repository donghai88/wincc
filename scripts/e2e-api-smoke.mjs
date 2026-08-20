import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');
const timeoutMs = Number(process.env.E2E_TIMEOUT_MS ?? 20_000);
const artifactDir = join('output', 'e2e-api-smoke');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const results = [];
const websocketEvents = [];

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function endpointMatches(url, expectedPath) {
  const path = new URL(url).pathname;
  return path === expectedPath || path === `/api${expectedPath}`;
}

function record(name, status, detail) {
  results.push({ name, status, detail, at: new Date().toISOString() });
  console.log(`${status === 'passed' ? '✓' : '✗'} ${name}: ${detail}`);
}

async function waitForResponse(page, name, expectedPath, action) {
  const responsePromise = page.waitForResponse((response) => endpointMatches(response.url(), expectedPath), { timeout: timeoutMs });
  await action();
  const response = await responsePromise;
  const detail = `${response.status()} ${new URL(response.url()).pathname}`;

  if (!response.ok()) {
    throw new Error(`${name} 返回 ${detail}`);
  }

  record(name, 'passed', detail);
}

async function waitForWebSocket(expectedPath) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const opened = websocketEvents.find((event) => event.type === 'open' && endpointMatches(event.url, expectedPath));
    if (opened) {
      record(`WebSocket ${expectedPath}`, 'passed', `已连接 ${opened.url}`);
      return;
    }

    const failed = websocketEvents.find((event) => event.type === 'error' && endpointMatches(event.url, expectedPath));
    if (failed) throw new Error(`WebSocket ${expectedPath} 连接失败`);
    await wait(100);
  }

  throw new Error(`WebSocket ${expectedPath} 在 ${timeoutMs}ms 内未完成握手`);
}

let browser;
let page;

try {
  await mkdir(artifactDir, { recursive: true });
  browser = await chromium.launch({ headless: process.env.E2E_HEADLESS !== 'false' });
  page = await browser.newPage({ ignoreHTTPSErrors: process.env.E2E_IGNORE_HTTPS_ERRORS === 'true' });
  await page.exposeFunction('__reportE2eWebSocket', (event) => websocketEvents.push(event));
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;

    class TracedWebSocket extends NativeWebSocket {
      constructor(...args) {
        super(...args);
        const url = String(args[0]);
        this.addEventListener('open', () => window.__reportE2eWebSocket({ type: 'open', url }));
        this.addEventListener('error', () => window.__reportE2eWebSocket({ type: 'error', url }));
        this.addEventListener('close', (event) => window.__reportE2eWebSocket({ type: 'close', url, code: event.code }));
      }
    }

    Object.setPrototypeOf(TracedWebSocket, NativeWebSocket);
    window.WebSocket = TracedWebSocket;
    localStorage.setItem('wincc_user', JSON.stringify({
      username: 'e2e-tester', name: '接口联调测试', role: 'admin', loginTime: new Date().toISOString(),
    }));
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.getByRole('button', { name: '监控中心', exact: true }).waitFor({ timeout: timeoutMs });
  record('页面登录与加载', 'passed', baseUrl);

  await waitForResponse(page, '设备实时数据', '/device/live', () => page.getByRole('button', { name: '监控中心', exact: true }).click());
  await waitForResponse(page, '温度趋势', '/temperature/trend', () => page.getByRole('button', { name: '报表分析', exact: true }).click());

  const alarmPage = page.waitForResponse((response) => endpointMatches(response.url(), '/alarm/page'), { timeout: timeoutMs });
  await page.getByRole('button', { name: '告警中心', exact: true }).click();
  {
    const response = await alarmPage;
    const detail = `${response.status()} ${new URL(response.url()).pathname}`;
    if (!response.ok()) throw new Error(`告警分页 返回 ${detail}`);
    record('告警分页', 'passed', detail);
  }

  await waitForResponse(page, '周报查询', '/weekly/report/query', () => page.getByRole('button', { name: '查询周报', exact: true }).click());
  await waitForResponse(page, '周报下载', '/weekly/report/download', () => page.getByRole('button', { name: '下载周报', exact: true }).click());

  await page.getByRole('button', { name: '监控总览', exact: true }).click();
  await page.getByRole('button', { name: /铁水沟/ }).first().click();
  await waitForWebSocket('/ws/modbus');
  await waitForWebSocket('/ws/business/alarm');

  await page.screenshot({ path: join(artifactDir, `${runId}-passed.png`), fullPage: true });
  console.log(`\n全部 ${results.length} 项业务/API 链路测试通过。`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  record('测试执行', 'failed', message);
  if (page) {
    await page.screenshot({ path: join(artifactDir, `${runId}-failed.png`), fullPage: true }).catch(() => undefined);
  }
  console.error(`\n链路测试失败：${message}`);
  process.exitCode = 1;
} finally {
  await writeFile(join(artifactDir, `${runId}.json`), JSON.stringify({ baseUrl, results, websocketEvents }, null, 2));
  await browser?.close();
}
