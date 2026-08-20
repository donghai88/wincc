'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowLeft, CheckCircle2, Radar, ScanLine, TriangleAlert } from 'lucide-react';
import type { WinCCInstance } from '@/types/template';
import workspaceStyles from './MonitoringWorkspace.module.css';
import styles from './SlagLineMonitor.module.css';

type ViewMode = 'iso' | 'top' | 'side' | 'section';
type Rating = 'safe' | 'warning' | 'danger';

interface SlagRecord {
  time: string;
  depth: number;
  defects: number;
  rating: Rating;
}

interface SlagLineThresholds {
  safe: number;
  danger: number;
}

const initialRecords: Record<string, SlagRecord[]> = {
  A3256: [
    { time: '2026-06-26 08:30', depth: 22.5, defects: 1, rating: 'safe' },
    { time: '2026-06-20 14:15', depth: 21.8, defects: 0, rating: 'safe' },
    { time: '2026-06-14 09:00', depth: 20.1, defects: 0, rating: 'safe' },
  ],
  A3241: [
    { time: '2026-06-25 16:00', depth: 38.7, defects: 3, rating: 'warning' },
    { time: '2026-06-18 11:20', depth: 35.2, defects: 2, rating: 'warning' },
    { time: '2026-06-11 08:45', depth: 31.8, defects: 1, rating: 'warning' },
  ],
  A3198: [
    { time: '2026-06-24 10:00', depth: 42.3, defects: 4, rating: 'warning' },
    { time: '2026-06-17 14:30', depth: 39.5, defects: 3, rating: 'warning' },
    { time: '2026-06-10 09:15', depth: 35.8, defects: 2, rating: 'warning' },
  ],
  A3302: [
    { time: '2026-06-23 15:30', depth: 18.2, defects: 0, rating: 'safe' },
    { time: '2026-06-16 10:00', depth: 16.5, defects: 0, rating: 'safe' },
  ],
  A3277: [
    { time: '2026-06-22 11:00', depth: 28.5, defects: 1, rating: 'safe' },
    { time: '2026-06-15 14:20', depth: 26.3, defects: 1, rating: 'safe' },
  ],
};

const DEFAULT_SLAG_LINE_THRESHOLDS: SlagLineThresholds = { safe: 30, danger: 50 };
const ladleIds = Object.keys(initialRecords);
const views: Array<{ id: ViewMode; label: string }> = [
  { id: 'iso', label: '等轴测' },
  { id: 'top', label: '俯视' },
  { id: 'side', label: '侧视' },
  { id: 'section', label: '剖面' },
];

function ratingForDepth(depth: number, thresholds: SlagLineThresholds): Rating {
  if (depth > thresholds.danger) return 'danger';
  if (depth >= thresholds.safe) return 'warning';
  return 'safe';
}

function ratingName(rating: Rating) {
  return rating === 'safe' ? '安全' : rating === 'warning' ? '预警' : '危险';
}

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function pointColor(depth: number, thresholds: SlagLineThresholds) {
  if (depth < thresholds.safe) return 'rgba(52, 211, 153, .78)';
  if (depth < thresholds.danger) return 'rgba(251, 191, 36, .83)';
  return 'rgba(248, 113, 113, .9)';
}

