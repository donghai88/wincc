'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Camera,
  Clock3,
  Radar,
  ScanText,
  Thermometer,
} from 'lucide-react';
import type { WinCCInstance } from '@/types/template';
import {
  getCurrentDayInferenceCount,
  ladleThermalDeviceLabels,
  queryLatestLadleRecords,
  reconnectModbusDevice,
} from '@/data/ladle-api-config';
import { useLadleModbusFeed } from '@/hooks/useLadleModbusFeed';
import { buildApiUrl, canUseMockData, isMockOnly, unwrapApiData } from '@/lib/api-config';
import workspaceStyles from './MonitoringWorkspace.module.css';
import styles from './LadleRecognitionMonitor.module.css';

interface LadleRecognitionMonitorProps {
  onBack?: () => void;
  wincc?: WinCCInstance;
  embedded?: boolean;
}

type DeviceKind = 'thermal' | 'ocr' | 'radar';

interface DeviceCard {
  id: string;
  name: string;
  kind: DeviceKind;
  location: string;
  metrics: Array<{ label: string; value: string }>;
}

interface ThermalFeed {
  id: string;
  title: string;
  temp: number;
  max: number;
  avg: number;
  min: number;
  pkg: string;
}

interface SnapshotItem {
  id: string;
  pkg: string;
  time: string;
  temp: number;
  camera: string;
}

const devices: DeviceCard[] = [
  {
    id: 'IR-01',
    name: '出钢位热像仪',
    kind: 'thermal',
    location: '位置：出钢位 | 帧率 25fps | 分辨率 640×512',
    metrics: [
      { label: '当前温度', value: '487°C' },
      { label: '最高', value: '512°C' },
    ],
  },
  {
    id: 'IR-02',
    name: '浇铸位热像仪',
    kind: 'thermal',
    location: '位置：浇铸位 | 帧率 25fps | 分辨率 640×512',
    metrics: [
      { label: '当前温度', value: '465°C' },
      { label: '最高', value: '489°C' },
    ],
  },
  {
    id: 'IR-03',
    name: '热修位热像仪',
    kind: 'thermal',
    location: '位置：热修位 | 帧率 25fps | 分辨率 640×512',
    metrics: [
      { label: '当前温度', value: '442°C' },
      { label: '最高', value: '468°C' },
    ],
  },
  {
    id: 'OCR-01',
    name: '包号识别相机',
    kind: 'ocr',
    location: '位置：热修位入口 | 识别率 99.2%',
    metrics: [
      { label: '今日识别', value: '47次' },
      { label: '最近识别', value: 'A3256' },
    ],
  },
  {
    id: 'LR-01',
    name: 'RH-LR1540 左侧',
    kind: 'radar',
    location: '位置：热修位左侧 | 905nm激光 | IP67 | ±10mm精度',
    metrics: [
      { label: '点云帧率', value: '100Hz' },
      { label: '扫描角', value: '270°' },
      { label: '状态', value: '待命' },
    ],
  },
  {
    id: 'LR-02',
    name: 'RH-LR1540 右侧',
    kind: 'radar',
    location: '位置：热修位右侧 | 905nm激光 | IP67 | ±10mm精度',
    metrics: [
      { label: '点云帧率', value: '100Hz' },
      { label: '扫描角', value: '270°' },
      { label: '状态', value: '待命' },
    ],
  },
];

const initialFeeds: ThermalFeed[] = [
  { id: 'IR-01', title: 'IR-01 出钢位', temp: 487, max: 487, avg: 451, min: 398, pkg: 'A3256' },
  { id: 'IR-02', title: 'IR-02 浇铸位', temp: 465, max: 465, avg: 438, min: 385, pkg: 'A3256' },
  { id: 'IR-03', title: 'IR-03 热修位', temp: 442, max: 442, avg: 415, min: 372, pkg: 'A3256' },
];

const snapshots: SnapshotItem[] = [
  { id: 's1', pkg: 'A3255', time: '2026-06-26 11:38:42', temp: 479, camera: 'IR-01' },
  { id: 's2', pkg: 'A3255', time: '2026-06-26 11:38:42', temp: 458, camera: 'IR-02' },
  { id: 's3', pkg: 'A3255', time: '2026-06-26 11:38:42', temp: 435, camera: 'IR-03' },
];

