'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption, EChartsType } from 'echarts';
import {
  AppDateTimePicker,
  formatAppDateTime,
  parseAppDateTime,
} from '@/components/AppDatePicker';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
  Thermometer,
  XCircle,
} from 'lucide-react';
import {
  alarmPageLocationNames,
  buildAlarmLocationStatApiPath,
  buildAlarmPageApiPath,
  queryAlarmPageApi,
  queryAlarmStatsByLocationApi,
} from '@/data/wincc-config';
import type { AlarmLocationStat, AlarmPageData, AlarmPageLevel, AlarmPageQuery, AlarmPageRecord, AlarmReadState } from '@/types/template';
import {
  apiMockMode,
  apiMockModeLabel,
  buildApiUrl,
  canUseMockData,
  isMockOnly,
  unwrapApiData,
} from '@/lib/api-config';

type AlarmLevelFilter = 'all' | AlarmPageLevel;
type AlarmReadFilter = 'all' | `${AlarmReadState}`;
type AlarmSortKey = 'eventTimeStamp' | 'level' | 'maxTemp' | 'isRead' | 'locationName';
type SortDirection = 'asc' | 'desc';
type ApiStatus = 'idle' | 'loading' | 'success' | 'mock' | 'fallback' | 'error';

interface AlarmFilters {
  locationName: string;
  level: AlarmLevelFilter;
  isRead: AlarmReadFilter;
  startTime: string;
  endTime: string;
  pageSize: number;
}

interface AlarmSortState {
  key: AlarmSortKey;
  direction: SortDirection;
}

interface AlarmChartProps {
  className: string;
  option: EChartsOption;
  label: string;
  onSelectLocation?: (locationName: string) => void;
}

const defaultFilters: AlarmFilters = {
  locationName: '',
  level: 'all',
  isRead: 'all',
  startTime: '2026-06-25 08:26:56',
  endTime: '2026-06-30 08:27:56',
  pageSize: 10,
};

const defaultSortState: AlarmSortState = {
  key: 'eventTimeStamp',
  direction: 'desc',
};

const defaultSortDirections: Record<AlarmSortKey, SortDirection> = {
  eventTimeStamp: 'desc',
  level: 'desc',
  maxTemp: 'desc',
  isRead: 'asc',
  locationName: 'asc',
};

const locationPalette = ['#ff453a', '#ff9f0a', '#0a84ff', '#8b5cf6', '#30d158', '#5eead4'];

const toApiDateTime = (value: string) => {
  if (!value) return undefined;
  const normalized = value.replace('T', ' ');
  return normalized.length === 16 ? `${normalized}:00` : normalized;
};

const formatDateTime = (value: string) => toApiDateTime(value) ?? '-';

const getLevelMeta = (level: AlarmPageLevel) => {
  if (level === '2') {
    return {
      label: '2级',
      tone: '严重',
      color: 'var(--status-error)',
      background: 'rgba(255, 69, 58, 0.12)',
      border: 'rgba(255, 69, 58, 0.28)',
      Icon: XCircle,
    };
  }

  return {
    label: '1级',
    tone: '一般',
    color: 'var(--status-warning)',
    background: 'rgba(255, 214, 10, 0.12)',
    border: 'rgba(255, 214, 10, 0.26)',
    Icon: AlertTriangle,
  };
};

const getReadMeta = (isRead: AlarmReadState) => {
  if (isRead === 1) {
    return {
      label: '已读',
      action: '已确认',
      color: 'var(--text-tertiary)',
      background: 'rgba(255, 255, 255, 0.05)',
      border: 'var(--border)',
    };
  }

  return {
    label: '未读',
    action: '待处理',
    color: 'var(--status-error)',
    background: 'rgba(255, 69, 58, 0.12)',
    border: 'rgba(255, 69, 58, 0.28)',
  };
};

function buildQuery(filters: AlarmFilters, pageNum: number): AlarmPageQuery {
  return {
    pageNum,
    pageSize: filters.pageSize,
    locationName: filters.locationName || undefined,
    level: filters.level === 'all' ? undefined : filters.level,
    isRead: filters.isRead === 'all' ? undefined : (Number(filters.isRead) as AlarmReadState),
    startTime: toApiDateTime(filters.startTime),
    endTime: toApiDateTime(filters.endTime),
  };
}

