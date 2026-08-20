'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';
import zhCN from 'antd/locale/zh_CN';
import type { TableColumnsType } from 'antd';
import * as echarts from 'echarts';
import type { EChartsOption, EChartsType } from 'echarts';
import { AppDateTimePicker } from '@/components/AppDatePicker';
import AntdStyleRegistry from '@/components/AntdStyleRegistry';
import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  Descriptions,
  Empty,
  Form,
  Row,
  Segmented,
  Select,
  Statistic,
  Table,
  theme,
} from 'antd';
import {
  buildApiUrl,
  canUseMockData,
  isMockOnly,
  unwrapApiData,
} from '@/lib/api-config';

dayjs.locale('zh-cn');

interface ReportLocation {
  id: string;
  name: string;
}

interface ReportFilters {
  locationId: string;
  locationName: string;
  startTime: Date;
  endTime: Date;
  periodMinutes: number;
}

interface TemperatureTrendPoint {
  id: string;
  timestamp: number;
  statTime: string;
  locationId: string;
  locationName: string;
  avgTemperature: number;
}

type QueryStatus = 'idle' | 'loading' | 'success' | 'mock' | 'fallback' | 'error';

interface TemperatureChartProps {
  option: EChartsOption;
  label: string;
}

interface EChartTooltipParam {
  value?: unknown;
  dataIndex?: number;
  axisValue?: string | number;
}

const PERIOD_OPTIONS = [1, 2, 5, 10, 30, 60, 120, 360];

const QUICK_RANGES = [
  { label: '1小时', minutes: 60, periodMinutes: 2 },
  { label: '6小时', minutes: 360, periodMinutes: 10 },
  { label: '24小时', minutes: 1440, periodMinutes: 60 },
  { label: '7天', minutes: 10080, periodMinutes: 360 },
];

const pad = (value: number) => String(value).padStart(2, '0');