const ocrRecords = [
  { time: '14:28:36', id: 'A3256', confidence: '99.6%', result: '识别成功', tone: 'normal' as const },
  { time: '14:17:08', id: 'A3255', confidence: '98.9%', result: '识别成功', tone: 'normal' as const },
  { time: '13:54:21', id: 'A3241', confidence: '99.1%', result: '关注渣线', tone: 'warning' as const },
  { time: '13:38:44', id: 'A3238', confidence: '97.8%', result: '识别成功', tone: 'normal' as const },
];

function ThermalCameraCard({ feed }: { feed: ThermalFeed }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>{feed.title}</h3>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#34d399', font: '11px var(--font-mono)' }}>
          <span className={styles.statusDot} />
          在线
        </span>
      </div>
      <div className={styles.thermalFeed}>
        <div className={styles.thermalGlow} />
        <div className={styles.thermalGrid} />
        <div className={styles.thermalLadle} />
        <div className={styles.feedLabel}>红外热图 | 640×512 | 25fps</div>
        <div className={styles.feedPkg}>{feed.pkg}</div>
        <div className={styles.feedTemp}>{feed.temp}°C</div>
      </div>
    </section>
  );
}

function TempMetricCard({ feed }: { feed: ThermalFeed }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>{feed.id} 实时温度</h3>
        <Thermometer size={14} color="#22d3ee" />
      </div>
      <div className={styles.tempGrid}>
        <div>
          <span>最高温 °C</span>
          <b>{feed.max}</b>
        </div>
        <div>
          <span>平均温 °C</span>
          <b>{feed.avg}</b>
        </div>
        <div>
          <span>最低温 °C</span>
          <b>{feed.min}</b>
        </div>
      </div>
    </section>
  );
}

const deviceIdToFeedId: Record<string, string> = {
  '11_1': 'IR-01',
  '12_1': 'IR-02',
  '17_1': 'IR-03',
};

