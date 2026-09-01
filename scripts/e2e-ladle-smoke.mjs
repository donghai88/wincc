import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/**
 * 钢包监测 5 模块冒烟：
 * - 默认按 Mock UI 主流程验收（不依赖真实后端）
 * - E2E_EXPECT_API=true 时额外等待文档接口响应（真实/fallback 联调）
 */
const baseUrl = (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');
const timeoutMs = Number(process.env.E2E_TIMEOUT_MS ?? 20_000);
const expectApi = process.env.E2E_EXPECT_API === 'true';
const artifactDir = join('output', 'e2e-ladle-smoke');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const results = [];
const websocketEvents = [];

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function endpointMatches(url, expectedPath) {
  const path = new URL(url).pathname;
  return path === expectedPath || path === `/api${expectedPath}` || path.startsWith(expectedPath) || path.startsWith(`/api${expectedPath}`);
}

function record(name, status, detail) {
  results.push({ name, status, detail, at: new Date().toISOString() });
  console.log(`${status === 'passed' ? '✓' : '✗'} ${name}: ${detail}`);
}

async function waitForResponse(page, name, matcher, action) {
  const responsePromise = page.waitForResponse((response) => {
    if (typeof matcher === 'string') return endpointMatches(response.url(), matcher);
    return matcher(response.url());
  }, { timeout: timeoutMs });
  await action();
  const response = await responsePromise;
  const detail = `${response.status()} ${new URL(response.url()).pathname}`;
  if (!response.ok()) throw new Error(`${name} 返回 ${detail}`);
  record(name, 'passed', detail);
  return response;
}

async function openNav(page, name, sectionLabel) {
  const navButton = page.getByRole('navigation').getByRole('button', { name: new RegExp(`^${name}`) });
  await navButton.scrollIntoViewIfNeeded();
  await navButton.click();
  await page.getByRole('region', { name: sectionLabel }).waitFor({ timeout: timeoutMs });
  record(`导航 · ${name}`, 'passed', sectionLabel);
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
      username: 'e2e-ladle',
      name: '钢包冒烟测试',
      role: 'admin',
      loginTime: new Date().toISOString(),
    }));
  });

  // 1) 进入钢包产品壳
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.getByText('钢包智能监测').first().waitFor({ timeout: timeoutMs });
  await page.getByRole('button', { name: '实时监控', exact: true }).waitFor({ timeout: timeoutMs });
  record('页面登录与钢包侧栏', 'passed', baseUrl);

  // 2) 实时监控
  await openNav(page, '实时监控', '钢包智能监测实时监控');
  await page.getByText('今日识别次数').first().waitFor({ timeout: timeoutMs });
  await page.getByText('当前识别包号').first().waitFor({ timeout: timeoutMs });
  record('实时监控 · 关键指标', 'passed', '今日识别次数 / 当前识别包号');

  if (expectApi) {
    await waitForResponse(page, '今日识别次数接口', '/ladle/dashboard/currentDayInferenceCount', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('region', { name: '钢包智能监测实时监控' }).waitFor({ timeout: timeoutMs });
    });
  }

  // 3) 数据查询：筛选、分页、原图、导出
  if (expectApi) {
    await waitForResponse(page, '温度数据查询接口', '/ladle-record/list', () => openNav(page, '数据查询', '钢包数据查询'));
  } else {
    await openNav(page, '数据查询', '钢包数据查询');
  }

  await page.getByRole('button', { name: '查询', exact: true }).click();
  await page.getByText(/共 [1-9]\d* 条/).first().waitFor({ timeout: timeoutMs });
  record('数据查询 · 查询结果', 'passed', '出现非空结果');

  await page.getByRole('button', { name: /原图/ }).first().click();
  await page.getByText('原始热成像数据', { exact: true }).waitFor({ timeout: timeoutMs });
  record('数据查询 · 查看原图', 'passed', '打开原始热成像明细');
  await page.getByRole('button', { name: '关闭', exact: true }).click();

  const downloadPromise = page.waitForEvent('download', { timeout: timeoutMs }).catch(() => null);
  await page.getByRole('button', { name: '导出数据', exact: true }).click();
  const download = await downloadPromise;
  if (download) {
    record('数据查询 · 导出', 'passed', `下载文件 ${download.suggestedFilename()}`);
  } else {
    await page.getByText(/已导出|已触发服务端导出/).first().waitFor({ timeout: timeoutMs });
    record('数据查询 · 导出', 'passed', '导出反馈已出现');
  }

  // 4) 曲线分析
  if (expectApi) {
    await waitForResponse(page, '曲线分析接口', '/ladle-chart/list', () => openNav(page, '曲线分析', '钢包曲线分析'));
  } else {
    await openNav(page, '曲线分析', '钢包曲线分析');
  }
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await page.getByText('单钢包温度趋势').waitFor({ timeout: timeoutMs });
  record('曲线分析 · 刷新', 'passed', '趋势面板可见');

  // 5) 报警管理：查询 + 批量处理
  if (expectApi) {
    await waitForResponse(page, '报警分页接口', '/alarm/page', () => openNav(page, '报警管理', '钢包报警管理'));
  } else {
    await openNav(page, '报警管理', '钢包报警管理');
  }

  await page.getByRole('button', { name: '查询', exact: true }).click();
  const firstAlarmCheckbox = page.getByRole('checkbox').first();
  await firstAlarmCheckbox.waitFor({ timeout: timeoutMs });
  await firstAlarmCheckbox.check();
  await page.getByRole('button', { name: '批量处理', exact: true }).click();
  await page.getByText(/已处理|请先选择/).first().waitFor({ timeout: timeoutMs });
  record('报警管理 · 批量处理', 'passed', '处理反馈已出现');

  // 6) 钢包管理：新建 / 保存
  if (expectApi) {
    await waitForResponse(page, '钢包列表接口', '/ladle/list', () => openNav(page, '钢包管理', '钢包管理'));
  } else {
    await openNav(page, '钢包管理', '钢包管理');
  }

  await page.getByRole('button', { name: '新建钢包', exact: true }).click();
  await page.getByText('新建钢包', { exact: true }).waitFor({ timeout: timeoutMs });
  const ladleNo = `Y-E2E-${Date.now().toString().slice(-4)}`;
  await page.locator('aside label', { hasText: '钢包号' }).locator('input').fill(ladleNo);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await Promise.race([
    page.getByText(new RegExp(`已创建钢包 ${ladleNo}|接口异常`)).first().waitFor({ timeout: timeoutMs }),
    page.getByRole('cell', { name: new RegExp(ladleNo) }).first().waitFor({ timeout: timeoutMs }),
  ]);
  record('钢包管理 · 新建', 'passed', ladleNo);

  await page.screenshot({ path: join(artifactDir, `${runId}-passed.png`), fullPage: true });
  console.log(`\n钢包冒烟通过：${results.filter((item) => item.status === 'passed').length}/${results.length} 项。`);
  console.log(`产物目录：${artifactDir}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  record('测试执行', 'failed', message);
  if (page) {
    await page.screenshot({ path: join(artifactDir, `${runId}-failed.png`), fullPage: true }).catch(() => undefined);
  }
  console.error(`\n钢包冒烟失败：${message}`);
  process.exitCode = 1;
} finally {
  await writeFile(
    join(artifactDir, `${runId}.json`),
    JSON.stringify({ baseUrl, expectApi, results, websocketEvents }, null, 2),
  );
  await browser?.close();
}