function getSortValue(record: AlarmPageRecord, key: AlarmSortKey) {
  if (key === 'eventTimeStamp') return new Date(record.eventTimeStamp.replace(' ', 'T')).getTime();
  if (key === 'level') return Number(record.level);
  if (key === 'maxTemp') return record.maxTemp;
  if (key === 'isRead') return record.isRead;
  return record.locationName;
}

function sortRecords(records: AlarmPageRecord[], sortState: AlarmSortState) {
  const direction = sortState.direction === 'asc' ? 1 : -1;

  return [...records].sort((left, right) => {
    const leftValue = getSortValue(left, sortState.key);
    const rightValue = getSortValue(right, sortState.key);

    if (leftValue > rightValue) return direction;
    if (leftValue < rightValue) return -direction;
    return new Date(right.eventTimeStamp.replace(' ', 'T')).getTime() - new Date(left.eventTimeStamp.replace(' ', 'T')).getTime();
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const pickAlarmPageData = (payload: unknown): AlarmPageData => {
  const data = unwrapApiData(payload);

  if (!isRecord(data) || typeof data.total !== 'number' || !Array.isArray(data.list)) {
    throw new Error('告警分页接口返回结构不符合文档');
  }

  return data as unknown as AlarmPageData;
};

const pickLocationStats = (payload: unknown): AlarmLocationStat[] => {
  const data = unwrapApiData(payload);

  if (!Array.isArray(data)) {
    throw new Error('区域统计接口返回结构不符合文档');
  }

  return data as AlarmLocationStat[];
};

function AlarmEChart({ className, option, label, onSelectLocation }: AlarmChartProps) {
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
    chartRef.current?.setOption(option, { notMerge: false, lazyUpdate: true });
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onSelectLocation) return undefined;

    const handler = (params: unknown) => {
      const locationName = typeof params === 'object' && params && 'name' in params ? String(params.name) : '';
      if (locationName) onSelectLocation(locationName);
    };

    chart.on('click', handler);
    return () => {
      chart.off('click', handler);
    };
  }, [onSelectLocation]);

  return <div ref={containerRef} className={className} role="img" aria-label={label} />;
}