export default function LadleRecognitionMonitor({ onBack, wincc, embedded = false }: LadleRecognitionMonitorProps) {
  const modbusFeed = useLadleModbusFeed();
  const [clock, setClock] = useState(() => new Date());
  const [inferenceCount, setInferenceCount] = useState(47);
  const [latestRecords, setLatestRecords] = useState(initialFeeds.map((feed, index) => ({
    id: `latest-${index}`,
    pkg: 'Y-111',
    time: '2026-07-30 13:49:26',
    temp: feed.temp,
    camera: feed.id,
  })));
  const [selectedRecord, setSelectedRecord] = useState(ocrRecords[0]);
  const [selectedPkg, setSelectedPkg] = useState('Y-111');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [reconnectMessage, setReconnectMessage] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadDashboardMetrics = async () => {
      if (isMockOnly) {
        setInferenceCount(getCurrentDayInferenceCount().data);
        const latest = queryLatestLadleRecords().data;
        setLatestRecords(latest.map((record) => ({
          id: String(record.id),
          pkg: record.ladleNo,
          time: record.recordTime,
          temp: Math.round(record.maxTemp),
          camera: record.deviceName,
        })));
        return;
      }

      try {
        const [countResponse, latestResponse] = await Promise.all([
          fetch(buildApiUrl('/ladle/dashboard/currentDayInferenceCount'), { headers: { Accept: 'application/json' } }),
          fetch(buildApiUrl('/ladle-record/latest'), { headers: { Accept: 'application/json' } }),
        ]);
        if (countResponse.ok) {
          const countPayload = await countResponse.json() as unknown;
          const count = unwrapApiData(countPayload);
          if (typeof count === 'number') setInferenceCount(count);
        }
        if (latestResponse.ok) {
          const latestPayload = await latestResponse.json() as unknown;
          const latest = unwrapApiData(latestPayload) as Array<{ id: number; ladleNo: string; deviceName: string; maxTemp: number; recordTime: string }>;
          if (Array.isArray(latest)) {
            setLatestRecords(latest.map((record) => ({
              id: String(record.id),
              pkg: record.ladleNo,
              time: record.recordTime,
              temp: Math.round(record.maxTemp),
              camera: record.deviceName,
            })));
          }
        }
      } catch {
        if (canUseMockData) {
          setInferenceCount(getCurrentDayInferenceCount().data);
          const latest = queryLatestLadleRecords().data;
          setLatestRecords(latest.map((record) => ({
            id: String(record.id),
            pkg: record.ladleNo,
            time: record.recordTime,
            temp: Math.round(record.maxTemp),
            camera: record.deviceName,
          })));
        }
      }
    };

    void loadDashboardMetrics();
  }, []);

  const feeds = useMemo(() => {
    const tempResults = modbusFeed.payload?.tempResults ?? [];
    return initialFeeds.map((feed) => {
      const deviceEntry = tempResults.find((item) => deviceIdToFeedId[item.deviceId] === feed.id);
      if (!deviceEntry || deviceEntry.avgTemp === null) return feed;
      const temp = Math.round(deviceEntry.avgTemp);
      return {
        ...feed,
        temp,
        max: Math.round(deviceEntry.maxTemp ?? temp),
        min: Math.round(deviceEntry.minTemp ?? temp),
        avg: temp,
        pkg: modbusFeed.payload?.currentLadleNo ?? feed.pkg,
      };
    });
  }, [modbusFeed.payload]);

  const reconnectDevice = async (deviceId: string) => {
    if (isMockOnly || canUseMockData) {
      const result = reconnectModbusDevice(deviceId);
      setReconnectMessage(result.code === 200 ? `设备 ${deviceId} 重连成功` : result.msg);
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`/ladle/modbus/reconnect/${deviceId}`), { method: 'POST' });
      const payload = await response.json() as { msg?: string; code?: number };
      setReconnectMessage(payload.msg ?? (response.ok ? '重连成功' : '重连失败'));
    } catch {
      const result = reconnectModbusDevice(deviceId);
      setReconnectMessage(result.msg);
    }
  };

  useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(() => {
      setScanProgress((p) => {
        if (p >= 100) {
          setScanning(false);
          return 100;
        }
        return p + 4;
      });
    }, 120);
    return () => clearInterval(timer);
  }, [scanning]);

  const currentPkg = modbusFeed.payload?.currentLadleNo ?? selectedRecord.id;
  const title = wincc?.name ?? '钢包识别';
  const subtitle = wincc
    ? `${wincc.location} / OCR+红外+雷达三模态协同 / ${modbusFeed.status === 'mock' || modbusFeed.status === 'fallback' ? 'Mock 数据' : '实时接口'}`
    : '红外测温 + 雷达渣线检测 + OCR包号识别';

  return (
    <section className={styles.simShell} aria-label="钢包智能监测实时监控">
      <header className={`${styles.topBar} ${workspaceStyles.topBar}`}>
        <div className={workspaceStyles.topBarInner}>
          {!embedded && onBack && (
            <button className={styles.backButton} type="button" onClick={onBack} aria-label="返回功能选择">
              <ArrowLeft size={18} aria-hidden="true" />
              <span>返回</span>
            </button>
          )}
          {embedded && onBack && (
            <button className={styles.backButton} type="button" onClick={onBack} aria-label="返回功能选择">
              <ArrowLeft size={18} aria-hidden="true" />
              <span>返回功能选择</span>
            </button>
          )}

          <div className={styles.titleBlock}>
            <div className={styles.titleLine}>
              <h1>{title}</h1>
              <span className={styles.simBadge}>智能监测版</span>
            </div>
            <p>{subtitle}</p>
          </div>

          <div className={styles.statusCluster}>
            <span className={styles.statusPill}>{modbusFeed.message || '系统运行中'}</span>
            <span className={styles.clockPill}>
              <Clock3 size={14} aria-hidden="true" />
              {wincc?.lastUpdate ?? clock.toLocaleString('zh-CN', { hour12: false })}
            </span>
          </div>
        </div>
      </header>

      <div className={`${styles.workspace} ${workspaceStyles.workspace}`}>
        <div className={styles.sectionLabel}>
          <ScanText size={13} aria-hidden="true" />
          DEVICE STATUS · 设备状态总览
        </div>
        <div className={styles.devicePanel}>
          {devices.map((device) => (
            <article key={device.id} className={styles.deviceCard} data-kind={device.kind}>
              <div className={styles.deviceName}>
                <span className={styles.statusDot} />
                <b>{device.id}</b>
                <span>{device.name}</span>
              </div>
              <div className={styles.deviceLoc}>{device.location}</div>
              <div className={styles.deviceMetrics}>
                {device.metrics.map((metric) => (
                  <div key={metric.label} className={styles.deviceMetric}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className={styles.recogStrip}>
          <div className={styles.recogMain}>
            <div className={styles.recogIcon}>
              <ScanText size={22} color="#22d3ee" />
            </div>
            <div>
              <div className={styles.kpiLabel}>当前识别包号</div>
              <div className={styles.pkgValue}>{currentPkg ?? '未识别'}</div>
            </div>
            <div className={styles.recogResult}>
              <div className={styles.resultOk}>{currentPkg ? '✓ 识别成功' : '等待识别'}</div>
              <div className={styles.muted}>WS 推送 {modbusFeed.updatedAt} | {modbusFeed.source}</div>
            </div>
          </div>
          <div className={styles.recogMetric}>
            <div className={styles.kpiValue}>99.2%</div>
            <div className={styles.kpiLabel}>今日识别准确率</div>
          </div>
          <div className={styles.recogMetric}>
            <div className={styles.kpiValue}>{inferenceCount}</div>
            <div className={styles.kpiLabel}>今日识别次数</div>
          </div>
        </div>

        {reconnectMessage && <div className={styles.muted} role="status">{reconnectMessage}</div>}

        <div className={styles.sectionLabel}>
          <Thermometer size={13} aria-hidden="true" />
          三路红外实时监控
        </div>
        <div className={styles.cameraRow}>
          {feeds.map((feed) => (
            <ThermalCameraCard key={feed.id} feed={feed} />
          ))}
        </div>

        <div className={styles.tempRow}>
          {feeds.map((feed) => (
            <TempMetricCard key={`temp-${feed.id}`} feed={feed} />
          ))}
        </div>

        <div className={styles.scanActions}>
          {Object.entries(ladleThermalDeviceLabels).map(([deviceId, label]) => (
            <button key={deviceId} type="button" className={styles.primaryBtn} onClick={() => void reconnectDevice(deviceId)}>
              重连 {label}
            </button>
          ))}
        </div>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h3>
              <Camera size={15} color="#22d3ee" />
              上一次测温截图 — 包号 {latestRecords[0]?.pkg ?? '—'}
            </h3>
            <span>{latestRecords[0]?.time ?? '—'} | GET /ladle-record/latest</span>
          </div>
          <div className={styles.snapshotRow}>
            {latestRecords.map((snap, index) => (
              <button type="button" key={snap.id} className={styles.snapshotCard}>
                <div className={styles.snapshotThumb} data-tone={index + 1}>
                  <div className={styles.thermalGlow} />
                  <div className={styles.thermalGrid} />
                  <div className={styles.thermalLadle} />
                  <div className={styles.snapshotOverlayLabel}>
                    {snap.camera} · 640×512
                  </div>
                  <div className={styles.snapshotOverlayTemp}>{snap.temp}°C</div>
                  <div className={styles.snapshotOverlayTime}>{snap.time.split(' ')[1]}</div>
                </div>
                <div className={styles.snapshotMeta}>
                  <b>{snap.temp}°C</b>
                  <span>{snap.camera}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className={styles.bottomGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <div className={styles.sectionLabel} style={{ marginBottom: 4 }}>
                  <Radar size={13} color="#22d3ee" />
                  SLAGLINE SCAN · 渣线检测
                </div>
                <div className={styles.muted}>设备：RH-LR1540 × 2 | 精度：±10mm | 点云密度：约120万点</div>
              </div>
              <div className={styles.pkgTabs}>
                {['A3256', 'A3241', 'A3198', 'A3302'].map((pkg) => (
                  <button
                    key={pkg}
                    type="button"
                    className={selectedPkg === pkg ? styles.active : undefined}
                    onClick={() => setSelectedPkg(pkg)}
                  >
                    {pkg}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.scanActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  setScanProgress(0);
                  setScanning(true);
                }}
                disabled={scanning}
              >
                {scanning ? '扫描中...' : '🔍 开始新检测'}
              </button>
              <div className={styles.scanProgress}>
                <div className={styles.scanTrack}>
                  <i style={{ width: `${scanProgress}%` }} />
                </div>
                <span>
                  {scanning ? `准备扫描... ${scanProgress}%` : scanProgress === 100 ? '检测完成' : '待命'}
                </span>
              </div>
            </div>

            <div className={styles.pointCloud}>
              <div className={styles.ring} />
              <div className={`${styles.ring} ${styles.ringAlt}`} />
              <div className={styles.core} />
              {Array.from({ length: 64 }, (_, index) => (
                <i key={index} style={{ '--i': index } as React.CSSProperties} />
              ))}
              <div className={styles.legend}>
                <span className={styles.safe}>■安全</span>
                <span className={styles.warn}>■预警</span>
                <span className={styles.danger}>■危险</span>
              </div>
            </div>

            <div className={styles.depthChart}>
              <div className={styles.chartLabel}>
                <span>渣线深度分布曲线 — 环绕钢包一周 · {selectedPkg}</span>
                <span>0° — 360°</span>
              </div>
              <svg viewBox="0 0 600 100" preserveAspectRatio="none" aria-label="渣线深度分布图">
                <defs>
                  <linearGradient id="ladleDepthFill" x1="0" x2="0" y1="0" y2="1">
                    <stop stopColor="#22d3ee" stopOpacity=".32" />
                    <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 72 L28 60 L54 66 L82 49 L110 56 L138 40 L166 47 L195 29 L223 38 L250 31 L280 48 L310 45 L338 58 L367 52 L394 69 L422 56 L450 63 L480 50 L510 61 L540 44 L570 53 L600 39 L600 100 L0 100Z"
                  fill="url(#ladleDepthFill)"
                />
                <path
                  d="M0 72 L28 60 L54 66 L82 49 L110 56 L138 40 L166 47 L195 29 L223 38 L250 31 L280 48 L310 45 L338 58 L367 52 L394 69 L422 56 L450 63 L480 50 L510 61 L540 44 L570 53 L600 39"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </section>

          <div className={styles.sideStack}>
            <section className={styles.panel}>
              <div className={styles.sectionLabel}>
                <Clock3 size={13} color="#22d3ee" />
                OCR HISTORY · 最近识别记录
              </div>
              <div className={styles.muted}>OCR识别结果已自动关联检测档案</div>
              <div className={styles.records}>
                {ocrRecords.map((record) => (
                  <button
                    type="button"
                    key={record.time}
                    className={`${styles.recordBtn}${selectedRecord.time === record.time ? ` ${styles.selected}` : ''}`}
                    onClick={() => {
                      setSelectedRecord(record);
                      setSelectedPkg(record.id);
                    }}
                  >
                    <time>{record.time}</time>
                    <b>{record.id}</b>
                    <span>{record.confidence}</span>
                    <em className={record.tone === 'warning' ? styles.warn : undefined}>{record.result}</em>
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.sectionLabel}>
                <BadgeCheck size={13} color="#34d399" />
                SUMMARY · 检测结论摘要
              </div>
              <div className={styles.summaryList}>
                <div>
                  <span>渣线最大深度</span>
                  <b>18.4 mm</b>
                </div>
                <div>
                  <span>缺陷数量</span>
                  <b>1</b>
                </div>
                <div>
                  <span>评级</span>
                  <b className={styles.warn}>预警</b>
                </div>
                <div>
                  <span>设备在线率</span>
                  <b className={styles.ok}>100%</b>
                </div>
              </div>
              <div className={styles.summaryNote}>
                <Activity size={14} color="#22d3ee" />
                红外测温、雷达渣线、OCR包号三模态协同运行
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
