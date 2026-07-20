'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Collapse,
  ConfigProvider,
  Descriptions,
  Flex,
  Form,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import {
  DownloadOutlined,
  FileExcelOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';
import type { ColumnsType } from 'antd/es/table';
import { AppDatePicker } from '@/components/AppDatePicker';
import {
  apiMockModeLabel,
  buildApiUrl,
  canUseMockData,
  isMockOnly,
  unwrapApiData,
} from '@/lib/api-config';

dayjs.locale('zh-cn');

interface WeeklyReportApiRow {
  id: number;
  locationId: string;
  locationName: string;
  avgTemperature: number;
  maxTemperature: number;
  level1AlarmCount: number;
  level2AlarmCount: number;
  dataStartDate: string;
  dataEndDate: string;
  weekStartDate: string;
}

interface WeeklyReportRow {
  id: string;
  locationId: string;
  locationName: string;
  avgTemperature: number;
  maxTemperature: number;
  level1AlarmCount: number;
  level2AlarmCount: number;
  dataStartDate: string;
  dataEndDate: string;
  weekStartDate: string;
}

interface WeeklyReportFormValues {
  weekMonday: Dayjs;
}

type QueryStatus = 'idle' | 'loading' | 'success' | 'mock' | 'fallback' | 'error';
type DownloadStatus = 'idle' | 'loading' | 'success' | 'error';

const { Text } = Typography;
const DOCUMENTED_WEEK_MONDAY = '2026-06-29';
const DOCUMENTED_WEEKLY_REPORT_ROWS: WeeklyReportApiRow[] = [
  {
    id: 7,
    locationId: 'loc_1',
    locationName: '位置1',
    avgTemperature: 25.30,
    maxTemperature: 25.60,
    level1AlarmCount: 0,
    level2AlarmCount: 1,
    dataStartDate: '2026-06-29 00:00:00',
    dataEndDate: '2026-07-05 23:59:59',
    weekStartDate: '2026-06-29',
  },
  {
    id: 8,
    locationId: 'loc_2',
    locationName: '位置2',
    avgTemperature: 18.38,
    maxTemperature: 18.60,
    level1AlarmCount: 0,
    level2AlarmCount: 0,
    dataStartDate: '2026-06-29 00:00:00',
    dataEndDate: '2026-07-05 23:59:59',
    weekStartDate: '2026-06-29',
  },
  {
    id: 9,
    locationId: 'loc_3',
    locationName: '位置3',
    avgTemperature: 30.08,
    maxTemperature: 30.30,
    level1AlarmCount: 1,
    level2AlarmCount: 0,
    dataStartDate: '2026-06-29 00:00:00',
    dataEndDate: '2026-07-05 23:59:59',
    weekStartDate: '2026-06-29',
  },
];

const pad = (value: number) => String(value).padStart(2, '0');

const formatDate = (date: Date) => {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-');
};

const parseDateOnly = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getWeekMonday = (date: Date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  const mondayOffset = (nextDate.getDay() + 6) % 7;
  nextDate.setDate(nextDate.getDate() - mondayOffset);
  return nextDate;
};

const getLastCompletedWeekMonday = () => {
  const monday = getWeekMonday(new Date());
  monday.setDate(monday.getDate() - 7);
  return monday;
};

const shiftWeek = (weekMonday: string, offset: number) => {
  const parsed = parseDateOnly(weekMonday) ?? getLastCompletedWeekMonday();
  parsed.setDate(parsed.getDate() + offset * 7);
  return formatDate(parsed);
};

const isWeekMonday = (date: Date) => date.getDay() === 1;

const normalizeWeekMonday = (value: string) => {
  const parsed = parseDateOnly(value);
  if (!parsed || !isWeekMonday(parsed)) return null;
  return formatDate(parsed);
};

const formatDateTimeBrief = (value: string) => {
  if (!value) return '-';
  return value;
};

const formatTemperature = (value: number) => `${value.toFixed(2)} °C`;

const getWeekRangeLabel = (weekMonday: string) => {
  const start = parseDateOnly(weekMonday) ?? getLastCompletedWeekMonday();
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${formatDate(start)} 至 ${formatDate(end)}`;
};

const buildWeeklyReportUrl = (action: 'query' | 'download', weekMonday: string) => {
  return buildApiUrl(`/weekly/report/${action}`, { weekMonday });
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const requireString = (row: WeeklyReportApiRow, key: keyof WeeklyReportApiRow) => {
  const value = row[key];
  if (typeof value === 'string' && value.trim()) return value;
  throw new Error(`接口返回缺少字段 ${key}`);
};

const requireNumber = (row: WeeklyReportApiRow, key: keyof WeeklyReportApiRow) => {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new Error(`接口返回缺少字段 ${key}`);
};

const pickRows = (payload: unknown): WeeklyReportApiRow[] => {
  const rows = unwrapApiData(payload);
  if (Array.isArray(rows) && rows.every(isRecord)) return rows as unknown as WeeklyReportApiRow[];
  throw new Error('查询接口返回结构不符合文档：应为数组');
};

const normalizeRows = (rows: WeeklyReportApiRow[]): WeeklyReportRow[] => {
  return rows.map((row) => {
    return {
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
    };
  });
};

const createFallbackRows = (weekMonday: string): WeeklyReportRow[] => {
  return weekMonday === DOCUMENTED_WEEK_MONDAY
    ? normalizeRows(DOCUMENTED_WEEKLY_REPORT_ROWS)
    : [];
};

const getSummary = (rows: WeeklyReportRow[]) => {
  const totalLevel1 = rows.reduce((sum, row) => sum + row.level1AlarmCount, 0);
  const totalLevel2 = rows.reduce((sum, row) => sum + row.level2AlarmCount, 0);
  const avgTemperature = rows.length
    ? rows.reduce((sum, row) => sum + row.avgTemperature, 0) / rows.length
    : 0;
  const maxTemperature = rows.length ? Math.max(...rows.map((row) => row.maxTemperature)) : 0;

  return {
    locationCount: rows.length,
    avgTemperature,
    maxTemperature,
    totalAlarms: totalLevel1 + totalLevel2,
    totalLevel1,
    totalLevel2,
  };
};

const getFilenameFromDisposition = (disposition: string | null) => {
  if (!disposition) return null;

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1].replace(/["']/g, ''));
  }

  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] ?? null;
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

export default function WeeklyReportQuery() {
  const defaultWeek = useMemo(() => formatDate(getLastCompletedWeekMonday()), []);
  const [form] = Form.useForm<WeeklyReportFormValues>();
  const [draftWeekMonday, setDraftWeekMonday] = useState(defaultWeek);
  const [activeWeekMonday, setActiveWeekMonday] = useState(defaultWeek);
  const [rows, setRows] = useState<WeeklyReportRow[]>([]);
  const [status, setStatus] = useState<QueryStatus>('idle');
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');
  const [message, setMessage] = useState('');
  const [downloadMessage, setDownloadMessage] = useState('');
  const [lastQueryUrl, setLastQueryUrl] = useState('');
  const [lastDownloadUrl, setLastDownloadUrl] = useState('');

  const summary = useMemo(() => getSummary(rows), [rows]);
  const weekRangeLabel = useMemo(() => getWeekRangeLabel(activeWeekMonday), [activeWeekMonday]);
  const tableRows = rows;

  const isLoading = status === 'loading';
  const isMock = status === 'mock';
  const isFallback = status === 'fallback';
  const isError = status === 'error';
  const hasMockRows = (isMock || isFallback) && rows.length > 0;
  const isDownloading = downloadStatus === 'loading';
  const queryStatusLabel = isLoading
    ? '查询中'
    : isMock
      ? apiMockModeLabel.mock
      : isFallback
        ? '接口失败 · 样例'
        : isError
          ? '接口失败'
          : status === 'success'
            ? '接口数据'
            : '待查询';
  const queryTagColor = isLoading
    ? 'processing'
    : isMock || isFallback
      ? 'gold'
      : isError
        ? 'red'
        : status === 'success'
          ? 'green'
          : 'default';
  const alarmTagColor = summary.totalLevel1 > 0 ? 'red' : summary.totalAlarms > 0 ? 'gold' : 'green';

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeeklyReport() {
      setStatus('loading');
      setMessage('');

      const requestUrl = buildWeeklyReportUrl('query', activeWeekMonday);
      setLastQueryUrl(requestUrl.pathname + requestUrl.search);

      if (isMockOnly) {
        setRows(createFallbackRows(activeWeekMonday));
        setStatus('mock');
        setMessage('');
        return;
      }

      try {
        const response = await fetch(requestUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json() as unknown;
        const normalized = normalizeRows(pickRows(payload));
        setRows(normalized);
        setStatus('success');
      } catch (error) {
        if (controller.signal.aborted) return;

        const fallbackRows = canUseMockData ? createFallbackRows(activeWeekMonday) : [];
        setRows(fallbackRows);
        setStatus(canUseMockData ? 'fallback' : 'error');
        setMessage(error instanceof Error ? error.message : '接口请求失败');
      }
    }

    loadWeeklyReport();

    return () => controller.abort();
  }, [activeWeekMonday]);

  const submitQuery = (values?: WeeklyReportFormValues) => {
    const formValue = values?.weekMonday?.format('YYYY-MM-DD') ?? draftWeekMonday;
    const normalized = normalizeWeekMonday(formValue);
    if (!normalized) {
      setMessage('weekMonday 必须是自然周周一日期');
      return;
    }

    setDraftWeekMonday(normalized);
    setActiveWeekMonday(normalized);
    setDownloadStatus('idle');
    setDownloadMessage('');
  };

  const applyQuickWeek = (weekMonday: string) => {
    setDraftWeekMonday(weekMonday);
    setActiveWeekMonday(weekMonday);
    setDownloadStatus('idle');
    setDownloadMessage('');
    form.setFieldsValue({ weekMonday: dayjs(weekMonday) });
  };

  const downloadWeeklyReport = async () => {
    setDownloadStatus('loading');
    setDownloadMessage('');

    const requestUrl = buildWeeklyReportUrl('download', activeWeekMonday);
    const requestPath = requestUrl.pathname + requestUrl.search;
    setLastDownloadUrl(requestPath);

    if (isMockOnly) {
      setDownloadStatus('error');
      setDownloadMessage('Mock 模式不提供真实下载流，请切换 NEXT_PUBLIC_API_MOCK_MODE');
      return;
    }

    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      const defaultFilename = `weekly-report-${activeWeekMonday}.xlsx`;

      if (contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`下载接口返回 JSON，但文档要求 http 流直接下载：${text.slice(0, 80)}`);
      }

      const filename = getFilenameFromDisposition(response.headers.get('content-disposition')) ?? defaultFilename;
      const blob = await response.blob();
      triggerBlobDownload(blob, filename);
      setDownloadStatus('success');
      setDownloadMessage('周报文件已下载');
    } catch (error) {
      setDownloadStatus('error');
      setDownloadMessage(error instanceof Error ? error.message : '下载失败');
    }
  };

  const columns: ColumnsType<WeeklyReportRow> = [
    {
      title: '位置',
      dataIndex: 'locationName',
      fixed: 'left',
      width: 150,
      render: (_, row) => (
        <Flex vertical gap={0}>
          <Text strong>{row.locationName}</Text>
          <Text type="secondary">{row.locationId}</Text>
        </Flex>
      ),
    },
    {
      title: '平均温度',
      dataIndex: 'avgTemperature',
      width: 120,
      align: 'right',
      sorter: (left, right) => left.avgTemperature - right.avgTemperature,
      render: (value: number) => formatTemperature(value),
    },
    {
      title: '最高温度',
      dataIndex: 'maxTemperature',
      width: 120,
      align: 'right',
      sorter: (left, right) => left.maxTemperature - right.maxTemperature,
      render: (value: number) => formatTemperature(value),
    },
    {
      title: '一级报警',
      dataIndex: 'level1AlarmCount',
      width: 110,
      align: 'center',
      sorter: (left, right) => left.level1AlarmCount - right.level1AlarmCount,
      render: (value: number) => (
        value > 0 ? <Tag color="red">{value}</Tag> : <Text type="secondary">0</Text>
      ),
    },
    {
      title: '二级报警',
      dataIndex: 'level2AlarmCount',
      width: 110,
      align: 'center',
      sorter: (left, right) => left.level2AlarmCount - right.level2AlarmCount,
      render: (value: number) => (
        value > 0 ? <Tag color="gold">{value}</Tag> : <Text type="secondary">0</Text>
      ),
    },
    {
      title: '数据时间',
      key: 'dataWindow',
      width: 260,
      render: (_, row) => (
        <Text type="secondary">
          {formatDateTimeBrief(row.dataStartDate)} 至 {formatDateTimeBrief(row.dataEndDate)}
        </Text>
      ),
    },
  ];

  const alertContent = isMock
    ? hasMockRows
      ? '当前使用 Mock 模式，展示文档样例数据'
      : `当前使用 Mock 模式，文档仅提供 ${DOCUMENTED_WEEK_MONDAY} 样例数据`
    : status === 'fallback' && message
    ? hasMockRows
      ? `接口未连通，当前展示文档样例数据：${message}`
      : `接口未连通，且文档仅提供 ${DOCUMENTED_WEEK_MONDAY} 样例数据：${message}`
    : isError && message
      ? `接口请求失败，Mock 已关闭：${message}`
    : message || downloadMessage;

  const downloadStatusText = isDownloading
    ? '生成中'
    : downloadStatus === 'success'
      ? '已发起'
      : downloadStatus === 'error'
        ? '失败'
        : '待下载';

  return (
    <ConfigProvider
      locale={zhCN}
      componentSize="middle"
      theme={{
        algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
        token: {
          colorPrimary: '#1677ff',
          colorBgContainer: '#111111',
          colorBgElevated: '#161616',
          colorBorder: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 6,
          wireframe: false,
        },
        components: {
          Card: {
            headerBg: 'transparent',
          },
          Table: {
            headerBg: '#1a1a1a',
            rowHoverBg: 'rgba(255, 255, 255, 0.04)',
          },
        },
      }}
    >
      <Flex vertical gap={12} className="weekly-ant-page" aria-label="查询周报">
        <Card
          className="weekly-workbench"
          title={(
            <Space size={8}>
              <FileExcelOutlined />
              <span>周报</span>
              <Text type="secondary">{weekRangeLabel}</Text>
            </Space>
          )}
          extra={(
            <Space size={8} wrap>
              <Tag color={queryTagColor}>{queryStatusLabel}</Tag>
              <Tag color={alarmTagColor}>{summary.totalAlarms} 次报警</Tag>
              <Button
                type="primary"
                ghost
                icon={<DownloadOutlined />}
                loading={isDownloading}
                onClick={downloadWeeklyReport}
              >
                下载周报
              </Button>
            </Space>
          )}
        >
          <Flex vertical gap={12}>
            <Form<WeeklyReportFormValues>
              form={form}
              layout="inline"
              initialValues={{ weekMonday: dayjs(defaultWeek) }}
              onFinish={submitQuery}
              className="weekly-query-form"
            >
              <Form.Item
                label="周一日期"
                name="weekMonday"
                rules={[{ required: true, message: '请选择自然周周一' }]}
              >
                <AppDatePicker
                  disabledDate={(current) => Boolean(current && current.day() !== 1)}
                  onChange={(value) => {
                    if (value) setDraftWeekMonday(value.format('YYYY-MM-DD'));
                  }}
                />
              </Form.Item>

              <Form.Item>
                <Space.Compact>
                  <Button onClick={() => applyQuickWeek(formatDate(getLastCompletedWeekMonday()))}>
                    上周
                  </Button>
                  <Button onClick={() => applyQuickWeek(shiftWeek(activeWeekMonday, -1))}>
                    前一周
                  </Button>
                  <Button onClick={() => applyQuickWeek(shiftWeek(activeWeekMonday, 1))}>
                    后一周
                  </Button>
                </Space.Compact>
              </Form.Item>

              <Form.Item className="weekly-main-actions">
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SearchOutlined />}
                    loading={isLoading}
                  >
                    查询
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    loading={isLoading}
                    onClick={() => submitQuery({ weekMonday: dayjs(activeWeekMonday) })}
                  >
                    刷新
                  </Button>
                </Space>
              </Form.Item>
            </Form>

            {alertContent && (
              <Alert
                showIcon
                type={status === 'fallback' || downloadStatus === 'error' ? 'warning' : 'success'}
                title={alertContent}
              />
            )}

            <div className="weekly-summary-strip">
              <Statistic title="位置" value={summary.locationCount} />
              <Statistic title="平均温度" value={summary.avgTemperature} precision={2} suffix="°C" />
              <Statistic title="最高温度" value={summary.maxTemperature} precision={2} suffix="°C" />
              <Statistic
                title="一级报警"
                value={summary.totalLevel1}
                styles={{ content: { color: summary.totalLevel1 > 0 ? '#ff7875' : undefined } }}
              />
              <Statistic
                title="二级报警"
                value={summary.totalLevel2}
                styles={{ content: { color: summary.totalLevel2 > 0 ? '#ffd666' : undefined } }}
              />
              <div className="weekly-summary-meta">
                <Text type="secondary">下载状态</Text>
                <Tag color={downloadStatus === 'error' ? 'red' : downloadStatus === 'success' ? 'green' : 'default'}>
                  {downloadStatusText}
                </Tag>
              </div>
            </div>

            <Table<WeeklyReportRow>
              rowKey="id"
              size="small"
              columns={columns}
              dataSource={tableRows}
              loading={isLoading}
              pagination={false}
              scroll={{ x: 780 }}
              summary={() => (
                tableRows.length > 0 ? (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}>
                        <Text strong>合计</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <Text>{formatTemperature(summary.avgTemperature)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <Text>{formatTemperature(summary.maxTemperature)}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="center">
                        <Text>{summary.totalLevel1}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} align="center">
                        <Text>{summary.totalLevel2}</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={5}>
                        <Text type="secondary">{weekRangeLabel}</Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                ) : null
              )}
            />

            <Collapse
              ghost
              size="small"
              className="weekly-debug-collapse"
              items={[
                {
                  key: 'api',
                  label: '接口信息',
                  children: (
                    <Descriptions
                      bordered
                      size="small"
                      column={1}
                      items={[
                        {
                          key: 'query',
                          label: '查询接口',
                          children: (
                            <Tooltip title={lastQueryUrl || '/weekly/report/query'}>
                              <Text code copyable ellipsis className="weekly-endpoint">
                                {lastQueryUrl || '/weekly/report/query'}
                              </Text>
                            </Tooltip>
                          ),
                        },
                        {
                          key: 'download',
                          label: '下载接口',
                          children: (
                            <Tooltip title={lastDownloadUrl || `/weekly/report/download?weekMonday=${activeWeekMonday}`}>
                              <Text code copyable ellipsis className="weekly-endpoint">
                                {lastDownloadUrl || `/weekly/report/download?weekMonday=${activeWeekMonday}`}
                              </Text>
                            </Tooltip>
                          ),
                        },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </Flex>
        </Card>

        <style jsx>{`
          .weekly-ant-page {
            min-height: 100%;
          }

          .weekly-ant-page :global(.ant-card) {
            box-shadow: none;
          }

          .weekly-workbench :global(.ant-card-body) {
            padding: 14px 16px 16px;
          }

          .weekly-query-form {
            row-gap: 12px;
          }

          .weekly-main-actions {
            margin-left: auto;
          }

          .weekly-endpoint {
            max-width: 100%;
          }

          .weekly-summary-strip {
            display: grid;
            grid-template-columns: 0.7fr repeat(4, minmax(120px, 1fr)) minmax(120px, 0.8fr);
            gap: 0;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 6px;
            overflow: hidden;
          }

          .weekly-summary-strip :global(.ant-statistic),
          .weekly-summary-meta {
            min-height: 64px;
            padding: 10px 14px;
            border-right: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(255, 255, 255, 0.018);
          }

          .weekly-summary-strip :global(.ant-statistic:last-child),
          .weekly-summary-meta {
            border-right: none;
          }

          .weekly-summary-meta {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 6px;
          }

          .weekly-debug-collapse {
            border-top: 1px solid rgba(255, 255, 255, 0.06);
          }

          @media (max-width: 980px) {
            .weekly-main-actions {
              margin-left: 0;
            }

            .weekly-query-form :global(.ant-form-item) {
              width: 100%;
              margin-right: 0;
            }

            .weekly-query-form :global(.ant-picker),
            .weekly-query-form :global(.ant-btn) {
              width: 100%;
            }

            .weekly-query-form :global(.ant-space-compact) {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              width: 100%;
            }

            .weekly-summary-strip {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
        `}</style>
      </Flex>
    </ConfigProvider>
  );
}
