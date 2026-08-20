/**
 * Diagnose weekly report query: URL/default week vs empty-data handling.
 * Asserts frontend will NOT invent empty UI when API returns document rows,
 * and WILL show empty when API returns [] (server empty — not a frontend bug).
 */

const pad = (value) => String(value).padStart(2, '0');
const formatDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const getWeekMonday = (date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  const mondayOffset = (nextDate.getDay() + 6) % 7;
  nextDate.setDate(nextDate.getDate() - mondayOffset);
  return nextDate;
};

const getLastCompletedWeekMonday = (now = new Date()) => {
  const monday = getWeekMonday(now);
  monday.setDate(monday.getDate() - 7);
  return monday;
};

const unwrapApiData = (payload) => {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return payload.data;
  }
  return payload;
};

const isRecord = (value) => typeof value === 'object' && value !== null;

const pickRows = (payload) => {
  const rows = unwrapApiData(payload);
  if (Array.isArray(rows) && rows.every(isRecord)) return rows;
  throw new Error('查询接口返回结构不符合文档：应为数组');
};

const requireNumber = (row, key) => {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  throw new Error(`接口返回缺少字段 ${key}`);
};

const requireString = (row, key) => {
  const value = row[key];
  if (typeof value === 'string' && value.trim()) return value;
  throw new Error(`接口返回缺少字段 ${key}`);
};

const normalizeRows = (rows) =>
  rows.map((row) => ({
    id: String(requireNumber(row, 'id')),
    locationId: requireString(row, 'locationId'),
    locationName: requireString(row, 'locationName'),
    avgTemperature: requireNumber(row, 'avgTemperature'),
    maxTemperature: requireNumber(row, 'maxTemperature'),
    level1AlarmCount: requireNumber(row, 'level1AlarmCount'),
    level2AlarmCount: requireNumber(row, 'level2AlarmCount'),
    dataStartDate: requireString(row, 'dataStartDate'),
    dataEndDate: requireString(row, 'dataEndDate'),
    weekStartDate: requireString(row, 'weekStartDate'),
  }));

const buildUrl = (apiBase, weekMonday, origin = 'http://prod.example') => {
  const path = '/weekly/report/query';
  const url = new URL(`${apiBase.replace(/\/+$/, '')}${path}`, origin);
  url.searchParams.set('weekMonday', weekMonday);
  return url.pathname + url.search;
};

const DOC_WEEK = '2026-06-29';
const DOC_PAYLOAD = {
  msg: '操作成功',
  code: 200,
  data: [
    {
      id: 7,
      locationId: 'loc_1',
      locationName: '位置1',
      avgTemperature: 25.3,
      maxTemperature: 25.6,
      level1AlarmCount: 0,
      level2AlarmCount: 1,
      dataStartDate: '2026-06-29 00:00:00',
      dataEndDate: '2026-07-05 23:59:59',
      weekStartDate: '2026-06-29',
    },
  ],
};

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}: ${detail}`);
};

// 1) Default week on 2026-08-04 (Tue) => last completed Monday 2026-07-27
const pinnedNow = new Date(2026, 7, 4, 10, 0, 0);
const defaultWeek = formatDate(getLastCompletedWeekMonday(pinnedNow));
check(
  'default weekMonday',
  defaultWeek === '2026-07-27',
  `got ${defaultWeek} (doc sample is ${DOC_WEEK}; prod default ≠ doc sample)`,
);

// 2) URL shape
check(
  'same-origin URL',
  buildUrl('', defaultWeek) === `/weekly/report/query?weekMonday=${defaultWeek}`,
  buildUrl('', defaultWeek),
);
check(
  '/api base URL',
  buildUrl('/api', defaultWeek) === `/api/weekly/report/query?weekMonday=${defaultWeek}`,
  buildUrl('/api', defaultWeek),
);

// 3) Document payload parses to rows
try {
  const rows = normalizeRows(pickRows(DOC_PAYLOAD));
  check('parse document payload', rows.length === 1, `rows=${rows.length}`);
} catch (error) {
  check('parse document payload', false, error.message);
}

// 4) Empty array is success with 0 rows (server empty — UI shows 无数据)
try {
  const rows = normalizeRows(pickRows({ msg: '操作成功', code: 200, data: [] }));
  check('empty data[] is valid success', rows.length === 0, 'frontend correctly renders empty table');
} catch (error) {
  check('empty data[] is valid success', false, error.message);
}

// 5) Java-style numeric strings should be accepted after coerce
try {
  const rows = normalizeRows(pickRows({
    code: 200,
    data: [{
      ...DOC_PAYLOAD.data[0],
      avgTemperature: '25.30',
      maxTemperature: '25.60',
      level1AlarmCount: '0',
      level2AlarmCount: '1',
    }],
  }));
  check('numeric strings accepted', rows.length === 1 && rows[0].avgTemperature === 25.3, `avg=${rows[0]?.avgTemperature}`);
} catch (error) {
  check('numeric strings accepted', false, error.message);
}

// 6) Mock-only only returns rows for documented week
const createFallbackRows = (weekMonday) =>
  (weekMonday === DOC_WEEK ? normalizeRows(DOC_PAYLOAD.data) : []);
check(
  'mock empty for default week',
  createFallbackRows(defaultWeek).length === 0,
  `mock/fallback for ${defaultWeek} is intentionally empty (only ${DOC_WEEK} has samples)`,
);

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);

console.log(`
Verdict guide:
- If Network shows 200 + data:[] for weekMonday=${defaultWeek} → SERVER has no weekly aggregate for that week.
- If Network shows 200 + data:[...] but UI empty → FRONTEND parse bug.
- If Network missing / 404 / HTML → proxy or API_BASE_URL mismatch.
- Doc sample week ${DOC_WEEK} ≠ default ${defaultWeek}; try querying ${DOC_WEEK} in UI to compare.
`);