const formatApiDateTime = (date: Date) => {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const DOCUMENTED_TREND_QUERY = {
  locationId: 'loc_2',
  locationName: '位置2',
  startTime: new Date('2026-07-01T10:00:00'),
  endTime: new Date('2026-07-01T10:10:59'),
  periodMinutes: 2,
};

const DOCUMENTED_TREND_ROWS = [
  {
    statTime: '2026-07-01 10:00:00',
    locationId: 'loc_2',
    locationName: '位置2',
    avgTemperature: 18.525000,
  },
  {
    statTime: '2026-07-01 10:02:00',
    locationId: 'loc_2',
    locationName: '位置2',
    avgTemperature: 18.525000,
  },
  {
    statTime: '2026-07-01 10:04:00',
    locationId: 'loc_2',
    locationName: '位置2',
    avgTemperature: 18.375000,
  },
  {
    statTime: '2026-07-01 10:06:00',
    locationId: 'loc_2',
    locationName: '位置2',
    avgTemperature: 18.275000,
  },
  {
    statTime: '2026-07-01 10:08:00',
    locationId: 'loc_2',
    locationName: '位置2',
    avgTemperature: 18.175000,
  },
];

const DEFAULT_LIVE_RANGE = QUICK_RANGES[0];

const createLiveDefaultFilters = (): ReportFilters => {
  const endTime = new Date();
  endTime.setSeconds(0, 0);
  const startTime = new Date(endTime.getTime() - DEFAULT_LIVE_RANGE.minutes * 60000);

  return {
    locationId: DOCUMENTED_TREND_QUERY.locationId,
    locationName: DOCUMENTED_TREND_QUERY.locationName,
    startTime,
    endTime,
    periodMinutes: DEFAULT_LIVE_RANGE.periodMinutes,
  };
};

const createDefaultFilters = (): ReportFilters => {
  // Local mock keeps the documented sample query so bundled rows can render.
  // Deploy / real API mode queries a recent window and renders whatever /temperature/trend returns.
  if (isMockOnly) {
    return {
      locationId: DOCUMENTED_TREND_QUERY.locationId,
      locationName: DOCUMENTED_TREND_QUERY.locationName,
      startTime: new Date(DOCUMENTED_TREND_QUERY.startTime),
      endTime: new Date(DOCUMENTED_TREND_QUERY.endTime),
      periodMinutes: DOCUMENTED_TREND_QUERY.periodMinutes,
    };
  }

  return createLiveDefaultFilters();
};

const getRangeLabel = (filters: ReportFilters) => {
  const durationMinutes = Math.max(
    1,
    Math.round((filters.endTime.getTime() - filters.startTime.getTime()) / 60000)
  );
  if (durationMinutes < 60) return `${durationMinutes}分钟`;
  if (durationMinutes < 1440) return `${Math.round(durationMinutes / 60)}小时`;
  return `${Math.round(durationMinutes / 1440)}天`;
};

const formatAxisTime = (timestamp: number, filters: ReportFilters) => {
  const date = new Date(timestamp);
  const durationMinutes = Math.round(
    (filters.endTime.getTime() - filters.startTime.getTime()) / 60000
  );

  if (durationMinutes > 1440) {
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDisplayDateTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatTemperature = (value: number, digits = 2) => `${value.toFixed(digits)} °C`;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const requireString = (row: TemperatureTrendPoint, key: keyof TemperatureTrendPoint) => {
  const value = row[key];
  if (typeof value === 'string' && value.trim()) return value;
  throw new Error(`接口返回缺少字段 ${key}`);
};

const requireNumber = (row: TemperatureTrendPoint, key: keyof TemperatureTrendPoint) => {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new Error(`接口返回缺少字段 ${key}`);
};

const pickTrendRows = (payload: unknown): TemperatureTrendPoint[] => {
  const rows = unwrapApiData(payload);
  if (Array.isArray(rows) && rows.every(isRecord)) return rows as unknown as TemperatureTrendPoint[];
  throw new Error('温度趋势接口返回结构不符合文档：应为数组');
};

const normalizeTrendRows = (rows: TemperatureTrendPoint[]) => {
  return rows.map((row) => {
    const statTime = requireString(row, 'statTime');
    const locationId = requireString(row, 'locationId');
    const timestamp = new Date(statTime.replace(' ', 'T')).getTime();

    return {
      id: `${locationId}-${statTime}`,
      timestamp: Number.isNaN(timestamp) ? Date.now() : timestamp,
      statTime,
      locationId,
      locationName: requireString(row, 'locationName'),
      avgTemperature: requireNumber(row, 'avgTemperature'),
    };
  });
};

const mergeReportLocations = (...groups: ReportLocation[][]): ReportLocation[] => {
  const locations = new Map<string, ReportLocation>();

  groups.flat().forEach((location) => {
    if (location.id.trim() && location.name.trim()) {
      locations.set(location.id, location);
    }
  });

  return Array.from(locations.values());
};

const getReportLocations = (rows: TemperatureTrendPoint[]): ReportLocation[] => {
  return mergeReportLocations(
    rows.map((row) => ({ id: row.locationId, name: row.locationName }))
  );
};

const buildTemperatureTrendUrl = (filters: ReportFilters) => {
  return buildApiUrl('/temperature/trend', {
    locationId: filters.locationId,
    startTime: formatApiDateTime(filters.startTime),
    endTime: formatApiDateTime(filters.endTime),
    periodMinutes: filters.periodMinutes,
  });
};

const queryDocumentTrendData = (filters: ReportFilters): TemperatureTrendPoint[] => {
  const isDocumentedQuery =
    filters.locationId === DOCUMENTED_TREND_QUERY.locationId &&
    formatApiDateTime(filters.startTime) === formatApiDateTime(DOCUMENTED_TREND_QUERY.startTime) &&
    formatApiDateTime(filters.endTime) === formatApiDateTime(DOCUMENTED_TREND_QUERY.endTime) &&
    filters.periodMinutes === DOCUMENTED_TREND_QUERY.periodMinutes;

  if (!isDocumentedQuery) return [];

  return DOCUMENTED_TREND_ROWS.map((row) => {
    const timestamp = new Date(row.statTime.replace(' ', 'T')).getTime();

    return {
      id: `${row.locationId}-${row.statTime}`,
      timestamp,
      ...row,
    };
  });
};

const getSummary = (data: TemperatureTrendPoint[]) => {
  if (data.length === 0) {
    return {
      avg: 0,
      max: 0,
      min: 0,
      latest: 0,
      delta: 0,
      span: 0,
    };
  }

  const values = data.map((point) => point.avgTemperature);
  const latest = values[values.length - 1];
  const first = values[0];

  return {
    avg: values.reduce((sum, value) => sum + value, 0) / values.length,
    max: Math.max(...values),
    min: Math.min(...values),
    latest,
    delta: latest - first,
    span: Math.max(...values) - Math.min(...values),
  };
};

const toDate = (value: Dayjs | null, fallback: Date) => {
  return value?.isValid() ? value.toDate() : fallback;
};

const getEChartTooltipParam = (params: unknown): EChartTooltipParam | null => {
  const firstParam = Array.isArray(params) ? params[0] : params;
  if (!firstParam || typeof firstParam !== 'object') return null;
  return firstParam as EChartTooltipParam;
};

const formatTemperatureTooltip = (
  params: unknown,
  points: TemperatureTrendPoint[],
  fallbackLocationName: string
) => {
  const param = getEChartTooltipParam(params);
  if (!param) return '';

  const value = Array.isArray(param.value) ? param.value : [];
  const timestamp = Number(value[0] ?? param.axisValue ?? 0);
  const temperature = Number(value[1] ?? 0);
  const point = typeof param.dataIndex === 'number' ? points[param.dataIndex] : undefined;

  return (
    `<div style="min-width:132px">` +
    `<div style="color:rgba(255,255,255,.56);font-size:11px">${formatDisplayDateTime(
      point?.timestamp ?? timestamp
    )}</div>` +
    `<div style="margin-top:4px;color:#d6ebff;font-size:18px;font-weight:650;font-family:monospace">${temperature.toFixed(
      6
    )} °C</div>` +
    `<div style="margin-top:2px;color:rgba(255,255,255,.68);font-size:12px">${point?.locationName ?? fallbackLocationName}</div>` +
    `</div>`
  );
};

function TemperatureEChart({ option, label }: TemperatureChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = echarts.init(containerRef.current, undefined, { renderer: 'canvas' });
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option]);

  return <div ref={containerRef} className="temperature-echart" role="img" aria-label={label} />;
}

export default function TemperatureTrendReport() {
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(() => createDefaultFilters());
  const [activeFilters, setActiveFilters] = useState<ReportFilters>(() => createDefaultFilters());
  const [queryVersion, setQueryVersion] = useState(0);
  const [data, setData] = useState<TemperatureTrendPoint[]>([]);
  const [reportLocations, setReportLocations] = useState<ReportLocation[]>([]);
  const [queryStatus, setQueryStatus] = useState<QueryStatus>('idle');
  const [queryMessage, setQueryMessage] = useState('');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const rangeLabel = useMemo(() => getRangeLabel(activeFilters), [activeFilters]);
  const draftRangeLabel = useMemo(() => getRangeLabel(draftFilters), [draftFilters]);
  const selectedQuickRange = QUICK_RANGES.some((range) => range.label === draftRangeLabel)
    ? draftRangeLabel
    : undefined;
  const summary = useMemo(() => getSummary(data), [data]);
  const latestRows = useMemo(() => [...data].slice(-6).reverse(), [data]);
  const latestPoint = data[data.length - 1];
  const activeLocationName = useMemo(() => {
    return data.find((point) => point.locationId === activeFilters.locationId)?.locationName
      ?? reportLocations.find((location) => location.id === activeFilters.locationId)?.name
      ?? activeFilters.locationName;
  }, [activeFilters.locationId, activeFilters.locationName, data, reportLocations]);
  const availableLocations = useMemo(() => {
    const draftLocation = reportLocations.find((location) => location.id === draftFilters.locationId);

    return mergeReportLocations(
      reportLocations,
      [{
        id: draftFilters.locationId,
        name: draftLocation?.name ?? draftFilters.locationName,
      }]
    );
  }, [draftFilters.locationId, draftFilters.locationName, reportLocations]);
  const isInvalidRange = draftFilters.startTime >= draftFilters.endTime;
  const isActiveRangeInvalid = activeFilters.startTime >= activeFilters.endTime;
  const queryWindow = `${formatApiDateTime(activeFilters.startTime)} 至 ${formatApiDateTime(activeFilters.endTime)}`;
  const samplingLabel = `${activeFilters.periodMinutes} 分钟/点`;
  const queryStatusText = queryStatus === 'loading'
    ? '查询中'
    : queryStatus === 'success'
      ? '已加载'
      : queryStatus === 'mock'
        ? '演示数据'
        : queryStatus === 'fallback'
          ? '备用数据'
          : queryStatus === 'error'
            ? '加载失败'
            : '待查询';

  const tableColumns = useMemo<TableColumnsType<TemperatureTrendPoint>>(
    () => [
      {
        title: '时间',
        dataIndex: 'timestamp',
        key: 'timestamp',
        render: (timestamp: number) => formatDisplayDateTime(timestamp),
      },
      {
        title: '位置',
        dataIndex: 'locationName',
        key: 'locationName',
      },
      {
        title: '平均温度',
        dataIndex: 'avgTemperature',
        key: 'avgTemperature',
        align: 'right',
        render: (value: number) => formatTemperature(value),
      },
    ],
    []
  );

  const chartOption = useMemo<EChartsOption>(() => {
    const values = data.map((point) => point.avgTemperature);
    const minValue = values.length ? Math.min(...values) : 0;
    const maxValue = values.length ? Math.max(...values) : 0;
    const yStep = maxValue < 100 ? 0.1 : 5;
    const yPrecision = maxValue < 100 ? 1 : 0;
    const yPadding = Math.max(yStep * 2, (maxValue - minValue) * 0.35);
    const yMin = Math.floor((minValue - yPadding) / yStep) * yStep;
    const yMax = Math.ceil((maxValue + yPadding) / yStep) * yStep;

    return {
      backgroundColor: 'transparent',
      animation: !prefersReducedMotion,
      animationDuration: 420,
      color: ['#1677ff'],
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: 'rgba(8, 12, 18, 0.96)',
        borderColor: 'rgba(22,119,255,0.35)',
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: 'rgba(255,255,255,0.88)', fontSize: 12 },
        axisPointer: {
          type: 'line',
          lineStyle: { color: 'rgba(22,119,255,0.34)', width: 1 },
        },
        formatter: (params: unknown) => formatTemperatureTooltip(params, data, activeLocationName),
      },
      grid: { left: 50, right: 24, top: 24, bottom: 30 },
      xAxis: {
        type: 'time',
        min: activeFilters.startTime.getTime(),
        max: activeFilters.endTime.getTime(),
        axisLabel: {
          color: 'rgba(255,255,255,0.45)',
          fontSize: 11,
          hideOverlap: true,
          formatter: (value: string | number) => formatAxisTime(Number(value), activeFilters),
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.12)' } },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '°C',
        min: yMin,
        max: yMax,
        splitNumber: 4,
        nameTextStyle: { color: 'rgba(255,255,255,0.28)', fontSize: 11, padding: [0, 0, 0, 4] },
        axisLabel: {
          color: 'rgba(255,255,255,0.45)',
          fontSize: 11,
          formatter: (value: string | number) => `${Number(value).toFixed(yPrecision)}`,
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      },
      series: [
        {
          name: '平均温度',
          type: 'line',
          smooth: true,
          data: data.map((point) => [point.timestamp, point.avgTemperature]),
          symbol: 'circle',
          symbolSize: data.length > 80 ? 0 : 5,
          showSymbol: data.length <= 80,
          lineStyle: { color: '#1677ff', width: 2.6 },
          itemStyle: { color: '#1677ff', borderColor: '#8cc8ff', borderWidth: 1 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(22,119,255,0.26)' },
                { offset: 1, color: 'rgba(22,119,255,0.02)' },
              ],
            },
          },
          emphasis: { focus: 'series', scale: false },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: 'rgba(255,255,255,0.34)', type: 'dashed', width: 1 },
            label: {
              color: 'rgba(255,255,255,0.54)',
              fontSize: 11,
              formatter: `均值 ${summary.avg.toFixed(1)}°C`,
              position: 'insideEndTop',
            },
            data: [{ yAxis: Number(summary.avg.toFixed(2)) }],
          },
        },
      ],
    };
  }, [activeFilters, activeLocationName, data, prefersReducedMotion, summary.avg]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTrendData() {
      if (isActiveRangeInvalid) {
        setData([]);
        setQueryStatus('idle');
        setQueryMessage('');
        return;
      }

      if (isMockOnly) {
        const rows = queryDocumentTrendData(activeFilters);
        setData(rows);
        setReportLocations((current) => mergeReportLocations(current, getReportLocations(rows)));
        setQueryStatus('mock');
        setQueryMessage('');
        return;
      }

      setQueryStatus('loading');
      setQueryMessage('');

      try {
        const response = await fetch(buildTemperatureTrendUrl(activeFilters), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json() as unknown;
        const rows = normalizeTrendRows(pickTrendRows(payload));
        setData(rows);
        setReportLocations((current) => mergeReportLocations(current, getReportLocations(rows)));
        setQueryStatus('success');
      } catch (error) {
        if (controller.signal.aborted) return;

        const rows = canUseMockData ? queryDocumentTrendData(activeFilters) : [];
        setData(rows);
        setReportLocations((current) => mergeReportLocations(current, getReportLocations(rows)));
        setQueryStatus(canUseMockData ? 'fallback' : 'error');
        setQueryMessage(canUseMockData ? '数据加载异常，已展示备用数据' : '加载失败，请稍后重试');
      }
    }

    loadTrendData();

    return () => controller.abort();
  }, [activeFilters, isActiveRangeInvalid, queryVersion]);

  const updateLocation = (locationId: string) => {
    const location = availableLocations.find((item) => item.id === locationId);
    if (!location) return;

    setDraftFilters((current) => ({
      ...current,
      locationId: location.id,
      locationName: location.name,
    }));
  };

  const cloneFilters = (filters: ReportFilters): ReportFilters => ({
    ...filters,
    startTime: new Date(filters.startTime),
    endTime: new Date(filters.endTime),
  });

  const applyQuickRange = (label: string | number) => {
    const range = QUICK_RANGES.find((item) => item.label === label);
    if (!range) return;

    const endTime = new Date();
    endTime.setSeconds(0, 0);
    const startTime = new Date(endTime.getTime() - range.minutes * 60000);
    const nextFilters = {
      ...draftFilters,
      startTime,
      endTime,
      periodMinutes: range.periodMinutes,
    };

    // Keep draft/active as distinct objects so a later「查询」is never a React no-op.
    setDraftFilters(nextFilters);
    setActiveFilters(cloneFilters(nextFilters));
    setQueryVersion((current) => current + 1);
  };

  const submitFilters = () => {
    if (isInvalidRange) {
      return;
    }
    // Always clone + bump version so identical filters still re-hit /temperature/trend.
    setActiveFilters(cloneFilters(draftFilters));
    setQueryVersion((current) => current + 1);
  };

  return (
    <AntdStyleRegistry>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          colorBgBase: '#050505',
          colorBgContainer: '#121212',
          colorBgElevated: '#1a1a1a',
          colorBorder: 'rgba(255,255,255,0.10)',
          colorText: 'rgba(255,255,255,0.88)',
          colorTextSecondary: 'rgba(255,255,255,0.58)',
          colorTextTertiary: 'rgba(255,255,255,0.38)',
          borderRadius: 8,
          fontFamily: 'var(--font-sans)',
        },
        components: {
          Card: {
            colorBgContainer: '#111111',
            paddingLG: 16,
          },
          Table: {
            colorBgContainer: '#111111',
            colorFillAlter: 'rgba(255,255,255,0.035)',
            borderColor: 'rgba(255,255,255,0.08)',
          },
          Form: {
            labelColor: 'rgba(255,255,255,0.50)',
          },
        },
      }}
    >
      <section className="reports-shell" aria-label="报表分析">
        <Card className="query-card" variant="outlined">
          <div className="query-head">
            <div>
              <h2>温度趋势</h2>
              <p>{activeLocationName} · {rangeLabel} · {samplingLabel} · {queryStatusText}</p>
            </div>
            <div className="quick-row">
              <span>常用范围</span>
              <Segmented
                value={selectedQuickRange ?? ''}
                options={QUICK_RANGES.map((range) => range.label)}
                onChange={applyQuickRange}
              />
            </div>
          </div>

          <Form layout="vertical" onFinish={submitFilters} requiredMark={false}>
            <Row gutter={[12, 8]} align="bottom">
              <Col xs={24} lg={5}>
                <Form.Item label="位置">
                  <Select
                    value={draftFilters.locationId}
                    options={availableLocations.map((location) => ({
                      value: location.id,
                      label: location.name,
                    }))}
                    onChange={updateLocation}
                    aria-label="选择位置"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} lg={5}>
                <Form.Item label="开始时间">
                  <AppDateTimePicker
                    value={dayjs(draftFilters.startTime)}
                    onChange={(value) =>
                      setDraftFilters((current) => ({
                        ...current,
                        startTime: toDate(value, current.startTime),
                      }))
                    }
                    aria-label="开始时间"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} lg={5}>
                <Form.Item
                  label="结束时间"
                  validateStatus={isInvalidRange ? 'error' : undefined}
                  help={isInvalidRange ? '开始时间必须早于结束时间' : undefined}
                >
                  <AppDateTimePicker
                    value={dayjs(draftFilters.endTime)}
                    onChange={(value) =>
                      setDraftFilters((current) => ({
                        ...current,
                        endTime: toDate(value, current.endTime),
                      }))
                    }
                    aria-label="结束时间"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={10} lg={4}>
                <Form.Item label="周期">
                  <Select
                    value={draftFilters.periodMinutes}
                    options={PERIOD_OPTIONS.map((period) => ({
                      value: period,
                      label: `${period} 分钟`,
                    }))}
                    onChange={(periodMinutes) =>
                      setDraftFilters((current) => ({
                        ...current,
                        periodMinutes,
                      }))
                    }
                    aria-label="统计周期"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={14} lg={5}>
                <Button
                  type="primary"
                  htmlType="submit"
                  disabled={isInvalidRange}
                  autoInsertSpace={false}
                >
                  查询
                </Button>
              </Col>
            </Row>
          </Form>
        </Card>

        <div className="query-alert-slot">
          {queryMessage && (
            <Alert
              showIcon
              type={queryStatus === 'error' ? 'error' : 'warning'}
              message={queryMessage}
            />
          )}
        </div>

        <Row className="metric-row" gutter={[12, 12]}>
          <Col xs={24} md={12} xl={6}>
            <Card variant="outlined" className="metric-card important">
              <Statistic
                title="最新均温"
                value={summary.latest}
                precision={2}
                suffix="°C"
                styles={{ content: { color: '#ffffff' } }}
              />
              <span className="metric-note">
                {latestPoint ? formatDisplayDateTime(latestPoint.timestamp) : '暂无采样'}
              </span>
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card variant="outlined" className="metric-card">
              <Statistic title="最高均温" value={summary.max} precision={2} suffix="°C" />
              <span className="metric-note">avgTemperature 最大值</span>
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card variant="outlined" className="metric-card">
              <Statistic title="最低均温" value={summary.min} precision={2} suffix="°C" />
              <span className="metric-note">avgTemperature 最小值</span>
            </Card>
          </Col>
          <Col xs={24} md={12} xl={6}>
            <Card variant="outlined" className="metric-card">
              <Statistic
                title="首末变化"
                value={summary.delta}
                precision={2}
                suffix="°C"
                styles={{ content: { color: summary.delta >= 0 ? '#ff9d96' : '#8df0a7' } }}
              />
              <span className="metric-note">末值 - 首值</span>
            </Card>
          </Col>
        </Row>

        <Row className="main-chart-row" gutter={[14, 14]} align="stretch">
          <Col xs={24} xl={16}>
            <Card
              className="chart-card"
              variant="outlined"
              title={
                <div className="chart-title">
                  <span>平均温度趋势</span>
                  <small>{activeLocationName} · {rangeLabel} · {samplingLabel}</small>
                </div>
              }
              extra={<span className="chart-extra">{data.length} 点</span>}
            >
              <div
                className="chart-frame"
                role="img"
                aria-label={`${activeLocationName}${rangeLabel}平均温度趋势，最新均温 ${summary.latest.toFixed(
                  2
                )} 摄氏度，平均温度 ${summary.avg.toFixed(2)} 摄氏度`}
              >
                {data.length > 0 ? (
                  <TemperatureEChart
                    option={chartOption}
                    label={`${activeLocationName}${rangeLabel}平均温度趋势，最新均温 ${summary.latest.toFixed(
                      2
                    )} 摄氏度，平均温度 ${summary.avg.toFixed(2)} 摄氏度`}
                  />
                ) : (
                  <Empty description="暂无温度趋势数据" />
                )}
              </div>
            </Card>
          </Col>

          <Col xs={24} xl={8}>
            <div className="side-stack">
              <Card variant="outlined" title="当前查询">
                <Descriptions
                  className="query-summary"
                  column={1}
                  size="small"
                  colon={false}
                  items={[
                    { key: 'location', label: '位置', children: activeLocationName },
                    { key: 'time', label: '时间', children: queryWindow },
                    { key: 'period', label: '周期', children: samplingLabel },
                  ]}
                />
              </Card>

              <Card className="recent-samples-card" variant="outlined" title="最近采样点">
                <Table<TemperatureTrendPoint>
                  size="small"
                  rowKey="id"
                  columns={tableColumns}
                  dataSource={latestRows}
                  pagination={false}
                />
              </Card>
            </div>
          </Col>
        </Row>

        <style jsx>{`
          .reports-shell {
            display: grid;
            grid-template-rows: auto auto auto minmax(0, 1fr);
            gap: 10px;
            height: 100%;
            min-height: 0;
            overflow: hidden;
          }

          :global(.query-card) :global(.ant-card-body) {
            padding: 12px 16px;
          }

          .query-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            margin-bottom: 10px;
          }

          .query-head h2 {
            font-size: 17px;
            line-height: 1.25;
            font-weight: 650;
            color: var(--text-primary);
          }

          .query-head p {
            margin-top: 4px;
            color: var(--text-tertiary);
            font-size: 12px;
          }

          :global(.query-card) :global(.ant-form-item) {
            margin-bottom: 0;
          }

          :global(.query-card) :global(.ant-form-item-label) {
            padding-bottom: 2px;
          }

          :global(.query-card) :global(.ant-form-item-explain) {
            min-height: 0;
            line-height: 1.2;
            padding-top: 2px;
            font-size: 11px;
          }

          :global(.query-card) :global(.ant-picker),
          :global(.query-card) :global(.ant-select),
          :global(.query-card) :global(.ant-btn) {
            width: 100%;
            min-height: 36px;
          }

          .quick-row {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: flex-end;
          }

          .quick-row > span {
            color: var(--text-tertiary);
            font-size: 12px;
          }

          :global(.quick-row .ant-segmented) {
            background: rgba(255, 255, 255, 0.04);
          }

          :global(.metric-card) {
            background: #101010;
          }

          :global(.metric-card) :global(.ant-card-body) {
            min-height: 82px;
            padding: 12px 16px;
          }

          :global(.metric-card.important) {
            border-color: rgba(22, 119, 255, 0.36);
          }

          :global(.metric-card) :global(.ant-statistic-title) {
            margin-bottom: 4px;
            font-size: 12px;
          }

          :global(.metric-card) :global(.ant-statistic-content) {
            font-size: 25px;
            line-height: 1.12;
          }

          .metric-note {
            display: block;
            color: var(--text-tertiary);
            font-size: 12px;
            margin-top: 3px;
          }

          .chart-title {
            display: grid;
            gap: 3px;
            min-width: 0;
          }

          .chart-title span {
            color: var(--text-primary);
            font-weight: 600;
          }

          .chart-title small {
            color: var(--text-tertiary);
            font-size: 12px;
            font-weight: 400;
            font-family: var(--font-mono);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .chart-extra {
            color: var(--text-tertiary);
            font-size: 12px;
            font-family: var(--font-mono);
          }

          :global(.main-chart-row) {
            min-height: 0;
            height: 100%;
          }

          :global(.main-chart-row > .ant-col) {
            min-height: 0;
            display: flex;
          }

          :global(.chart-card),
          .side-stack {
            width: 100%;
            height: 100%;
            min-height: 0;
          }

          :global(.chart-card) {
            display: flex;
            flex-direction: column;
          }

          :global(.chart-card) :global(.ant-card-head) {
            min-height: 46px;
            flex-shrink: 0;
          }

          :global(.chart-card) :global(.ant-card-body) {
            display: flex;
            flex: 1;
            min-height: 0;
            padding: 10px 16px 14px;
          }

          .chart-frame {
            position: relative;
            flex: 1;
            width: 100%;
            min-height: 220px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: #070b11;
            padding: 6px 4px 0 0;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          :global(.temperature-echart) {
            flex: 1;
            align-self: stretch;
            width: 100%;
            height: 100%;
            min-height: 0;
            min-width: 0;
          }

          .side-stack {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            gap: 10px;
          }

          .side-stack :global(.ant-card) {
            min-width: 0;
          }

          .side-stack :global(.ant-card-body) {
            padding: 12px 16px;
          }

          :global(.query-summary .ant-descriptions-view) {
            width: 100%;
          }

          :global(.query-summary .ant-descriptions-row:not(:last-child) > th),
          :global(.query-summary .ant-descriptions-row:not(:last-child) > td) {
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          }

          :global(.query-summary .ant-descriptions-item-label) {
            width: 46px;
            color: var(--text-tertiary);
            font-size: 12px;
          }

          :global(.query-summary .ant-descriptions-item-content) {
            color: var(--text-primary);
            font-size: 12px;
            font-family: var(--font-mono);
            white-space: normal;
            overflow-wrap: anywhere;
          }

          :global(.recent-samples-card) {
            display: flex;
            flex-direction: column;
            min-height: 0;
          }

          :global(.recent-samples-card) :global(.ant-card-head) {
            min-height: 44px;
            flex-shrink: 0;
          }

          :global(.recent-samples-card) :global(.ant-card-body) {
            flex: 1;
            min-height: 0;
            overflow: hidden;
            padding: 0 12px 12px;
          }

          :global(.recent-samples-card) :global(.ant-table) {
            font-size: 12px;
          }

          :global(.recent-samples-card) :global(.ant-table-cell) {
            padding: 7px 8px !important;
          }

          @media (max-width: 760px) {
            .reports-shell {
              height: auto;
              min-height: 100%;
              overflow: visible;
            }

            .reports-shell :global(.ant-row) {
              margin-left: 0 !important;
              margin-right: 0 !important;
            }

            .reports-shell :global(.ant-col) {
              padding-left: 0 !important;
              padding-right: 0 !important;
            }

            .query-head {
              flex-direction: column;
              align-items: stretch;
              gap: 10px;
            }

            .quick-row {
              justify-content: flex-start;
            }

            .chart-title small {
              white-space: normal;
              overflow-wrap: anywhere;
            }

            :global(.chart-card) :global(.ant-card-head-title) {
              white-space: normal;
            }

            .chart-frame {
              height: 340px;
              flex: none;
            }
          }
        `}</style>
      </section>
    </ConfigProvider>
    </AntdStyleRegistry>
  );
}
