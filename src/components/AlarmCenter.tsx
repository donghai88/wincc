'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from 'lucide-react';
import * as echarts from 'echarts';
import type { EChartsOption, EChartsType } from 'echarts';
import {
  buildAlarmBatchProcessApiPath,
  buildAlarmLocationStatApiPath,
  buildAlarmPageApiPath,
  processAlarmBatchApi,
  queryAlarmPageApi,
  queryAlarmStatsByLocationApi,
} from '@/data/wincc-config';
import type {
  AlarmBatchProcessRequest,
  AlarmLocationStat,
  AlarmPageData,
  AlarmPageLevel,
  AlarmPageQuery,
  AlarmPageRecord,
  AlarmReadState,
} from '@/types/template';
import {
  canUseMockData,
  isMockOnly,
  unwrapApiData,
  buildApiUrl,
} from '@/lib/api-config';
import { useAuth } from '@/contexts/AuthContext';

type AlarmReadFilter = 'all' | `${AlarmReadState}`;
type ApiStatus = 'idle' | 'loading' | 'success' | 'mock' | 'fallback' | 'error';
type ProcessStatus = 'idle' | 'loading' | 'success' | 'mock' | 'fallback' | 'error';

const LOCATION_CHART_COLORS = [
  '#ff453a',
  '#ff9f0a',
  '#0a84ff',
  '#bf5af2',
  '#30d158',
  '#64d2ff',
  '#ffd60a',
  '#ac8e68',
];

interface AlarmFilters {
  locationName: string;
  isRead: AlarmReadFilter;
  pageSize: number;
}

const PAGE_SIZE = 20;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const defaultFilters: AlarmFilters = {
  locationName: '',
  isRead: 'all',
  pageSize: PAGE_SIZE,
};

const pad = (value: number) => String(value).padStart(2, '0');

const formatDateTimeValue = (date: Date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
);

const getRecentSevenDayRange = () => {
  const end = new Date();
  const start = new Date(end.getTime() - SEVEN_DAYS_MS);
  return {
    startTime: formatDateTimeValue(start),
    endTime: formatDateTimeValue(end),
  };
};

const getLevelMeta = (level: AlarmPageLevel) => {
  if (level === '2') {
    return {
      label: '2级',
      tone: '严重',
      color: 'var(--status-error)',
      background: 'rgba(255, 69, 58, 0.12)',
      border: 'rgba(255, 69, 58, 0.28)',
      bar: '#ff453a',
      modalBackground: '#1d0b0e',
      modalBorder: '#ff453a',
      Icon: XCircle,
    };
  }

  return {
    label: '1级',
    tone: '一般',
    color: 'var(--status-warning)',
    background: 'rgba(255, 214, 10, 0.12)',
    border: 'rgba(255, 214, 10, 0.26)',
    bar: '#ff9f0a',
    modalBackground: '#1f1a05',
    modalBorder: '#ffd60a',
    Icon: AlertTriangle,
  };
};

const getReadMeta = (isRead: AlarmReadState) => {
  if (isRead === 1) {
    return {
      label: '已读',
      color: 'var(--text-tertiary)',
    };
  }

  return {
    label: '未读',
    color: 'var(--status-error)',
  };
};

