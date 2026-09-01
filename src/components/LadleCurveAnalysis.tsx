'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import dayjs from 'dayjs';
import {
  buildLadleChartListPath,
  formatLadleDateTime,
  getMockLadleNos,
  queryLadleChartList,
} from '@/data/ladle-api-config';
import {
  buildApiUrl,
  canUseMockData,
  isMockOnly,
  unwrapApiData,
} from '@/lib/api-config';
import type { LadleChartPoint } from '@/types/ladle-api';
import styles from './LadleCurveAnalysis.module.css';

type QueryStatus = 'idle' | 'loading' | 'success' | 'mock' | 'fallback' | 'error';

function linePath(values: number[], min: number, max: number) {
  return values.map((value, index) => {
    const x = 52 + index * (866 / Math.max(values.length - 1, 1));
    const y = 184 - ((value - min) / Math.max(max - min, 1)) * 144;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

export default function LadleCurveAnalysis() {
  const [ladleNo, setLadleNo] = useState('Y-111');
  const [startTime, setStartTime] = useState(formatLadleDateTime(dayjs().subtract(1, 'day').toDate()));
  const [endTime, setEndTime] = useState(formatLadleDateTime(new Date()));
  const [points, setPoints] = useState<LadleChartPoint[]>([]);
  const [status, setStatus] = useState<QueryStatus>('idle');
  const [message, setMessage] = useState('');
  const ladleOptions = useMemo(() => getMockLadleNos(), []);

  const loadData = async () => {
    setMessage('');
    const query = { ladleNo, startTime, endTime };

    if (isMockOnly) {
      setPoints(queryLadleChartList(query).data);
      setStatus('mock');
      return;
    }

    setStatus('loading');
    try {
      const response = await fetch(buildApiUrl(buildLadleChartListPath(query)), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as unknown;
      const data = unwrapApiData(payload) as LadleChartPoint[];
      setPoints(Array.isArray(data) ? data : []);
      setStatus('success');
    } catch {
      if (canUseMockData) {
        setPoints(queryLadleChartList(query).data);
        setStatus('fallback');
        setMessage('接口异常，已展示演示数据');
      } else {
        setPoints([]);
        setStatus('error');
        setMessage('加载失败，请稍后重试');
      }
    }
  };

  useEffect(() => {
    void loadData();
  }, [ladleNo, startTime, endTime]);

  const maxSeries = points.map((point) => point.maxTemp);
  const avgSeries = points.map((point) => point.avgTemp);
  const minSeries = points.map((point) => point.minTemp);
  const series = [
    { name: '最高温度', values: maxSeries, color: '#22d3ee' },
    { name: '平均温度', values: avgSeries, color: '#fbbf24' },
    { name: '最低温度', values: minSeries, color: '#34d399' },
  ];
  const values = series.flatMap((item) => item.values);
  const min = values.length > 0 ? Math.floor(Math.min(...values) / 5) * 5 - 5 : 0;
  const max = values.length > 0 ? Math.ceil(Math.max(...values) / 5) * 5 + 5 : 100;
  const latest = maxSeries.at(-1) ?? 0;

  return (
    <section className={styles.shell} aria-label="钢包曲线分析">
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><BarChart3 size={14} aria-hidden="true" /> 温度曲线</span>
          <h2>曲线分析</h2>
          <p>按钢包号与时间范围查询 `/ladle-chart/list` 聚合温度趋势。</p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => void loadData()}>
          <RefreshCw size={15} aria-hidden="true" /> 刷新
        </button>
      </header>

      {message && <p style={{ color: '#9de4c7', fontSize: 12, marginBottom: 10 }}>{message}</p>}

      <section className={styles.filters} aria-label="曲线筛选条件">
        <label>钢包编号<select value={ladleNo} onChange={(event) => setLadleNo(event.target.value)}>{ladleOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>开始时间<input value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
        <label>结束时间<input value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
      </section>

      <div className={styles.kpis}>
        <div><span>当前最高温</span><b>{latest.toFixed(0)}<small>°C</small></b><em>{status === 'loading' ? '加载中' : `${points.length} 个采样点`}</em></div>
        <div><span>峰值温度</span><b>{Math.max(...maxSeries, 0).toFixed(0)}<small>°C</small></b><em>本周期最高</em></div>
        <div><span>平均温度</span><b>{(avgSeries.reduce((sum, value) => sum + value, 0) / Math.max(avgSeries.length, 1)).toFixed(1)}<small>°C</small></b><em>聚合结果</em></div>
        <div><span>关联钢包</span><b>{ladleNo}</b><em>API 文档样例字段</em></div>
      </div>

      <section className={styles.chartPanel}>
        <div className={styles.panelHeader}>
          <div><h3>单钢包温度趋势</h3><p>{startTime} — {endTime}</p></div>
          <div className={styles.legend}>{series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}</div>
        </div>
        <div className={styles.chartWrap}>
          {points.length === 0 ? (
            <p style={{ padding: 24, color: 'var(--text-muted)' }}>当前时间范围内暂无曲线数据。</p>
          ) : (
            <svg viewBox="0 0 940 220" role="img" aria-label={`${ladleNo} 温度曲线`}>
              {Array.from({ length: 5 }, (_, index) => {
                const tick = min + ((max - min) * index) / 4;
                const y = 184 - ((tick - min) / Math.max(max - min, 1)) * 144;
                return <g key={tick}><line x1="52" x2="918" y1={y} y2={y} className={styles.gridLine} /><text x="8" y={y + 4} className={styles.axisLabel}>{tick.toFixed(0)}°C</text></g>;
              })}
              {series.map((item) => (
                <path key={item.name} d={linePath(item.values, min, max)} className={styles.series} style={{ stroke: item.color }} />
              ))}
              <line x1="52" x2="918" y1="184" y2="184" className={styles.axisLine} />
              {points.map((point, index) => (
                <text
                  key={point.recordTime}
                  x={52 + index * (866 / Math.max(points.length - 1, 1))}
                  y="208"
                  textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
                  className={styles.axisLabel}
                >
                  {point.recordTime.slice(11, 16)}
                </text>
              ))}
            </svg>
          )}
        </div>
      </section>
    </section>
  );
}
