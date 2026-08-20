'use client';

import { useMemo, useState } from 'react';
import { BarChart3, Download, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { ladleAssets } from '@/data/ladle-assets';
import styles from './LadleCurveAnalysis.module.css';

type AnalysisMode = 'devices' | 'ladle' | 'slag';
type Range = '4h' | '8h' | '24h';

const modes: Array<{ id: AnalysisMode; label: string }> = [
  { id: 'devices', label: '多设备温度对比' },
  { id: 'ladle', label: '单钢包温度趋势' },
  { id: 'slag', label: '渣线深度趋势' },
];

const modeDescription: Record<AnalysisMode, string> = {
  devices: '对比三个热像仪在同一时段的最高温度，辅助判断工位热负荷。',
  ladle: '关联包号、OCR 识别与红外测温记录，观察单包使用过程的温度变化。',
  slag: '按最近检测批次跟踪渣线深度，辅助安排热修和内衬检查。',
};

function createSeries(mode: AnalysisMode, size: number, assetIndex: number) {
  const base = mode === 'slag' ? 20 + assetIndex * 2 : 485 - assetIndex * 3;
  const step = mode === 'slag' ? 0.22 : 0;
  const amplitude = mode === 'slag' ? 2.8 : 11;
  const offsets = mode === 'devices' ? [0, -22, -43] : [0, -7, -13];
  const names = mode === 'slag'
    ? ['检测最大深度', '预警参考线', '安全参考线']
    : mode === 'devices'
      ? ['IR-01 出钢位', 'IR-02 浇铸位', 'IR-03 热修位']
      : ['最高温度', '平均温度', '最低温度'];

  return names.map((name, seriesIndex) => ({
    name,
    values: Array.from({ length: size }, (_, index) => {
      if (mode === 'slag' && seriesIndex > 0) return seriesIndex === 1 ? 30 : 26;
      return base + offsets[seriesIndex] + step * index + Math.sin(index * .53 + seriesIndex) * amplitude + Math.cos(index * .17) * (amplitude * .38);
    }),
  }));
}

function linePath(values: number[], min: number, max: number) {
  return values.map((value, index) => {
    const x = 52 + index * (866 / Math.max(values.length - 1, 1));
    const y = 184 - ((value - min) / Math.max(max - min, 1)) * 144;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

export default function LadleCurveAnalysis() {
  const [mode, setMode] = useState<AnalysisMode>('devices');
  const [range, setRange] = useState<Range>('8h');
  const [ladleId, setLadleId] = useState(ladleAssets[0].id);
  const [refreshKey, setRefreshKey] = useState(0);
  const size = range === '4h' ? 24 : range === '8h' ? 48 : 72;
  const assetIndex = Math.max(0, ladleAssets.findIndex((asset) => asset.id === ladleId));
  const series = useMemo(() => createSeries(mode, size, assetIndex + refreshKey), [assetIndex, mode, refreshKey, size]);
  const values = series.flatMap((item) => item.values);
  const min = Math.floor(Math.min(...values) / 5) * 5 - (mode === 'slag' ? 2 : 5);
  const max = Math.ceil(Math.max(...values) / 5) * 5 + (mode === 'slag' ? 2 : 5);
  const latest = series[0].values.at(-1) ?? 0;
  const palette = mode === 'slag' ? ['#22d3ee', '#fbbf24', '#34d399'] : ['#22d3ee', '#fbbf24', '#34d399'];
  const unit = mode === 'slag' ? 'mm' : '°C';
  const chartTicks = Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4);

  return (
    <section className={styles.shell} aria-label="钢包曲线分析">
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><BarChart3 size={14} aria-hidden="true" /> 曲线分析</span>
          <h2>曲线分析</h2>
          <p>{modeDescription[mode]}</p>
        </div>
        <button type="button" className={styles.exportButton}><Download size={15} aria-hidden="true" /> 导出当前视图</button>
      </header>

      <section className={styles.filters} aria-label="曲线筛选条件">
        <div className={styles.modeTabs} role="tablist" aria-label="分析方式">
          {modes.map((item) => <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? styles.active : ''} onClick={() => setMode(item.id)}>{item.label}</button>)}
        </div>
        <label>钢包编号<select value={ladleId} onChange={(event) => setLadleId(event.target.value)}>{ladleAssets.map((asset) => <option key={asset.id}>{asset.id}</option>)}</select></label>
        <label>时间范围<select value={range} onChange={(event) => setRange(event.target.value as Range)}><option value="4h">最近 4 小时</option><option value="8h">最近 8 小时</option><option value="24h">最近 24 小时</option></select></label>
        <button type="button" className={styles.refreshButton} onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={15} aria-hidden="true" /> 刷新</button>
      </section>

      <div className={styles.kpis}>
        <div><span>当前读数</span><b>{latest.toFixed(mode === 'slag' ? 1 : 0)}<small>{unit}</small></b><em className={mode === 'slag' && latest > 30 ? styles.warning : styles.ok}>● {mode === 'slag' && latest > 30 ? '需关注' : '运行正常'}</em></div>
        <div><span>{mode === 'slag' ? '本周期最大深度' : '本周期最高温度'}</span><b>{Math.max(...series[0].values).toFixed(mode === 'slag' ? 1 : 0)}<small>{unit}</small></b><em>采样间隔 5 min</em></div>
        <div><span>{mode === 'slag' ? '相较上周期' : '温度波动范围'}</span><b>{mode === 'slag' ? '+ 1.8' : `± ${Math.round((Math.max(...series[0].values) - Math.min(...series[0].values)) / 2)}`}<small>{unit}</small></b><em>数据质量 99.6%</em></div>
        <div><span>关联钢包</span><b>{ladleId}</b><em>{mode === 'slag' ? '双雷达融合检测' : 'OCR 自动关联'}</em></div>
      </div>

      <section className={styles.chartPanel}>
        <div className={styles.panelHeader}>
          <div><h3>{modes.find((item) => item.id === mode)?.label}</h3><p>{range === '4h' ? '08:00 — 12:00' : range === '8h' ? '04:00 — 12:00' : '昨日 12:00 — 今日 12:00'} · 当前包号 {ladleId}</p></div>
          <div className={styles.legend}>{series.map((item, index) => <span key={item.name}><i style={{ background: palette[index] }} />{item.name}</span>)}</div>
        </div>
        <div className={styles.chartWrap}>
          <svg viewBox="0 0 940 220" role="img" aria-label={`${ladleId}${modes.find((item) => item.id === mode)?.label}`}>
            {chartTicks.map((tick) => { const y = 184 - ((tick - min) / Math.max(max - min, 1)) * 144; return <g key={tick}><line x1="52" x2="918" y1={y} y2={y} className={styles.gridLine} /><text x="8" y={y + 4} className={styles.axisLabel}>{tick.toFixed(0)}{unit}</text></g>; })}
            {[0, .25, .5, .75, 1].map((position) => <line key={position} x1={52 + position * 866} x2={52 + position * 866} y1="24" y2="184" className={styles.verticalLine} />)}
            {series.map((item, index) => <path key={item.name} d={linePath(item.values, min, max)} className={styles.series} style={{ stroke: palette[index], strokeDasharray: mode === 'slag' && index > 0 ? '6 6' : undefined }} />)}
            <line x1="52" x2="918" y1="184" y2="184" className={styles.axisLine} />
            {['起始', '25%', '50%', '75%', '当前'].map((label, index) => <text key={label} x={52 + index * 216.5} y="208" textAnchor={index === 0 ? 'start' : index === 4 ? 'end' : 'middle'} className={styles.axisLabel}>{label}</text>)}
          </svg>
        </div>
      </section>

      <section className={styles.events}>
        <div className={styles.panelHeader}><div><h3>关联事件</h3><p>由温度、OCR 与雷达检测自动归档</p></div><SlidersHorizontal size={16} aria-hidden="true" /></div>
        <div className={styles.eventList}>
          <div><time>11:42</time><span className={styles.dot} /><p><b>IR-01 温度峰值</b>　当前包号 {ladleId}，最高温 {Math.round(Math.max(...series[0].values))}°C</p></div>
          <div><time>10:30</time><span className={styles.dot} /><p><b>OCR 识别完成</b>　包号 {ladleId}，置信度 99.6%</p></div>
          <div><time>08:30</time><span className={styles.dot} /><p><b>雷达检测归档</b>　渣线最大深度 {ladleAssets[assetIndex].slagDepth}mm</p></div>
        </div>
      </section>
    </section>
  );
}