function buildQuery(
  filters: AlarmFilters,
  pageNum: number,
  timeRange: { startTime: string; endTime: string },
): AlarmPageQuery {
  return {
    pageNum,
    pageSize: filters.pageSize,
    locationName: filters.locationName || undefined,
    isRead: filters.isRead === 'all' ? undefined : (Number(filters.isRead) as AlarmReadState),
    startTime: timeRange.startTime,
    endTime: timeRange.endTime,
  };
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

const pickBatchProcessResult = (payload: unknown): boolean => {
  if (!isRecord(payload)) {
    throw new Error('告警处理接口返回结构不符合文档');
  }

  if (typeof payload.code === 'number' && payload.code !== 200) {
    throw new Error(typeof payload.msg === 'string' && payload.msg.trim()
      ? payload.msg
      : `告警处理失败 code=${payload.code}`);
  }

  if (unwrapApiData(payload) !== true) {
    throw new Error('告警处理接口返回 data 不是 true');
  }

  return true;
};

const pickLocationStats = (payload: unknown): AlarmLocationStat[] => {
  const data = unwrapApiData(payload);
  if (!Array.isArray(data) || !data.every(isRecord)) {
    throw new Error('区域统计接口返回结构不符合文档：应为数组');
  }

  return data.map((row, index) => {
    const locationName = row.locationName;
    const alarmCount = row.alarmCount;
    const unreadCount = row.unreadCount;
    const maxTemp = row.maxTemp;
    const minTemp = row.minTemp;

    if (typeof locationName !== 'string' || !locationName.trim()) {
      throw new Error(`区域统计第 ${index + 1} 条缺少 locationName`);
    }
    if (typeof alarmCount !== 'number' || !Number.isFinite(alarmCount)) {
      throw new Error(`区域统计 ${locationName} 缺少 alarmCount`);
    }
    if (typeof unreadCount !== 'number' || !Number.isFinite(unreadCount)) {
      throw new Error(`区域统计 ${locationName} 缺少 unreadCount`);
    }
    if (typeof maxTemp !== 'number' || !Number.isFinite(maxTemp)) {
      throw new Error(`区域统计 ${locationName} 缺少 maxTemp`);
    }
    if (typeof minTemp !== 'number' || !Number.isFinite(minTemp)) {
      throw new Error(`区域统计 ${locationName} 缺少 minTemp`);
    }

    return {
      locationName,
      alarmCount,
      unreadCount,
      maxTemp,
      minTemp,
    };
  });
};

const getRecordKey = (record: AlarmPageRecord) => `${record.id}:${record.eventId}`;

const getDefaultProcessor = (userName?: string | null, username?: string | null) => (
  userName?.trim() || username?.trim() || ''
);

function AlarmLocationChart({ option, label }: { option: EChartsOption; label: string }) {
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

  return <div ref={containerRef} className="alarm-location-chart" role="img" aria-label={label} />;
}

function AlarmRecordCard({
  record,
  selected,
  onOpen,
}: {
  record: AlarmPageRecord;
  selected: boolean;
  onOpen: (record: AlarmPageRecord) => void;
}) {
  const levelMeta = getLevelMeta(record.level);
  const readMeta = getReadMeta(record.isRead);
  const LevelIcon = levelMeta.Icon;

  return (
    <article
      className="alarm-record-card"
      data-unread={record.isRead === 0}
      data-selected={selected}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(record)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(record);
        }
      }}
    >
      <span className="alarm-record-bar" style={{ background: levelMeta.bar }} aria-hidden />
      <div
        className="alarm-record-icon"
        style={{ color: levelMeta.color, background: levelMeta.background }}
      >
        <LevelIcon size={18} />
      </div>
      <div className="alarm-record-body">
        <strong>
          {record.channelName} - {record.locationName}
          <span className="alarm-record-divider">|</span>
          {record.ruleType}
        </strong>
        <p>
          <span>温度:{record.maxTemp.toFixed(1)}°C</span>
          <span className="alarm-record-divider">|</span>
          <span>{record.eventTimeStamp}</span>
          <span className="alarm-record-divider">|</span>
          <em style={{ color: readMeta.color }}>{readMeta.label}</em>
        </p>
      </div>
    </article>
  );
}