function MetricChip({ label, value, tone }: { label: string; value: string | number; tone?: 'danger' | 'warning' | 'info' }) {
  return (
    <div className="alarm-metric" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AlarmLevelBadge({ level }: { level: AlarmPageLevel }) {
  const meta = getLevelMeta(level);
  const Icon = meta.Icon;

  return (
    <span className="alarm-level-badge" style={{ borderColor: meta.border, background: meta.background, color: meta.color }}>
      <Icon size={13} />
      <span>{meta.label}</span>
      <em>{meta.tone}</em>
    </span>
  );
}

function ReadStateBadge({ isRead }: { isRead: AlarmReadState }) {
  const meta = getReadMeta(isRead);

  return (
    <span className="alarm-read-badge" style={{ borderColor: meta.border, background: meta.background, color: meta.color }}>
      {meta.label}
    </span>
  );
}

function RecordMobileCard({ record }: { record: AlarmPageRecord }) {
  const levelMeta = getLevelMeta(record.level);
  const readMeta = getReadMeta(record.isRead);
  const LevelIcon = levelMeta.Icon;

  return (
    <article className="alarm-mobile-card" style={{ borderColor: levelMeta.border }}>
      <div className="alarm-mobile-head">
        <div className="alarm-mobile-icon" style={{ color: levelMeta.color, background: levelMeta.background }}>
          <LevelIcon size={16} />
        </div>
        <div>
          <strong>{record.channelName} · {record.ruleType}</strong>
          <span>{record.eventTimeStamp}</span>
        </div>
        <em style={{ color: readMeta.color }}>{readMeta.action}</em>
      </div>

      <div className="alarm-mobile-fields">
        <span>区域 {record.locationName}</span>
        <span>次数 {record.num}</span>
        <span>平均 {record.avgTemp.toFixed(1)}℃</span>
        <span>最低 {record.minTemp.toFixed(1)}℃</span>
        <span>最高 {record.maxTemp.toFixed(1)}℃</span>
        <span>阈值 {record.thresholdTemp.toFixed(1)}℃</span>
      </div>
    </article>
  );
}

export default function AlarmCenter() {
  const [draftFilters, setDraftFilters] = useState<AlarmFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<AlarmFilters>(defaultFilters);
  const [pageNum, setPageNum] = useState(1);
  const [sortState, setSortState] = useState<AlarmSortState>(defaultSortState);
  const [alarmPageData, setAlarmPageData] = useState<AlarmPageData>(() =>
    queryAlarmPageApi(buildQuery(defaultFilters, 1)).data
  );
  const [locationStats, setLocationStats] = useState<AlarmLocationStat[]>(() =>
    queryAlarmStatsByLocationApi({
      startTime: toApiDateTime(defaultFilters.startTime),
      endTime: toApiDateTime(defaultFilters.endTime),
    }).data
  );
  const [apiStatus, setApiStatus] = useState<ApiStatus>('idle');
  const [apiMessage, setApiMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  const allQuery = useMemo(
    () => ({
      ...buildQuery(appliedFilters, 1),
      pageSize: 1000,
    }),
    [appliedFilters]
  );
  const allRecords = alarmPageData.list;
  const sortedRecords = useMemo(() => sortRecords(allRecords, sortState), [allRecords, sortState]);
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / appliedFilters.pageSize));
  const currentPage = Math.min(pageNum, totalPages);
  const pageStart = (currentPage - 1) * appliedFilters.pageSize;
  const result = useMemo(
    () => ({
      total: sortedRecords.length,
      list: sortedRecords.slice(pageStart, pageStart + appliedFilters.pageSize),
    }),
    [appliedFilters.pageSize, pageStart, sortedRecords]
  );

  const pageQuery = useMemo(() => buildQuery(appliedFilters, currentPage), [appliedFilters, currentPage]);
  const apiPath = buildAlarmPageApiPath(pageQuery);
  const locationStatQuery = useMemo(
    () => ({
      startTime: toApiDateTime(appliedFilters.startTime),
      endTime: toApiDateTime(appliedFilters.endTime),
    }),
    [appliedFilters.startTime, appliedFilters.endTime]
  );
  const rankedLocationStats = useMemo(
    () => [...locationStats].sort((left, right) => right.alarmCount - left.alarmCount),
    [locationStats]
  );

  const totalByLocation = locationStats.reduce((sum, stat) => sum + stat.alarmCount, 0);
  const unreadCount = sortedRecords.filter((record) => record.isRead === 0).length;
  const severeCount = sortedRecords.filter((record) => record.level === '2').length;
  const maxTemp = sortedRecords.length
    ? Math.max(...sortedRecords.map((record) => record.maxTemp)).toFixed(1)
    : '--';
  const startIndex = result.total === 0 ? 0 : pageStart + 1;
  const endIndex = Math.min(pageStart + appliedFilters.pageSize, result.total);
  const appliedFilterLabels = [
    appliedFilters.locationName || '全部区域',
    appliedFilters.isRead === 'all' ? '全部状态' : appliedFilters.isRead === '0' ? '未读' : '已读',
    appliedFilters.level === 'all' ? '全部等级' : `${appliedFilters.level}级`,
    `${formatDateTime(appliedFilters.startTime)} 至 ${formatDateTime(appliedFilters.endTime)}`,
    apiStatus === 'loading'
      ? '查询中'
      : apiStatus === 'success'
      ? '接口数据'
      : apiStatus === 'fallback'
        ? '接口失败 · 样例'
        : apiStatus === 'error'
          ? '接口失败'
          : apiMockModeLabel[apiMockMode],
  ];

  useEffect(() => {
    const controller = new AbortController();

    async function loadAlarmData() {
      setApiMessage('');

      if (isMockOnly) {
        setAlarmPageData(queryAlarmPageApi(allQuery).data);
        setLocationStats(queryAlarmStatsByLocationApi(locationStatQuery).data);
        setApiStatus('mock');
        return;
      }

      setApiStatus('loading');

      try {
        const [pageResponse, statResponse] = await Promise.all([
          fetch(buildApiUrl(buildAlarmPageApiPath(allQuery)), {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          }),
          fetch(buildApiUrl(buildAlarmLocationStatApiPath(locationStatQuery)), {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          }),
        ]);

        if (!pageResponse.ok) throw new Error(`/alarm/page HTTP ${pageResponse.status}`);
        if (!statResponse.ok) throw new Error(`/alarm/stat-by-location HTTP ${statResponse.status}`);

        const [pagePayload, statPayload] = await Promise.all([
          pageResponse.json() as Promise<unknown>,
          statResponse.json() as Promise<unknown>,
        ]);

        setAlarmPageData(pickAlarmPageData(pagePayload));
        setLocationStats(pickLocationStats(statPayload));
        setApiStatus('success');
      } catch (error) {
        if (controller.signal.aborted) return;

        if (canUseMockData) {
          setAlarmPageData(queryAlarmPageApi(allQuery).data);
          setLocationStats(queryAlarmStatsByLocationApi(locationStatQuery).data);
          setApiStatus('fallback');
        } else {
          setAlarmPageData({ total: 0, list: [] });
          setLocationStats([]);
          setApiStatus('error');
        }

        setApiMessage(error instanceof Error ? error.message : '接口请求失败');
      }
    }

    loadAlarmData();

    return () => controller.abort();
  }, [allQuery, locationStatQuery]);

  const pieOption = useMemo<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    animation: false,
    color: locationPalette,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(18, 18, 18, 0.96)',
      borderColor: 'rgba(255,255,255,0.12)',
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: '{b}<br/>告警 {c} 条 · {d}%',
    },
    legend: {
      type: 'scroll',
      bottom: 4,
      left: 'center',
      itemWidth: 8,
      itemHeight: 8,
      selectedMode: false,
      textStyle: { color: 'rgba(255,255,255,0.58)', fontSize: 11 },
      pageIconColor: 'rgba(255,255,255,0.42)',
      pageTextStyle: { color: 'rgba(255,255,255,0.42)' },
    },
    series: [
      {
        name: '区域告警',
        type: 'pie',
        radius: ['52%', '70%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        minAngle: 5,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderWidth: 2,
          borderColor: '#111',
        },
        emphasis: {
          scale: false,
          itemStyle: { opacity: 0.86 },
        },
        data: rankedLocationStats.map((stat) => ({
          name: stat.locationName,
          value: stat.alarmCount,
          selected: appliedFilters.locationName === stat.locationName,
        })),
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '38%',
        style: {
          text: `${totalByLocation}`,
          fill: '#fff',
          font: '600 24px SF Mono, monospace',
          textAlign: 'center',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '53%',
        style: {
          text: '总数',
          fill: 'rgba(255,255,255,0.42)',
          font: '11px system-ui',
          textAlign: 'center',
        },
      },
    ],
  }), [appliedFilters.locationName, rankedLocationStats, totalByLocation]);

  const barOption = useMemo<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(18, 18, 18, 0.96)',
      borderColor: 'rgba(255,255,255,0.12)',
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        const stat = rankedLocationStats.find((entry) => entry.locationName === item.name);
        if (!stat) return `${item.name}: ${item.value}`;
        return `${stat.locationName}<br/>告警 ${stat.alarmCount} 条<br/>未读 ${stat.unreadCount} 条<br/>最高 ${stat.maxTemp.toFixed(1)}℃ / 最低 ${stat.minTemp.toFixed(1)}℃`;
      },
    },
    grid: { left: 56, right: 38, top: 10, bottom: 18 },
    xAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: { color: 'rgba(255,255,255,0.36)', fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rankedLocationStats.map((stat) => stat.locationName),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisLabel: { color: 'rgba(255,255,255,0.64)', fontSize: 11 },
    },
    series: [
      {
        name: '告警数',
        type: 'bar',
        data: rankedLocationStats.map((stat, index) => ({
          name: stat.locationName,
          value: stat.alarmCount,
          itemStyle: {
            color: locationPalette[index % locationPalette.length],
            opacity: appliedFilters.locationName && appliedFilters.locationName !== stat.locationName ? 0.34 : 1,
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barWidth: 15,
        label: {
          show: true,
          position: 'right',
          color: 'rgba(255,255,255,0.68)',
          fontSize: 10,
          formatter: '{c}',
        },
      },
    ],
  }), [appliedFilters.locationName, rankedLocationStats]);

  const updateDraftFilter = <K extends keyof AlarmFilters>(key: K, value: AlarmFilters[K]) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = (nextFilters = draftFilters) => {
    setPageNum(1);
    startTransition(() => setAppliedFilters(nextFilters));
  };

  const applyShortcut = (nextFilters: AlarmFilters) => {
    setDraftFilters(nextFilters);
    applyFilters(nextFilters);
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setPageNum(1);
    setSortState(defaultSortState);
    startTransition(() => setAppliedFilters(defaultFilters));
  };

  const selectLocationFromChart = (locationName: string) => {
    const nextFilters = {
      ...draftFilters,
      locationName: appliedFilters.locationName === locationName ? '' : locationName,
    };

    applyShortcut(nextFilters);
  };

  const toggleSort = (key: AlarmSortKey) => {
    setSortState((current) => {
      if (current.key !== key) return { key, direction: defaultSortDirections[key] };
      return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const getSortLabel = (key: AlarmSortKey) => {
    if (sortState.key !== key) return '';
    return sortState.direction === 'asc' ? '升序' : '降序';
  };

  const renderSortHeader = (key: AlarmSortKey, label: string) => (
    <button className="alarm-sort-button" type="button" onClick={() => toggleSort(key)} aria-pressed={sortState.key === key}>
      <span>{label}</span>
      {sortState.key === key && <em>{sortState.direction === 'asc' ? '升' : '降'}</em>}
    </button>
  );

  return (
    <section className="alarm-center">
      <style jsx global>{`
        .alarm-center {
          min-height: 720px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .alarm-control-panel,
        .alarm-records-panel,
        .alarm-insight-panel {
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-elevated);
        }

        .alarm-control-panel {
          display: grid;
          gap: 10px;
          padding: 12px;
        }

        .alarm-filter-row {
          display: grid;
          grid-template-columns: minmax(128px, 0.9fr) minmax(128px, 0.8fr) minmax(128px, 0.8fr) minmax(188px, 1.15fr) minmax(188px, 1.15fr) auto;
          gap: 10px;
          align-items: end;
        }

        .alarm-field {
          min-width: 0;
          display: grid;
          gap: 5px;
        }

        .alarm-field span {
          font-size: 11px;
          color: var(--text-tertiary);
        }

        .alarm-field > select,
        .alarm-field > input,
        .alarm-page-size {
          width: 100%;
          height: 36px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-primary);
          padding: 0 10px;
          font-size: 12px;
          outline: none;
        }

        .alarm-field :global(.ant-picker) {
          width: 100%;
          height: 36px;
          border-radius: 6px;
        }

        .alarm-field :global(.ant-picker-input > input) {
          font-size: 12px;
          font-family: var(--font-mono);
        }

        .alarm-field > select:focus,
        .alarm-field > input:focus,
        .alarm-page-size:focus {
          border-color: rgba(10, 132, 255, 0.62);
        }

        .alarm-actions,
        .alarm-shortcuts,
        .alarm-metric-row,
        .alarm-filter-summary {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .alarm-actions {
          justify-content: flex-end;
        }

        .alarm-status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-top: 10px;
          border-top: 1px solid var(--border-subtle);
        }

        .alarm-shortcuts,
        .alarm-filter-summary,
        .alarm-metric-row {
          flex-wrap: wrap;
        }

        .alarm-filter-summary {
          min-width: 0;
          flex: 1;
        }

        .alarm-text-button,
        .alarm-icon-button,
        .alarm-pill-button {
          min-height: 36px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 11px;
          font-size: 12px;
          white-space: nowrap;
          transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
        }

        .alarm-icon-button {
          min-width: 36px;
          padding: 0;
        }

        .alarm-text-button:hover,
        .alarm-icon-button:hover,
        .alarm-pill-button:hover,
        .alarm-text-button[data-active='true'],
        .alarm-pill-button[data-active='true'] {
          border-color: rgba(10, 132, 255, 0.5);
          color: var(--text-primary);
          background: rgba(10, 132, 255, 0.1);
        }

        .alarm-text-button:disabled,
        .alarm-icon-button:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .alarm-primary-button {
          border-color: rgba(10, 132, 255, 0.62);
          background: rgba(10, 132, 255, 0.14);
          color: var(--text-primary);
        }

        .alarm-condition-chip {
          min-height: 24px;
          max-width: 320px;
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--border-subtle);
          border-radius: 999px;
          padding: 0 9px;
          color: var(--text-tertiary);
          background: rgba(255, 255, 255, 0.025);
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .alarm-api-message {
          width: 100%;
          min-height: 28px;
          display: flex;
          align-items: center;
          padding: 0 10px;
          border: 1px solid rgba(255, 214, 10, 0.24);
          border-radius: 6px;
          background: rgba(255, 214, 10, 0.08);
          color: rgba(255, 224, 102, 0.88);
          font-size: 12px;
        }

        .alarm-metric {
          min-width: 82px;
          height: 38px;
          border-left: 1px solid var(--border);
          padding-left: 10px;
        }

        .alarm-metric span {
          display: block;
          font-size: 10px;
          color: var(--text-tertiary);
        }

        .alarm-metric strong {
          display: block;
          margin-top: 1px;
          color: var(--text-primary);
          font-size: 16px;
          line-height: 1.1;
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
        }

        .alarm-metric[data-tone='danger'] strong {
          color: var(--status-error);
        }

        .alarm-metric[data-tone='warning'] strong {
          color: var(--status-warning);
        }

        .alarm-metric[data-tone='info'] strong {
          color: #5eead4;
        }

        .alarm-workspace {
          flex: 1;
          min-height: 560px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 348px;
          gap: 12px;
        }

        .alarm-records-panel {
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .alarm-records-toolbar {
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 12px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .alarm-records-title {
          min-width: 0;
        }

        .alarm-records-title h2 {
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 600;
        }

        .alarm-records-title span {
          display: block;
          margin-top: 2px;
          color: var(--text-tertiary);
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .alarm-table-wrap {
          flex: 1;
          min-height: 0;
          overflow: auto;
        }

        .alarm-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1020px;
        }

        .alarm-table th,
        .alarm-table td {
          padding: 9px 12px;
          border-bottom: 1px solid var(--border-subtle);
          text-align: left;
          font-size: 12px;
          vertical-align: middle;
        }

        .alarm-table th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: #111111;
          color: var(--text-tertiary);
          font-weight: 500;
        }

        .alarm-table td {
          color: var(--text-secondary);
        }

        .alarm-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .alarm-sort-button {
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font: inherit;
          padding: 0;
        }

        .alarm-sort-button em {
          color: var(--accent);
          font-size: 10px;
          font-style: normal;
        }

        .alarm-level-badge,
        .alarm-read-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid;
          white-space: nowrap;
        }

        .alarm-level-badge em {
          color: var(--text-tertiary);
          font-style: normal;
        }

        .alarm-pagination {
          min-height: 42px;
          padding: 0 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-top: 1px solid var(--border-subtle);
        }

        .alarm-insights-rail {
          min-height: 0;
          display: grid;
          grid-template-rows: 258px minmax(238px, 1fr);
          gap: 12px;
        }

        .alarm-insight-panel {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: 42px minmax(0, 1fr);
          overflow: hidden;
        }

        .alarm-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 12px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .alarm-panel-head h3 {
          flex-shrink: 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .alarm-panel-head span {
          min-width: 0;
          color: var(--text-tertiary);
          font-size: 11px;
          text-align: right;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .alarm-pie-chart,
        .alarm-bar-chart {
          width: 100%;
          min-height: 0;
        }

        .alarm-mobile-list {
          display: none;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          overflow: auto;
        }

        .alarm-mobile-card {
          border-radius: 8px;
          border: 1px solid;
          background: rgba(255, 255, 255, 0.03);
          padding: 12px;
        }

        .alarm-mobile-head {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .alarm-mobile-head > div:nth-child(2) {
          flex: 1;
          min-width: 0;
        }

        .alarm-mobile-head strong {
          display: block;
          color: var(--text-primary);
          font-size: 13px;
        }

        .alarm-mobile-head span {
          display: block;
          margin-top: 3px;
          color: var(--text-tertiary);
          font-size: 11px;
          font-family: var(--font-mono);
        }

        .alarm-mobile-head em {
          flex-shrink: 0;
          font-size: 11px;
          font-style: normal;
        }

        .alarm-mobile-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .alarm-mobile-fields {
          margin-top: 10px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px 10px;
          color: var(--text-tertiary);
          font-size: 11px;
        }

        .alarm-empty {
          min-height: 260px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 10px;
          color: var(--text-muted);
        }

        @media (max-width: 1540px) {
          .alarm-workspace {
            grid-template-columns: 1fr;
          }

          .alarm-insights-rail {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-template-rows: 238px;
          }
        }

        @media (max-width: 1260px) {
          .alarm-filter-row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 860px) {
          .alarm-filter-row,
          .alarm-insights-rail {
            grid-template-columns: 1fr;
          }

          .alarm-status-row,
          .alarm-records-toolbar,
          .alarm-pagination {
            align-items: flex-start;
            flex-direction: column;
          }

          .alarm-actions {
            justify-content: flex-start;
          }

          .alarm-table-wrap {
            display: none;
          }

          .alarm-mobile-list {
            display: flex;
          }
        }
      `}</style>

      <form
        className="alarm-control-panel"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <div className="alarm-filter-row">
          <label className="alarm-field">
            <span>区域</span>
            <select value={draftFilters.locationName} onChange={(event) => updateDraftFilter('locationName', event.target.value)}>
              <option value="">全部区域</option>
              {alarmPageLocationNames.map((locationName) => (
                <option key={locationName} value={locationName}>
                  {locationName}
                </option>
              ))}
            </select>
          </label>

          <label className="alarm-field">
            <span>状态</span>
            <select value={draftFilters.isRead} onChange={(event) => updateDraftFilter('isRead', event.target.value as AlarmReadFilter)}>
              <option value="all">全部状态</option>
              <option value="0">未读</option>
              <option value="1">已读</option>
            </select>
          </label>

          <label className="alarm-field">
            <span>等级</span>
            <select value={draftFilters.level} onChange={(event) => updateDraftFilter('level', event.target.value as AlarmLevelFilter)}>
              <option value="all">全部等级</option>
              <option value="1">1级 一般</option>
              <option value="2">2级 严重</option>
            </select>
          </label>

          <label className="alarm-field">
            <span>开始时间</span>
            <AppDateTimePicker
              value={parseAppDateTime(draftFilters.startTime)}
              onChange={(value) => updateDraftFilter('startTime', formatAppDateTime(value))}
              aria-label="开始时间"
            />
          </label>

          <label className="alarm-field">
            <span>结束时间</span>
            <AppDateTimePicker
              value={parseAppDateTime(draftFilters.endTime)}
              onChange={(value) => updateDraftFilter('endTime', formatAppDateTime(value))}
              aria-label="结束时间"
            />
          </label>

          <div className="alarm-actions">
            <button className="alarm-text-button alarm-primary-button" type="submit" data-active={isPending} disabled={isPending}>
              <Search size={14} />
              {isPending ? '查询中' : '查询'}
            </button>
            <button className="alarm-text-button" type="button" onClick={resetFilters}>
              <RefreshCw size={14} />
              重置
            </button>
          </div>
        </div>

        <div className="alarm-status-row">
          <div className="alarm-shortcuts" aria-label="常用筛选">
            <button
              className="alarm-pill-button"
              type="button"
              data-active={!appliedFilters.locationName && appliedFilters.isRead === 'all' && appliedFilters.level === 'all'}
              onClick={resetFilters}
            >
              全部
            </button>
            <button
              className="alarm-pill-button"
              type="button"
              data-active={appliedFilters.isRead === '0'}
              onClick={() => applyShortcut({ ...draftFilters, isRead: appliedFilters.isRead === '0' ? 'all' : '0' })}
            >
              未读
            </button>
            <button
              className="alarm-pill-button"
              type="button"
              data-active={appliedFilters.level === '2'}
              onClick={() => applyShortcut({ ...draftFilters, level: appliedFilters.level === '2' ? 'all' : '2' })}
            >
              2级
            </button>
          </div>

          <div className="alarm-filter-summary" title={apiPath}>
            {appliedFilterLabels.map((label) => (
              <span className="alarm-condition-chip" key={label}>
                {label}
              </span>
            ))}
          </div>

          {apiMessage && (
            <div className="alarm-api-message" role="status">
              {apiStatus === 'fallback' ? `接口未连通，当前展示文档样例数据：${apiMessage}` : apiMessage}
            </div>
          )}

          <div className="alarm-metric-row">
            <MetricChip label="记录" value={result.total} />
            <MetricChip label="未读" value={unreadCount} tone="danger" />
            <MetricChip label="2级" value={severeCount} tone="warning" />
            <MetricChip label="最高温" value={maxTemp === '--' ? '--' : `${maxTemp}℃`} tone="info" />
          </div>
        </div>
      </form>

      <div className="alarm-workspace">
        <div className="alarm-records-panel">
          <div className="alarm-records-toolbar">
            <div className="alarm-records-title">
              <h2>告警记录</h2>
              <span title={apiPath}>
                {getSortLabel(sortState.key) ? `按${sortState.key === 'eventTimeStamp' ? '报警时间' : sortState.key === 'maxTemp' ? '最高温' : sortState.key === 'isRead' ? '状态' : sortState.key === 'level' ? '等级' : '区域'}${getSortLabel(sortState.key)}` : '当前结果'}
              </span>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
              每页
              <select
                className="alarm-page-size"
                value={draftFilters.pageSize}
                onChange={(event) => {
                  const nextPageSize = Number(event.target.value);
                  const nextFilters = { ...draftFilters, pageSize: nextPageSize };
                  setDraftFilters(nextFilters);
                  applyFilters(nextFilters);
                }}
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="alarm-table-wrap">
            <table className="alarm-table">
              <thead>
                <tr>
                  <th>事件ID</th>
                  <th aria-sort={sortState.key === 'locationName' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {renderSortHeader('locationName', '区域')}
                  </th>
                  <th>通道</th>
                  <th>报警事项</th>
                  <th aria-sort={sortState.key === 'level' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {renderSortHeader('level', '等级')}
                  </th>
                  <th aria-sort={sortState.key === 'maxTemp' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {renderSortHeader('maxTemp', '温度/阈值')}
                  </th>
                  <th>次数</th>
                  <th aria-sort={sortState.key === 'isRead' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {renderSortHeader('isRead', '状态')}
                  </th>
                  <th aria-sort={sortState.key === 'eventTimeStamp' ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    {renderSortHeader('eventTimeStamp', '报警时间')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.list.map((record) => {
                  const readMeta = getReadMeta(record.isRead);

                  return (
                    <tr key={record.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                        {record.eventId}
                      </td>
                      <td>{record.locationName}</td>
                      <td>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                          {record.channelName}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Thermometer size={14} color="var(--text-tertiary)" />
                          <span style={{ color: 'var(--text-primary)' }}>{record.ruleType}</span>
                        </div>
                      </td>
                      <td>
                        <AlarmLevelBadge level={record.level} />
                      </td>
                      <td>
                        <div style={{ display: 'grid', gap: 2, fontFamily: 'var(--font-mono)', lineHeight: 1.25 }}>
                          <span style={{ color: '#5eead4' }}>
                            均 {record.avgTemp.toFixed(1)}℃ / 低 {record.minTemp.toFixed(1)}℃
                          </span>
                          <span style={{ color: 'var(--status-warning)' }}>
                            高 {record.maxTemp.toFixed(1)}℃ / 阈 {record.thresholdTemp.toFixed(1)}℃
                          </span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{record.num}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ReadStateBadge isRead={record.isRead} />
                          <span style={{ color: readMeta.color, fontSize: 11 }}>{readMeta.action}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)' }}>
                          <Clock size={13} color="var(--text-muted)" />
                          {record.eventTimeStamp}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="alarm-mobile-list">
            {result.list.map((record) => (
              <RecordMobileCard key={record.id} record={record} />
            ))}
          </div>

          {result.list.length === 0 && (
            <div className="alarm-empty">
              <CheckCircle2 size={34} strokeWidth={1.2} />
              <span style={{ fontSize: 13 }}>暂无符合条件的告警记录</span>
            </div>
          )}

          <div className="alarm-pagination">
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              显示 {startIndex}-{endIndex}，共 {result.total} 条
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="alarm-icon-button"
                type="button"
                onClick={() => setPageNum((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
                title="上一页"
              >
                <ChevronLeft size={15} />
              </button>
              <span style={{ minWidth: 72, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                {currentPage} / {totalPages}
              </span>
              <button
                className="alarm-icon-button"
                type="button"
                onClick={() => setPageNum((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage >= totalPages}
                title="下一页"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>

        <aside className="alarm-insights-rail" aria-label="告警统计">
          <section className="alarm-insight-panel">
            <div className="alarm-panel-head">
              <h3>区域占比</h3>
              <span>{totalByLocation} 条</span>
            </div>
            <AlarmEChart className="alarm-pie-chart" option={pieOption} label="区域告警占比图" onSelectLocation={selectLocationFromChart} />
          </section>

          <section className="alarm-insight-panel">
            <div className="alarm-panel-head">
              <h3>区域排行</h3>
              <span>点击区域筛选</span>
            </div>
            <AlarmEChart className="alarm-bar-chart" option={barOption} label="区域告警数量排行图" onSelectLocation={selectLocationFromChart} />
          </section>
        </aside>
      </div>
    </section>
  );
}