function drawPointCloud(
  canvas: HTMLCanvasElement,
  mode: ViewMode,
  packageIndex: number,
  scanVersion: number,
  thresholds: SlagLineThresholds,
) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const { width, height } = canvas;
  const random = createSeededRandom((packageIndex + 1) * 9817 + scanVersion * 1613 + mode.length * 101);
  const centerX = width / 2;
  const centerY = height / 2;
  context.fillStyle = '#040b13';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(34, 211, 238, .075)';
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += 40) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  }
  for (let y = 0; y <= height; y += 40) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }

  if (mode === 'top') {
    const radius = Math.min(width, height) * 0.36;
    for (let index = 0; index < 3800; index += 1) {
      const angle = random() * Math.PI * 2;
      const radial = radius * (0.28 + random() * 0.72);
      const x = centerX + Math.cos(angle) * radial;
      const y = centerY + Math.sin(angle) * radial;
      const depth = 18 + Math.sin(angle * 3) * 10 + Math.cos(angle * 5) * 6 + (radial / radius) * 15 + (random() - .5) * 7;
      context.fillStyle = pointColor(depth, thresholds);
      context.fillRect(x, y, 2, 2);
    }
  } else if (mode === 'side') {
    for (let index = 0; index < 3200; index += 1) {
      const x = width * .15 + random() * width * .7;
      const relativeX = (x - width * .15) / (width * .7);
      const y = height * (.3 + Math.sin(relativeX * Math.PI) * .1) + random() * height * .35;
      const depth = 17 + Math.sin(relativeX * Math.PI * 2) * 12 + Math.cos(relativeX * Math.PI * 4) * 8 + (random() - .5) * 8;
      context.fillStyle = pointColor(depth, thresholds);
      context.fillRect(x, y, 2, 2);
    }
  } else if (mode === 'section') {
    context.strokeStyle = 'rgba(96, 165, 250, .38)';
    context.strokeRect(width * .2, height * .18, width * .6, height * .62);
    for (let index = 0; index < 2600; index += 1) {
      const left = random() > .5;
      const x = left ? width * (.2 + random() * .09) : width * (.71 + random() * .09);
      const y = height * (.18 + random() * .62);
      const depth = 18 + Math.sin(y * .03) * 11 + (left ? 5 : 11) + (random() - .5) * 9;
      context.fillStyle = pointColor(depth, thresholds);
      context.fillRect(x, y, 2, 2);
    }
  } else {
    const radius = Math.min(width, height) * .28;
    const wallHeight = radius * 1.5;
    context.strokeStyle = 'rgba(96, 165, 250, .28)';
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(centerX, centerY - wallHeight * .48, radius * .86, radius * .24, 0, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.ellipse(centerX, centerY + wallHeight * .54, radius * .86, radius * .24, 0, 0, Math.PI * 2);
    context.stroke();
    for (let index = 0; index < 4300; index += 1) {
      const angle = random() * Math.PI * 2;
      const radial = .88 + random() * .16;
      const vertical = random() - .5;
      const x3 = Math.cos(angle) * radius * radial;
      const z3 = Math.sin(angle) * radius * radial * .35;
      const y3 = vertical * wallHeight;
      const scanBand = 1 - Math.min(1, Math.abs(vertical + .05) * 2.4);
      const depth = 16 + Math.sin(angle * 2) * 7 + Math.cos(angle * 3 + 1) * 5 + scanBand * 15 + (random() - .5) * 7;
      context.fillStyle = pointColor(depth, thresholds);
      context.fillRect(centerX + x3 * .87 - z3, centerY + y3 + x3 * .12 + z3, 2, 2);
    }
    context.setLineDash([4, 5]);
    context.strokeStyle = 'rgba(34, 211, 238, .55)';
    context.beginPath();
    context.ellipse(centerX, centerY + wallHeight * .04, radius * .88, radius * .25, 0, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = 'rgba(103, 232, 249, .84)';
    context.font = '600 11px var(--font-mono)';
    context.fillText('渣线扫描带', centerX - 30, centerY + wallHeight * .04 - 12);
  }

  context.setLineDash([5, 5]);
  context.strokeStyle = '#f87171';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(centerX + width * .17, centerY - height * .05, 20, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = '#fca5a5';
  context.font = '600 11px var(--font-mono)';
  context.fillText('关注区域', centerX + width * .14, centerY + height * .04);
  context.fillStyle = 'rgba(174, 203, 229, .65)';
  context.font = '11px var(--font-mono)';
  context.fillText('RH-LR1540 × 2  |  精度 ±10mm  |  270°扫描  |  100Hz', 14, height - 14);
}

function getDepths(packageIndex: number, scanVersion: number) {
  return Array.from({ length: 37 }, (_, index) => {
    const angle = (index / 36) * Math.PI * 2;
    return 23 + Math.sin(angle * 2 + packageIndex) * 8 + Math.cos(angle * 3 - packageIndex) * 6 + (scanVersion % 3) * 1.2;
  });
}

interface SlagLineMonitorProps {
  wincc: WinCCInstance;
  onBack: () => void;
}

export default function SlagLineMonitor({ wincc, onBack }: SlagLineMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedLadleId, setSelectedLadleId] = useState(ladleIds[0]);
  const [viewMode, setViewMode] = useState<ViewMode>('iso');
  const [records, setRecords] = useState(initialRecords);
  const [progress, setProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanVersion, setScanVersion] = useState(0);
  const thresholds = DEFAULT_SLAG_LINE_THRESHOLDS;
  const packageIndex = ladleIds.indexOf(selectedLadleId);
  const currentRecords = records[selectedLadleId];
  const latestRecord = currentRecords[0];
  const depths = useMemo(() => getDepths(packageIndex, scanVersion), [packageIndex, scanVersion]);
  const chartPath = useMemo(() => depths.map((depth, index) => {
    const x = (index / (depths.length - 1)) * 600;
    const y = 148 - (depth / 65) * 122;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' '), [depths]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawPointCloud(canvas, viewMode, packageIndex, scanVersion, thresholds);
  }, [packageIndex, scanVersion, thresholds, viewMode]);

  useEffect(() => {
    if (!isScanning) return;
    const timer = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          window.clearInterval(timer);
          setIsScanning(false);
          setScanVersion((version) => version + 1);
          const depth = Number((21 + Math.random() * 27).toFixed(1));
          const record: SlagRecord = {
            time: new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, -3),
            depth,
            defects: depth >= 30 ? Math.ceil((depth - 25) / 6) : 0,
            rating: ratingForDepth(depth, thresholds),
          };
          setRecords((previous) => ({ ...previous, [selectedLadleId]: [record, ...previous[selectedLadleId]] }));
          return 100;
        }
        return Math.min(100, value + 5);
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [isScanning, selectedLadleId, thresholds]);

  const startScan = () => {
    setProgress(0);
    setIsScanning(true);
  };

  const ratingStyles: Record<Rating, string> = { safe: styles.safe, warning: styles.warning, danger: styles.danger };
  const latestRating = ratingForDepth(latestRecord.depth, thresholds);
  const latestTone = ratingStyles[latestRating];
  const warningY = 148 - (thresholds.safe / 65) * 122;
  const dangerY = 148 - (thresholds.danger / 65) * 122;

  return (
    <section className={styles.shell} aria-label="雷达渣线监测">
      <header className={`${styles.topBar} ${workspaceStyles.topBar}`}>
        <div className={workspaceStyles.topBarInner}>
          <button type="button" className={styles.backButton} onClick={onBack}>
            <ArrowLeft size={18} aria-hidden="true" /> 返回监测方式
          </button>
          <div className={styles.titleBlock}>
            <div><Radar size={17} aria-hidden="true" /><h2>渣线雷达探测</h2><span>在线监测</span></div>
            <p>{wincc.location} · 双雷达点云分析 · 演示数据</p>
          </div>
          <span className={styles.running}><i /> 双雷达在线</span>
        </div>
      </header>

      <main className={`${styles.workspace} ${workspaceStyles.workspace}`}>
        <div className={styles.alert}>
          <CheckCircle2 size={17} aria-hidden="true" />
          双雷达协同扫描：LR-01（左侧）+ LR-02（右侧）= 360°全覆盖　|　RH-LR1540　|　905nm激光　|　测距精度 ±10mm　|　100Hz 帧率
        </div>

        <div className={styles.sectionLabel}><Radar size={14} aria-hidden="true" /> 雷达设备状态</div>
        <div className={styles.deviceStatus}>
          <div><span className={styles.deviceLive}><i /> LR-01</span><p>左侧扫描单元 · 905nm 激光</p><b>100 <small>Hz</small></b><em>270° 扫描角</em></div>
          <div><span className={styles.deviceLive}><i /> LR-02</span><p>右侧扫描单元 · 905nm 激光</p><b>100 <small>Hz</small></b><em>270° 扫描角</em></div>
          <div><span className={styles.deviceLive}><i /> FUSION</span><p>双雷达数据融合状态</p><b>360<small>°</small></b><em>覆盖完整</em></div>
        </div>

        <div className={styles.grid}>
          <aside className={styles.sidebar}>
            <section className={styles.panel}>
              <h3>钢包选择</h3>
              <select value={selectedLadleId} onChange={(event) => setSelectedLadleId(event.target.value)} aria-label="选择钢包">
                {ladleIds.map((ladleId) => <option key={ladleId}>{ladleId}</option>)}
              </select>
              <button type="button" className={styles.scanButton} disabled={isScanning} onClick={startScan}>
                <ScanLine size={16} aria-hidden="true" /> {isScanning ? '正在扫描...' : '开始新检测'}
              </button>
              <div className={styles.progress} aria-live="polite">
                <div><i style={{ width: `${progress}%` }} /></div>
                <span>{isScanning ? `双雷达同步扫描 ${progress}%` : progress === 100 ? '检测已完成' : '设备待命'}</span>
              </div>
            </section>

            <section className={`${styles.panel} ${styles.recordPanel}`}>
              <h3>检测记录</h3>
              <div className={styles.recordHead}><span>时间</span><span>深度</span><span>缺陷</span><span>评级</span></div>
              <div className={styles.recordList}>
                {currentRecords.map((record) => (
                  <div className={styles.record} key={`${record.time}-${record.depth}`}>
                    <time>{record.time}</time><b className={ratingStyles[ratingForDepth(record.depth, thresholds)]}>{record.depth} mm</b><span>{record.defects}</span><em className={ratingStyles[ratingForDepth(record.depth, thresholds)]}>{ratingName(ratingForDepth(record.depth, thresholds))}</em>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <div className={styles.mainContent}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div><h3>3D 点云可视化 — <b>{selectedLadleId}</b></h3><p>双雷达融合点云 · 约 120 万点</p></div>
                <div className={styles.viewButtons}>
                  {views.map((view) => <button type="button" className={viewMode === view.id ? styles.active : undefined} key={view.id} onClick={() => setViewMode(view.id)}>{view.label}</button>)}
                </div>
              </div>
              <div className={styles.canvasWrap}><canvas ref={canvasRef} width={900} height={480} /></div>
              <div className={styles.canvasFooter}><span>设备：RH-LR1540 × 2　|　扫描角：270°　|　重复精度：±5mm</span><span><i className={styles.safe}>■ 安全</i><i className={styles.warning}>■ 预警</i><i className={styles.danger}>■ 危险</i></span></div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}><div><h3>渣线深度分布曲线 — 环绕钢包一周</h3><p>当前包号 {selectedLadleId} · 0° — 360°</p></div><span className={`${styles.rating} ${latestTone}`}>{ratingName(latestRating)}</span></div>
              <div className={styles.chartWrap}>
                <svg viewBox="0 0 600 170" preserveAspectRatio="none" aria-label="渣线深度分布曲线">
                  <defs><linearGradient id="slagLineFill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#38bdf8" stopOpacity=".28"/><stop offset="1" stopColor="#38bdf8" stopOpacity="0"/></linearGradient></defs>
                  {[25, 65, 105, 145].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="rgba(151, 178, 210, .15)" />)}
                  <line x1="0" x2="600" y1={warningY} y2={warningY} stroke="#fbbf24" strokeDasharray="6 5" /><line x1="0" x2="600" y1={dangerY} y2={dangerY} stroke="#f87171" strokeDasharray="6 5" />
                  <path d={`${chartPath} L600 160 L0 160 Z`} fill="url(#slagLineFill)" /><path d={chartPath} fill="none" stroke="#38bdf8" strokeWidth="2.4" />
                </svg>
                <div className={styles.chartAxis}><span>0°</span><span>90°</span><span>180°</span><span>270°</span><span>360°</span></div>
              </div>
            </section>
          </div>
        </div>

        <section className={styles.bottomGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h3>当前检测结论</h3><p>最新一次检测结果 · {selectedLadleId}</p></div><TriangleAlert size={18} color={latestRating === 'safe' ? '#34d399' : '#fbbf24'} /></div>
            <div className={styles.summary}><div><span>最大深度</span><b>{latestRecord.depth} mm</b></div><div><span>异常区域</span><b>{latestRecord.defects} 处</b></div><div><span>综合评级</span><b className={latestTone}>{ratingName(latestRating)}</b></div><div><span>设备在线率</span><b className={styles.safe}>100%</b></div></div>
            <p className={styles.summaryNote}><Activity size={14} aria-hidden="true" /> 当前数据由 LR-01 与 LR-02 融合扫描生成。</p>
          </section>
        </section>
      </main>
    </section>
  );
}