export default function AlarmCenter() {
  const { user } = useAuth();
  const [draftFilters, setDraftFilters] = useState<AlarmFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<AlarmFilters>(defaultFilters);
  const [timeRange, setTimeRange] = useState(getRecentSevenDayRange);
  const [pageNum, setPageNum] = useState(1);
  const [queryVersion, setQueryVersion] = useState(0);
  const [alarmPageData, setAlarmPageData] = useState<AlarmPageData>({ total: 0, list: [] });
  const [knownLocations, setKnownLocations] = useState<string[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [locallyReadRecordIds, setLocallyReadRecordIds] = useState<Set<string>>(() => new Set());
  const [processor, setProcessor] = useState('');
  const [processContent, setProcessContent] = useState('');
  const [processStatus, setProcessStatus] = useState<ProcessStatus>('idle');
  const [processMessage, setProcessMessage] = useState('');
  const [locationStats, setLocationStats] = useState<AlarmLocationStat[]>([]);
  const [statsStatus, setStatsStatus] = useState<ApiStatus>('idle');
  const [statsMessage, setStatsMessage] = useState('');
  const [apiStatus, setApiStatus] = useState<ApiStatus>('idle');
  const [apiMessage, setApiMessage] = useState('');

  const allQuery = useMemo(() => ({
    ...buildQuery(appliedFilters, 1, timeRange),
    pageSize: 1000,
  }), [appliedFilters, timeRange]);

  const locationStatQuery = useMemo(() => ({
    startTime: timeRange.startTime,
    endTime: timeRange.endTime,
  }), [timeRange]);

  const allRecords = useMemo(() => {
    return alarmPageData.list.map((record) => {
      return locallyReadRecordIds.has(getRecordKey(record)) ? { ...record, isRead: 1 as const } : record;
    });
  }, [alarmPageData.list, locallyReadRecordIds]);

  const visibleRecords = useMemo(() => {
    if (appliedFilters.isRead === 'all') return allRecords;
    return allRecords.filter((record) => record.isRead === Number(appliedFilters.isRead));
  }, [allRecords, appliedFilters.isRead]);

  const locallyReadUnreadRecords = useMemo(() => {
    return alarmPageData.list.filter((record) => record.isRead === 0 && locallyReadRecordIds.has(getRecordKey(record)));
  }, [alarmPageData.list, locallyReadRecordIds]);

  const resultTotal = appliedFilters.isRead === '0'
    ? Math.max(0, alarmPageData.total - locallyReadUnreadRecords.length)
    : alarmPageData.total;

  const sortedRecords = useMemo(() => {
    return [...visibleRecords].sort((left, right) => (
      new Date(right.eventTimeStamp.replace(' ', 'T')).getTime()
      - new Date(left.eventTimeStamp.replace(' ', 'T')).getTime()
    ));
  }, [visibleRecords]);

  const totalPages = Math.max(1, Math.ceil(resultTotal / appliedFilters.pageSize));
  const currentPage = Math.min(pageNum, totalPages);
  const pageStart = (currentPage - 1) * appliedFilters.pageSize;
  const result = useMemo(
    () => ({
      total: resultTotal,
      list: sortedRecords.slice(pageStart, pageStart + appliedFilters.pageSize),
    }),
    [appliedFilters.pageSize, pageStart, resultTotal, sortedRecords]
  );

  const locationNames = useMemo(() => {
    return Array.from(new Set([
      ...knownLocations,
      ...locationStats.map((stat) => stat.locationName),
      ...allRecords.map((record) => record.locationName),
    ].filter(Boolean))).sort((left, right) => left.localeCompare(right, 'zh-CN'));
  }, [allRecords, knownLocations, locationStats]);

  const locationStatSummary = useMemo(() => {
    return locationStats.reduce(
      (summary, stat) => ({
        alarmCount: summary.alarmCount + stat.alarmCount,
        unreadCount: summary.unreadCount + stat.unreadCount,
      }),
      { alarmCount: 0, unreadCount: 0 },
    );
  }, [locationStats]);

  const locationChartOption = useMemo<EChartsOption>(() => {
    const chartData = [...locationStats]
      .filter((stat) => stat.alarmCount > 0)
      .sort((left, right) => right.alarmCount - left.alarmCount)
      .map((stat, index) => ({
        name: stat.locationName,
        value: stat.alarmCount,
        itemStyle: { color: LOCATION_CHART_COLORS[index % LOCATION_CHART_COLORS.length] },
      }));

    return {
      backgroundColor: 'transparent',
      color: LOCATION_CHART_COLORS,
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(8, 12, 18, 0.96)',
        borderColor: 'rgba(10, 132, 255, 0.35)',
        borderWidth: 1,
        textStyle: { color: 'rgba(255,255,255,0.88)', fontSize: 12 },
        formatter: (params: unknown) => {
          const item = Array.isArray(params) ? params[0] : params;
          if (!item || typeof item !== 'object') return '';
          const row = item as { name?: string; value?: number; percent?: number };
          const unread = locationStats.find((stat) => stat.locationName === row.name)?.unreadCount ?? 0;
          return `${row.name ?? ''}<br/>告警 ${row.value ?? 0} 条（${row.percent ?? 0}%）<br/>未读 ${unread} 条`;
        },
      },
      series: [
        {
          name: '告警区域分布',
          type: 'pie',
          radius: ['48%', '72%'],
          center: ['50%', '52%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#0c1118',
            borderWidth: 2,
          },
          label: {
            color: 'rgba(255,255,255,0.72)',
            fontSize: 11,
            formatter: '{b}\n{c}',
          },
          labelLine: {
            length: 10,
            length2: 8,
            lineStyle: { color: 'rgba(255,255,255,0.22)' },
          },
          data: chartData,
        },
      ],
    };
  }, [locationStats]);

  const selectedRecord = useMemo(() => {
    return allRecords.find((record) => getRecordKey(record) === selectedRecordId) ?? null;
  }, [allRecords, selectedRecordId]);
  const selectedAlarmLevelMeta = getLevelMeta(selectedRecord?.level ?? '1');
  const isSelectedRecordLocallyRead = selectedRecord ? locallyReadRecordIds.has(getRecordKey(selectedRecord)) : false;

  const startIndex = result.total === 0 ? 0 : pageStart + 1;
  const endIndex = Math.min(pageStart + appliedFilters.pageSize, result.total);

  useEffect(() => {
    if (!selectedRecordId) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedRecordId(null);
        setProcessStatus('idle');
        setProcessMessage('');
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedRecordId]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAlarmData() {
      setApiMessage('');

      if (isMockOnly) {
        const mockData = queryAlarmPageApi(allQuery).data;
        setAlarmPageData(mockData);
        setKnownLocations((current) => Array.from(new Set([
          ...current,
          ...mockData.list.map((record) => record.locationName),
        ].filter(Boolean))));
        setApiStatus('mock');
        return;
      }

      setApiStatus('loading');

      try {
        const pageResponse = await fetch(buildApiUrl(buildAlarmPageApiPath(allQuery)), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        if (!pageResponse.ok) throw new Error(`HTTP ${pageResponse.status}`);

        const pagePayload = await pageResponse.json() as unknown;
        const pageData = pickAlarmPageData(pagePayload);
        setAlarmPageData(pageData);
        setKnownLocations((current) => Array.from(new Set([
          ...current,
          ...pageData.list.map((record) => record.locationName),
        ].filter(Boolean))));
        setApiStatus('success');
      } catch {
        if (controller.signal.aborted) return;

        if (canUseMockData) {
          const fallbackData = queryAlarmPageApi(allQuery).data;
          setAlarmPageData(fallbackData);
          setKnownLocations((current) => Array.from(new Set([
            ...current,
            ...fallbackData.list.map((record) => record.locationName),
          ].filter(Boolean))));
          setApiStatus('fallback');
        } else {
          setAlarmPageData({ total: 0, list: [] });
          setApiStatus('error');
        }

        setApiMessage(canUseMockData ? '数据加载异常，已展示备用数据' : '加载失败，请稍后重试');
      }
    }

    loadAlarmData();

    return () => controller.abort();
  }, [allQuery, queryVersion]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLocationStats() {
      setStatsMessage('');

      if (isMockOnly) {
        const mockStats = queryAlarmStatsByLocationApi(locationStatQuery).data;
        setLocationStats(mockStats);
        setKnownLocations((current) => Array.from(new Set([
          ...current,
          ...mockStats.map((stat) => stat.locationName),
        ].filter(Boolean))));
        setStatsStatus('mock');
        return;
      }

      setStatsStatus('loading');

      try {
        const response = await fetch(buildApiUrl(buildAlarmLocationStatApiPath(locationStatQuery)), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = await response.json() as unknown;
        const stats = pickLocationStats(payload);
        setLocationStats(stats);
        setKnownLocations((current) => Array.from(new Set([
          ...current,
          ...stats.map((stat) => stat.locationName),
        ].filter(Boolean))));
        setStatsStatus('success');
      } catch {
        if (controller.signal.aborted) return;

        if (canUseMockData) {
          const fallbackStats = queryAlarmStatsByLocationApi(locationStatQuery).data;
          setLocationStats(fallbackStats);
          setKnownLocations((current) => Array.from(new Set([
            ...current,
            ...fallbackStats.map((stat) => stat.locationName),
          ].filter(Boolean))));
          setStatsStatus('fallback');
        } else {
          setLocationStats([]);
          setStatsStatus('error');
        }

        setStatsMessage(canUseMockData ? '区域统计加载异常，已展示备用数据' : '区域统计加载失败，请稍后重试');
      }
    }

    loadLocationStats();

    return () => controller.abort();
  }, [locationStatQuery, queryVersion]);

  const updateLocation = (locationName: string) => {
    setDraftFilters((current) => ({ ...current, locationName }));
  };

  const updateReadFilter = (isRead: AlarmReadFilter) => {
    setDraftFilters((current) => ({ ...current, isRead }));
  };

  const submitQuery = () => {
    setPageNum(1);
    setTimeRange(getRecentSevenDayRange());
    setAppliedFilters({ ...draftFilters });
    // Bump version so identical filters still re-request /alarm/page.
    setQueryVersion((current) => current + 1);
  };

  const openAlarmDetail = (record: AlarmPageRecord) => {
    const recordKey = getRecordKey(record);
    setSelectedRecordId(recordKey);
    setProcessor(record.processor?.trim() || getDefaultProcessor(user?.name, user?.username));
    setProcessContent(record.processContent ?? '');
    setProcessStatus('idle');
    setProcessMessage('');

    if (record.isRead === 0) {
      setLocallyReadRecordIds((current) => {
        if (current.has(recordKey)) return current;
        return new Set(current).add(recordKey);
      });
    }
  };

  const closeAlarmDetail = () => {
    setSelectedRecordId(null);
    setProcessStatus('idle');
    setProcessMessage('');
  };

  const applyLocalProcessResult = (
    request: AlarmBatchProcessRequest,
    recordKey: string,
  ) => {
    const processTime = formatDateTimeValue(new Date());
    const eventIds = new Set(request.eventIds);

    setAlarmPageData((current) => ({
      ...current,
      list: current.list.map((record) => {
        if (!eventIds.has(record.eventId)) return record;
        return {
          ...record,
          isRead: 1,
          processor: request.processor,
          processContent: request.processContent,
          processTime,
        };
      }),
    }));

    setLocallyReadRecordIds((current) => {
      if (current.has(recordKey)) return current;
      return new Set(current).add(recordKey);
    });
  };

  const submitProcess = async () => {
    if (!selectedRecord) return;

    const recordKey = getRecordKey(selectedRecord);
    const request: AlarmBatchProcessRequest = {
      eventIds: [selectedRecord.eventId],
      processor: processor.trim(),
      processContent: processContent.trim(),
    };

    if (!request.processor) {
      setProcessStatus('error');
      setProcessMessage('请填写处理人');
      return;
    }

    if (!request.processContent) {
      setProcessStatus('error');
      setProcessMessage('请填写处理内容');
      return;
    }

    setProcessStatus('loading');
    setProcessMessage('');

    if (isMockOnly) {
      try {
        processAlarmBatchApi(request);
        applyLocalProcessResult(request, recordKey);
        setProcessStatus('mock');
        setProcessMessage('处理完成');
        setQueryVersion((current) => current + 1);
      } catch (error) {
        setProcessStatus('error');
        setProcessMessage(error instanceof Error ? error.message : '处理失败');
      }
      return;
    }

    try {
      const response = await fetch(buildApiUrl(buildAlarmBatchProcessApiPath()), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json() as unknown;
      pickBatchProcessResult(payload);
      applyLocalProcessResult(request, recordKey);
      setProcessStatus('success');
      setProcessMessage('处理成功');
      setQueryVersion((current) => current + 1);
    } catch {
      if (canUseMockData) {
        try {
          processAlarmBatchApi(request);
          applyLocalProcessResult(request, recordKey);
          setProcessStatus('fallback');
          setProcessMessage('处理通道异常，已写入备用记录');
          setQueryVersion((current) => current + 1);
          return;
        } catch {
          // fall through to error
        }
      }

      setProcessStatus('error');
      setProcessMessage('处理失败，请稍后重试');
    }
  };

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
        .alarm-stats-panel {
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-elevated);
        }

        .alarm-control-panel {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 12px;
          padding: 12px;
          flex-wrap: wrap;
        }

        .alarm-filter-row {
          display: flex;
          align-items: end;
          gap: 12px;
          flex-wrap: wrap;
          min-width: 0;
          flex: 1;
        }

        .alarm-field {
          min-width: 160px;
          display: grid;
          gap: 5px;
        }

        .alarm-field span {
          font-size: 11px;
          color: var(--text-tertiary);
        }

        .alarm-field > select {
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

        .alarm-field > select:focus {
          border-color: rgba(10, 132, 255, 0.62);
        }

        .alarm-shortcuts,
        .alarm-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
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
        .alarm-pill-button[data-active='true'] {
          border-color: rgba(10, 132, 255, 0.5);
          color: var(--text-primary);
          background: rgba(10, 132, 255, 0.1);
        }

        .alarm-query-button {
          min-width: 72px;
          border-color: rgba(10, 132, 255, 0.55);
          background: rgba(10, 132, 255, 0.92);
          color: #fff;
        }

        .alarm-query-button:hover {
          border-color: rgba(10, 132, 255, 0.8);
          background: rgba(10, 132, 255, 1);
          color: #fff;
        }

        .alarm-text-button:disabled,
        .alarm-query-button:disabled,
        .alarm-icon-button:disabled {
          opacity: 0.42;
          cursor: not-allowed;
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

        .alarm-records-panel {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .alarm-stats-panel {
          padding: 14px 16px 16px;
        }

        .alarm-stats-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .alarm-stats-title {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex-wrap: wrap;
        }

        .alarm-stats-title h2 {
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 600;
        }

        .alarm-stats-title span,
        .alarm-stats-meta {
          color: var(--text-tertiary);
          font-size: 12px;
        }

        .alarm-stats-body {
          display: grid;
          grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
          gap: 16px;
          align-items: stretch;
        }

        .alarm-location-chart {
          width: 100%;
          height: 240px;
        }

        .alarm-stats-table-wrap {
          min-width: 0;
          overflow: auto;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
        }

        .alarm-stats-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .alarm-stats-table th,
        .alarm-stats-table td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          white-space: nowrap;
        }

        .alarm-stats-table th {
          color: var(--text-tertiary);
          font-weight: 500;
          background: rgba(255, 255, 255, 0.03);
        }

        .alarm-stats-table td {
          color: var(--text-secondary);
          font-family: var(--font-mono);
        }

        .alarm-stats-table td:first-child {
          color: var(--text-primary);
          font-family: inherit;
          font-weight: 500;
        }

        .alarm-stats-table tr:last-child td {
          border-bottom: none;
        }

        .alarm-stats-empty {
          min-height: 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 13px;
        }

        .alarm-records-toolbar {
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 14px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .alarm-records-title {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .alarm-records-title h2 {
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 600;
        }

        .alarm-records-title span {
          color: var(--text-tertiary);
          font-size: 11px;
        }

        .alarm-record-list {
          flex: 1;
          min-height: 0;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px 14px;
        }

        .alarm-record-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 64px;
          padding: 12px 14px 12px 16px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.03);
          cursor: pointer;
          overflow: hidden;
          transition: background var(--transition-fast), border-color var(--transition-fast);
        }

        .alarm-record-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.14);
        }

        .alarm-record-card[data-unread='true'] {
          background: rgba(255, 69, 58, 0.05);
        }

        .alarm-record-card[data-selected='true'] {
          border-color: rgba(10, 132, 255, 0.45);
          background: rgba(10, 132, 255, 0.1);
        }

        .alarm-record-card:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: -2px;
        }

        .alarm-record-bar {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
        }

        .alarm-record-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .alarm-record-body {
          min-width: 0;
          flex: 1;
        }

        .alarm-record-body strong {
          display: block;
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 600;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .alarm-record-body p {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 4px 0;
          margin-top: 4px;
          color: var(--text-tertiary);
          font-size: 12px;
          font-family: var(--font-mono);
          line-height: 1.35;
        }

        .alarm-record-body em {
          font-style: normal;
          font-weight: 600;
        }

        .alarm-record-divider {
          margin: 0 8px;
          color: rgba(255, 255, 255, 0.22);
          font-weight: 400;
        }

        .alarm-pagination {
          min-height: 42px;
          padding: 0 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-top: 1px solid var(--border-subtle);
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

        .alarm-detail-backdrop {
          position: fixed;
          z-index: 1000;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(0, 0, 0, 0.68);
          backdrop-filter: blur(4px);
          animation: alarm-detail-fade-in 160ms ease-out;
        }

        .alarm-detail-modal {
          width: min(900px, 100%);
          max-height: min(760px, calc(100vh - 48px));
          overflow: auto;
          padding: 28px;
          border: 1px solid rgba(10, 132, 255, 0.42);
          border-radius: 12px;
          background: linear-gradient(145deg, #111a25 0%, #0c1118 100%);
          box-shadow: 0 22px 80px rgba(0, 0, 0, 0.62), 0 0 0 1px rgba(255, 255, 255, 0.035) inset;
          animation: alarm-detail-rise-in 180ms ease-out;
        }

        .alarm-detail-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .alarm-detail-head h2,
        .alarm-detail-head h3 {
          color: var(--text-primary);
          font-size: 18px;
          font-weight: 600;
        }

        .alarm-detail-head p {
          margin-top: 5px;
          color: var(--text-tertiary);
          font-size: 13px;
        }

        .alarm-detail-close {
          min-width: 54px;
          min-height: 36px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 7px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.055);
          color: var(--text-primary);
          cursor: pointer;
          font-size: 13px;
        }

        .alarm-detail-close:hover {
          border-color: rgba(10, 132, 255, 0.55);
          background: rgba(10, 132, 255, 0.13);
        }

        .alarm-detail-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px 24px;
        }

        .alarm-detail-grid div {
          min-width: 0;
        }

        .alarm-detail-grid span {
          display: block;
          color: var(--text-tertiary);
          font-size: 12px;
        }

        .alarm-detail-grid strong {
          display: block;
          margin-top: 5px;
          color: var(--text-primary);
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 500;
          overflow-wrap: anywhere;
        }

        .alarm-process-panel {
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .alarm-process-panel h4 {
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 600;
        }

        .alarm-process-fields {
          display: grid;
          grid-template-columns: 180px minmax(0, 1fr);
          gap: 12px;
        }

        .alarm-process-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .alarm-process-field span {
          color: var(--text-tertiary);
          font-size: 12px;
        }

        .alarm-process-field input,
        .alarm-process-field textarea {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-primary);
          font-size: 13px;
          padding: 8px 10px;
          outline: none;
          font-family: inherit;
        }

        .alarm-process-field textarea {
          min-height: 84px;
          resize: vertical;
          line-height: 1.45;
        }

        .alarm-process-field input:focus,
        .alarm-process-field textarea:focus {
          border-color: rgba(10, 132, 255, 0.62);
        }

        .alarm-process-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .alarm-process-message {
          font-size: 12px;
          color: var(--text-tertiary);
        }

        .alarm-process-message[data-tone='error'] {
          color: var(--status-error);
        }

        .alarm-process-message[data-tone='success'] {
          color: var(--status-success, #30d158);
        }

        .alarm-process-message[data-tone='warning'] {
          color: var(--status-warning);
        }

        @keyframes alarm-detail-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes alarm-detail-rise-in {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (max-width: 860px) {
          .alarm-control-panel,
          .alarm-pagination,
          .alarm-records-toolbar,
          .alarm-stats-toolbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .alarm-field {
            width: 100%;
          }

          .alarm-stats-body {
            grid-template-columns: 1fr;
          }

          .alarm-detail-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .alarm-process-fields {
            grid-template-columns: 1fr;
          }

          .alarm-detail-backdrop {
            padding: 14px;
          }

          .alarm-detail-modal {
            padding: 20px;
          }

          .alarm-record-body strong,
          .alarm-record-body p {
            white-space: normal;
          }
        }

        @media (max-width: 560px) {
          .alarm-detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="alarm-control-panel">
        <div className="alarm-filter-row">
          <label className="alarm-field">
            <span>区域</span>
            <select
              value={draftFilters.locationName}
              onChange={(event) => updateLocation(event.target.value)}
            >
              <option value="">全部区域</option>
              {locationNames.map((locationName) => (
                <option key={locationName} value={locationName}>
                  {locationName}
                </option>
              ))}
            </select>
          </label>

          <div className="alarm-shortcuts" aria-label="阅读状态筛选">
            <button
              className="alarm-pill-button"
              type="button"
              data-active={draftFilters.isRead === 'all'}
              onClick={() => updateReadFilter('all')}
            >
              全部
            </button>
            <button
              className="alarm-pill-button"
              type="button"
              data-active={draftFilters.isRead === '0'}
              onClick={() => updateReadFilter('0')}
            >
              未读
            </button>
            <button
              className="alarm-pill-button"
              type="button"
              data-active={draftFilters.isRead === '1'}
              onClick={() => updateReadFilter('1')}
            >
              已读
            </button>
          </div>
        </div>

        <div className="alarm-actions">
          <button
            className="alarm-text-button alarm-query-button"
            type="button"
            onClick={submitQuery}
            disabled={apiStatus === 'loading' || statsStatus === 'loading'}
          >
            {apiStatus === 'loading' || statsStatus === 'loading' ? '查询中' : '查询'}
          </button>
        </div>

        {apiMessage && (
          <div className="alarm-api-message" role="status">
            {apiStatus === 'fallback' ? '数据加载异常，已展示备用数据' : apiMessage}
          </div>
        )}
        {statsMessage && (
          <div className="alarm-api-message" role="status">
            {statsStatus === 'fallback'
              ? '区域统计加载异常，已展示备用数据'
              : statsMessage}
          </div>
        )}
      </div>

      <div className="alarm-stats-panel">
        <div className="alarm-stats-toolbar">
          <div className="alarm-stats-title">
            <AlertTriangle size={16} color="var(--status-warning)" />
            <h2>告警区域分布</h2>
            <span>
              共 {locationStatSummary.alarmCount} 条 · 未读 {locationStatSummary.unreadCount} 条
              {statsStatus === 'loading' ? ' · 统计中' : ''}
            </span>
          </div>
          <div className="alarm-stats-meta">
            {timeRange.startTime} ~ {timeRange.endTime}
          </div>
        </div>

        {locationStats.length === 0 ? (
          <div className="alarm-stats-empty">
            {statsStatus === 'loading' ? '正在加载区域统计…' : '暂无区域统计数据'}
          </div>
        ) : (
          <div className="alarm-stats-body">
            <AlarmLocationChart option={locationChartOption} label="告警区域分布" />
            <div className="alarm-stats-table-wrap">
              <table className="alarm-stats-table">
                <thead>
                  <tr>
                    <th>区域</th>
                    <th>告警数</th>
                    <th>未读</th>
                    <th>最高温</th>
                    <th>最低温</th>
                  </tr>
                </thead>
                <tbody>
                  {[...locationStats]
                    .sort((left, right) => right.alarmCount - left.alarmCount)
                    .map((stat) => (
                      <tr key={stat.locationName}>
                        <td>{stat.locationName}</td>
                        <td>{stat.alarmCount}</td>
                        <td>{stat.unreadCount}</td>
                        <td>{stat.maxTemp.toFixed(1)}℃</td>
                        <td>{stat.minTemp.toFixed(1)}℃</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="alarm-records-panel">
        <div className="alarm-records-toolbar">
          <div className="alarm-records-title">
            <AlertTriangle size={16} color="var(--status-warning)" />
            <h2>告警记录列表</h2>
            <span>共 {result.total} 条 · 近 7 天</span>
          </div>
        </div>

        <div className="alarm-record-list">
          {result.list.map((record) => {
            const recordKey = getRecordKey(record);
            return (
              <AlarmRecordCard
                key={recordKey}
                record={record}
                selected={selectedRecordId === recordKey}
                onOpen={openAlarmDetail}
              />
            );
          })}

          {result.list.length === 0 && (
            <div className="alarm-empty">
              <CheckCircle2 size={34} strokeWidth={1.2} />
              <span style={{ fontSize: 13 }}>暂无符合条件的告警记录</span>
            </div>
          )}
        </div>

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

      {selectedRecord && (
        <div className="alarm-detail-backdrop" role="presentation" onMouseDown={closeAlarmDetail}>
          <section
            className="alarm-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="alarm-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              borderColor: selectedAlarmLevelMeta.modalBorder,
              background: selectedAlarmLevelMeta.modalBackground,
              boxShadow: '0 22px 80px rgba(0, 0, 0, 0.62)',
            }}
          >
            <div className="alarm-detail-head">
              <div>
                <h3 id="alarm-detail-title">告警详情</h3>
                <p>
                  {selectedRecord.processTime
                    ? '已处理告警，可补充提交处理记录'
                    : isSelectedRecordLocallyRead
                      ? '未处理告警 · 已在当前页面标记为已读'
                      : '未处理告警 · 填写处理信息后提交'}
                </p>
              </div>
              <button className="alarm-detail-close" type="button" onClick={closeAlarmDetail} aria-label="关闭告警详情">
                关闭
              </button>
            </div>
            <div className="alarm-detail-grid">
              <div><span>设备 ID</span><strong>{selectedRecord.devId}</strong></div>
              <div><span>区域 / 通道</span><strong>{selectedRecord.locationName} / {selectedRecord.channelName}</strong></div>
              <div><span>报警事项 / 等级</span><strong>{selectedRecord.ruleType} / {selectedRecord.level}级</strong></div>
              <div><span>报警时间</span><strong>{selectedRecord.eventTimeStamp}</strong></div>
              <div><span>温度（均/低/高）</span><strong>{selectedRecord.avgTemp.toFixed(1)} / {selectedRecord.minTemp.toFixed(1)} / {selectedRecord.maxTemp.toFixed(1)} ℃</strong></div>
              <div><span>阈值 / 次数</span><strong>{selectedRecord.thresholdTemp.toFixed(1)} ℃ / {selectedRecord.num}</strong></div>
              <div><span>处理人</span><strong>{selectedRecord.processor ?? '-'}</strong></div>
              <div><span>处理时间</span><strong>{selectedRecord.processTime ?? '-'}</strong></div>
              <div><span>处理内容</span><strong>{selectedRecord.processContent ?? '-'}</strong></div>
            </div>

            <div className="alarm-process-panel">
              <h4>事件处理</h4>
              <div className="alarm-process-fields">
                <label className="alarm-process-field">
                  <span>处理人</span>
                  <input
                    value={processor}
                    onChange={(event) => setProcessor(event.target.value)}
                    placeholder="例如：张三"
                    disabled={processStatus === 'loading'}
                    aria-label="处理人"
                  />
                </label>
                <label className="alarm-process-field">
                  <span>处理内容</span>
                  <textarea
                    value={processContent}
                    onChange={(event) => setProcessContent(event.target.value)}
                    placeholder="例如：已现场排查，恢复正常"
                    disabled={processStatus === 'loading'}
                    aria-label="处理内容"
                  />
                </label>
              </div>
              <div className="alarm-process-actions">
                <span
                  className="alarm-process-message"
                  data-tone={
                    processStatus === 'error'
                      ? 'error'
                      : processStatus === 'success' || processStatus === 'mock'
                        ? 'success'
                        : processStatus === 'fallback'
                          ? 'warning'
                          : undefined
                  }
                  role="status"
                >
                  {processMessage || '提交后将保存处理记录'}
                </span>
                <button
                  className="alarm-text-button alarm-query-button"
                  type="button"
                  onClick={() => void submitProcess()}
                  disabled={processStatus === 'loading'}
                >
                  {processStatus === 'loading' ? '提交中' : '提交处理'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
