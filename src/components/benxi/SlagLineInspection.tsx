'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Radar } from 'lucide-react';
import { isMockOnly } from '@/lib/api-config';
import {
  fetchLadleReportDetail,
  fetchLadleReportRows,
  fetchRadarScans,
  loadScanPoints,
  type DataSourceStatus,
} from '@/lib/benxi-ladle-api';
import {
  formatAzimuth,
  judgeLadle,
  maxTemp,
  radarGeometry,
  remainingHeats,
  riskLevelNames,
  riskLevelTone,
  slagThresholds,
  thermalChannels,
} from '@/lib/benxi-ladle-rules';
import {
  analyzeSlagCloud,
  computeZoneStats,
  diffGrids,
  slagDefectNames,
  type SlagAnalysis,
  type SlagDefect,
} from '@/lib/slag-analysis';
import { loadDemoDisplayCloud, type DisplayCloud } from '@/lib/demo-pcd';
import type { LadleReportDetail, LadleReportRow, RadarScan, ThermalDetection } from '@/types/benxi-ladle';
import styles from './Benxi.module.css';
import { DataNotice, TrendChart, cx, depthTone, tempTone } from './shared';
import UnrollMap, { ColorScale } from './UnrollMap';
import type { CloudView } from './SlagPointCloud';

const SlagPointCloud = dynamic(() => import('./SlagPointCloud'), { ssr: false });

type Tab = 'detail' | 'compare';

interface ScanResult {
  positions: Float32Array;
  analysis: SlagAnalysis;
}

interface SlagLineInspectionProps {
  ladleNo: string | null;
  onSelectLadle: (ladleNo: string) => void;
}

const REPLAY_MS = 6800;
const replaySteps = ['等待 PLC 信号', '雷达扫描', '点云拼接', '深度计算', '缺陷判定'];

function replayStage(k: number) {
  if (k < 0.08) return { step: 0, cloud: 0, label: '等待 PLC 位置信号' };
  if (k < 0.68) {
    const cloud = (k - 0.08) / 0.6;
    return { step: 1, cloud, label: `雷达扫描中 · ${Math.round(cloud * 360)}° / 360°` };
  }
  if (k < 0.8) return { step: 2, cloud: 1, label: '点云配准拼接' };
  if (k < 0.91) return { step: 3, cloud: 1, label: '渣线深度计算' };
  return { step: 4, cloud: 1, label: '缺陷判定输出' };
}

function nearestThermal(thermal: ThermalDetection[], heat: number) {
  if (thermal.length === 0) return null;
  return thermal.reduce((best, item) => (
    Math.abs(item.heatInCampaign - heat) < Math.abs(best.heatInCampaign - heat) ? item : best
  ), thermal[0]);
}

function defectValueText(defect: SlagDefect) {
  if (defect.type === 'area') return { value: `${defect.value.toFixed(0)}%`, unit: '超标面积' };
  if (defect.type === 'rate') return { value: `${defect.value.toFixed(2)}`, unit: 'mm/炉' };
  if (defect.type === 'pit') return { value: `${defect.value.toFixed(0)}mm`, unit: '高出周边' };
  return { value: `${defect.value.toFixed(0)}mm`, unit: '深度' };
}

function LadleInspector({ ladleNo, tab, onSelectLadle }: {
  ladleNo: string;
  tab: Tab;
  onSelectLadle: (ladleNo: string) => void;
}) {
  const [rows, setRows] = useState<LadleReportRow[] | null>(null);
  const [scanSet, setScanSet] = useState<{ ladleNo: string; list: RadarScan[] } | null>(null);
  const [detail, setDetail] = useState<LadleReportDetail | null>(null);
  const [campaignChoice, setCampaignChoice] = useState<number | null>(null);
  const [scanChoice, setScanChoice] = useState<string | null>(null);
  const [baseScanChoice, setBaseScanChoice] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ scanId: string; result: ScanResult } | null>(null);
  const [base, setBase] = useState<{ scanId: string; result: ScanResult } | null>(null);
  const [scanError, setScanError] = useState<{ scanId: string; message: string } | null>(null);
  const [status, setStatus] = useState<DataSourceStatus | 'loading'>('loading');
  const [message, setMessage] = useState<string | undefined>();
  const [activeDefect, setActiveDefect] = useState<{ scanId: string; id: number } | null>(null);
  const [view, setView] = useState<CloudView>('iso');
  const [viewNonce, setViewNonce] = useState(0);
  const [replay, setReplay] = useState<number | null>(null);
  const [displayCloud, setDisplayCloud] = useState<DisplayCloud | null>(null);
  const [displayCloudError, setDisplayCloudError] = useState(false);
  const cacheRef = useRef(new Map<string, ScanResult>());
  const replayFrameRef = useRef(0);

  useEffect(() => {
    if (!isMockOnly) return;
    let cancelled = false;
    void loadDemoDisplayCloud()
      .then((cloud) => { if (!cancelled) setDisplayCloud(cloud); })
      .catch(() => { if (!cancelled) setDisplayCloudError(true); });
    return () => { cancelled = true; };
  }, []);
  const waitingDisplayCloud = isMockOnly && !displayCloud && !displayCloudError;

  const selectedNo = ladleNo;
  const selectedRow = rows?.find((row) => row.ladleNo === selectedNo) ?? null;

  useEffect(() => {
    let cancelled = false;
    void fetchLadleReportRows().then((result) => {
      if (cancelled) return;
      setRows(result.data);
      setStatus(result.status);
      setMessage(result.message);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedNo) return;
    let cancelled = false;
    void fetchRadarScans(selectedNo).then((result) => {
      if (cancelled) return;
      setScanSet({ ladleNo: selectedNo, list: result.data });
      if (result.status === 'error' || result.status === 'fallback') {
        setStatus(result.status);
        setMessage(result.message);
      }
    });
    return () => { cancelled = true; };
  }, [selectedNo]);

  const scans = useMemo(() => (scanSet && scanSet.ladleNo === selectedNo ? scanSet.list : []), [scanSet, selectedNo]);
  const campaigns = useMemo(() => Array.from(new Set(scans.map((item) => item.campaignNo))), [scans]);
  const campaignNo = campaignChoice !== null && campaigns.includes(campaignChoice)
    ? campaignChoice
    : campaigns[campaigns.length - 1] ?? null;
  const campaignScans = useMemo(() => scans.filter((item) => item.campaignNo === campaignNo), [campaignNo, scans]);
  const scan = campaignScans.find((item) => item.id === scanChoice) ?? campaignScans[campaignScans.length - 1] ?? null;
  const baseScan = campaignScans.find((item) => item.id === baseScanChoice && item.heatInCampaign < (scan?.heatInCampaign ?? 0))
    ?? campaignScans[Math.max(0, campaignScans.indexOf(scan as RadarScan) - 3)]
    ?? null;
  const activeDefectId = activeDefect && activeDefect.scanId === scan?.id ? activeDefect.id : null;

  useEffect(() => {
    if (!selectedNo || campaignNo === null) return;
    let cancelled = false;
    void fetchLadleReportDetail(selectedNo, campaignNo).then((result) => {
      if (!cancelled) setDetail(result.data);
    });
    return () => { cancelled = true; };
  }, [campaignNo, selectedNo]);

  /** 侵蚀深度以本役首次检测（新修后基准）为参考面，首次检测本身以设计内半径为参考。 */
  const analyze = useCallback(async (target: RadarScan, list: RadarScan[]) => {
    const reference = list[0];
    const referenceKey = reference && reference.id !== target.id ? reference.id : 'design';
    const key = `${target.id}|${referenceKey}`;
    const cached = cacheRef.current.get(key);
    if (cached) return cached;

    let baselineRadius: Float32Array | null = null;
    if (referenceKey !== 'design') {
      const referenceKeyFull = `${reference.id}|design`;
      let referenceResult = cacheRef.current.get(referenceKeyFull);
      if (!referenceResult) {
        const points = await loadScanPoints(reference);
        referenceResult = { positions: points, analysis: analyzeSlagCloud(points, { heatsInCampaign: reference.heatInCampaign }) };
        cacheRef.current.set(referenceKeyFull, referenceResult);
      }
      baselineRadius = referenceResult.analysis.radiusGrid;
    }
    const positions = await loadScanPoints(target);
    const result = { positions, analysis: analyzeSlagCloud(positions, { baselineRadius, heatsInCampaign: target.heatInCampaign }) };
    cacheRef.current.set(key, result);
    return result;
  }, []);

  useEffect(() => {
    if (!scan) return;
    let cancelled = false;
    void analyze(scan, campaignScans)
      .then((result) => { if (!cancelled) setCurrent({ scanId: scan.id, result }); })
      .catch((error: unknown) => {
        if (cancelled) return;
        setScanError({ scanId: scan.id, message: `点云加载失败：${error instanceof Error ? error.message : String(error)}` });
      });
    return () => { cancelled = true; };
  }, [analyze, campaignScans, scan]);

  useEffect(() => {
    if (tab !== 'compare' || !baseScan) return;
    let cancelled = false;
    void analyze(baseScan, campaignScans)
      .then((result) => { if (!cancelled) setBase({ scanId: baseScan.id, result }); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [analyze, baseScan, campaignScans, tab]);

  useEffect(() => () => cancelAnimationFrame(replayFrameRef.current), []);

  const startReplay = () => {
    setActiveDefect(null);
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / REPLAY_MS);
      setReplay(k);
      if (k < 1) replayFrameRef.current = requestAnimationFrame(tick);
      else window.setTimeout(() => setReplay(null), 600);
    };
    cancelAnimationFrame(replayFrameRef.current);
    replayFrameRef.current = requestAnimationFrame(tick);
  };

  const currentResult = current && current.scanId === scan?.id ? current.result : null;
  const baseResult = base && base.scanId === baseScan?.id ? base.result : null;
  const errorText = scanError && scanError.scanId === scan?.id ? scanError.message : null;
  let loading: string | null = null;
  if (!rows) loading = '加载钢包列表…';
  else if (selectedNo && scanSet?.ladleNo !== selectedNo) loading = '加载检测记录…';
  else if (scan && !currentResult && !errorText) loading = '加载 PCD 点云并分析…';
  else if (errorText) loading = errorText;
  else if (waitingDisplayCloud) loading = '加载 PCD 点云（约 89MB，首次需数秒）…';

  const thermal = useMemo(
    () => (detail?.current.campaign.campaignNo === campaignNo ? detail.current.thermal : []),
    [campaignNo, detail],
  );
  const scanThermal = scan ? nearestThermal(thermal, scan.heatInCampaign) : null;
  const temps = scanThermal?.temps ?? [];
  const judged = scan ? judgeLadle(scan.maxDepth, temps) : null;
  const stage = replay !== null ? replayStage(replay) : null;
  const defects = currentResult?.analysis.defects ?? [];

  const trend = useMemo(() => ({
    labels: campaignScans.map((item) => item.heatInCampaign),
    depth: campaignScans.map((item) => item.maxDepth),
    temp: campaignScans.map((item) => maxTemp(nearestThermal(thermal, item.heatInCampaign)?.temps ?? [])),
  }), [campaignScans, thermal]);

  const diff = useMemo(
    () => (currentResult && baseResult ? diffGrids(currentResult.analysis.depthGrid, baseResult.analysis.depthGrid) : null),
    [baseResult, currentResult],
  );
  const zones = useMemo(
    () => (currentResult ? computeZoneStats(currentResult.analysis.depthGrid, baseResult?.analysis.depthGrid ?? null) : []),
    [baseResult, currentResult],
  );
  const compareRate = scan && baseScan && scan.heatInCampaign > baseScan.heatInCampaign
    ? (scan.maxDepth - baseScan.maxDepth) / (scan.heatInCampaign - baseScan.heatInCampaign)
    : null;

  const selectDefect = (id: number) => {
    if (!scan) return;
    setActiveDefect(activeDefectId === id ? null : { scanId: scan.id, id });
  };
  const clearDefect = () => setActiveDefect(null);

  return (
    <>
      <DataNotice status={status} message={message} />

      <div className={cx(styles.filterBar, tab === 'compare' && styles.filterBarCompare)}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>钢包<em>共 {rows?.length ?? 0} 只</em></span>
          <select className={styles.select} value={selectedNo ?? ''} onChange={(event) => onSelectLadle(event.target.value)}>
            {(rows ?? []).map((row) => (
              <option key={row.ladleNo} value={row.ladleNo}>{row.ladleNo} · {riskLevelNames[row.level]}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>包役<em>{campaigns.length} 个包役</em></span>
          <select
            className={styles.select}
            value={campaignNo ?? ''}
            onChange={(event) => {
              setCampaignChoice(Number(event.target.value));
              setScanChoice(null);
              setBaseScanChoice(null);
            }}
          >
            {campaigns.map((no) => (
              <option key={no} value={no}>第 {no} 役{no === selectedRow?.campaignNo ? '（当前）' : '（已封存）'}</option>
            ))}
          </select>
        </label>
        {tab === 'compare' ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>基准时相<em>早于当前检测</em></span>
            <select className={styles.select} value={baseScan?.id ?? ''} onChange={(event) => setBaseScanChoice(event.target.value)}>
              {campaignScans.filter((item) => item.heatInCampaign < (scan?.heatInCampaign ?? Infinity)).map((item) => (
                <option key={item.id} value={item.id}>#{item.seq} · 役内第 {item.heatInCampaign} 炉 · {item.time.slice(5, 16)}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{tab === 'compare' ? '当前时相' : '检测记录'}<em>本役 {campaignScans.length} 次</em></span>
          <select className={styles.select} value={scan?.id ?? ''} onChange={(event) => { setScanChoice(event.target.value); setBaseScanChoice(null); }}>
            {campaignScans.slice().reverse().map((item) => (
              <option key={item.id} value={item.id}>#{item.seq} · 役内第 {item.heatInCampaign} 炉 · {item.time.slice(5, 16)}</option>
            ))}
          </select>
        </label>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>点云来源</span>
          <div className={styles.fieldValue}>
            <i />
            {isMockOnly ? (displayCloud ? displayCloud.label : '双雷达合成点云') : scan?.pcdUrl ?? '未提供 PCD 地址'}
          </div>
        </div>
      </div>

      {scan && judged ? (
        <div className={styles.detailHead}>
          <div className={styles.detailNo}>
            <b>{scan.ladleNo}</b>
            <span>第 {scan.campaignNo} 役 · 役内第 {scan.heatInCampaign} 炉 · 累计 {scan.totalHeat} 炉</span>
          </div>
          <div className={styles.headMetrics}>
            <div className={styles.headMetric}><span>最大侵蚀深度</span><b className={styles[depthTone(scan.maxDepth)]}>{scan.maxDepth}<small>mm</small></b></div>
            <div className={styles.headMetric}><span>剩余耐材厚度</span><b>{scan.minResidual}<small>mm</small></b></div>
            <div className={styles.headMetric}><span>外壁最高温度</span><b className={styles[tempTone(maxTemp(temps))]}>{maxTemp(temps) ?? '—'}<small>℃</small></b></div>
            <div className={styles.headMetric}><span>预测剩余寿命</span><b>{remainingHeats(scan.maxDepth, scan.wearRate)}<small>炉</small></b></div>
          </div>
          <div className={styles.verdictBox}>
            <span className={cx(styles.verdict, styles[riskLevelTone[judged.level]])}>{judged.verdict}</span>
            <div className={styles.advice}>{judged.advice}</div>
          </div>
        </div>
      ) : null}

      {tab === 'detail' ? (
        <>
          <div className={styles.grid2}>
            <section className={styles.panel}>
              <div className={styles.panelHead}><h3>渣线 360° 展开图</h3><span>判读主视图 · 缺陷可点击定位</span></div>
              <div className={styles.panelBody}>
                <div className={styles.canvasBox}>
                  <UnrollMap
                    grid={currentResult?.analysis.depthGrid ?? null}
                    defects={defects}
                    activeDefectId={activeDefectId}
                    onSelectDefect={selectDefect}
                    height={232}
                  />
                </div>
                <div className={styles.colorLegend}>
                  <span>0</span><ColorScale /><span>200mm</span>
                  <span className={styles.thMark}><i />一级预警 {slagThresholds.depthWarnMm}mm</span>
                  <span className={cx(styles.thMark, styles.alarm)}><i />二级报警 {slagThresholds.depthAlarmMm}mm</span>
                </div>
                {currentResult ? (
                  <div className={styles.factRow}>
                    <span>基准：<b>第 {scan?.campaignNo} 役首次检测 {campaignScans[0]?.time.slice(0, 10)}</b></span>
                    <span>点数：<b>{currentResult.analysis.pointCount.toLocaleString()}</b></span>
                    <span>重复精度 ±{radarGeometry.repeatabilityMm}mm</span>
                    <span>点云分析最大 <b className={styles.danger}>{currentResult.analysis.maxDepth.toFixed(0)}mm</b> @ {formatAzimuth(currentResult.analysis.maxAzimuth)} ／ 平均 {currentResult.analysis.avgDepth.toFixed(0)}mm ／ 标准差 {currentResult.analysis.stdDepth.toFixed(1)}</span>
                  </div>
                ) : null}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHead}><h3>渣线三维点云</h3><span>可拖拽旋转 · 滚轮缩放</span></div>
              <div className={styles.panelBody}>
                <div className={cx(styles.canvasBox, styles.cloudStage)}>
                  {currentResult && !waitingDisplayCloud ? (
                    <SlagPointCloud
                      displayCloud={displayCloud}
                      positions={currentResult.positions}
                      analysis={currentResult.analysis}
                      activeDefectId={activeDefectId}
                      onSelectDefect={selectDefect}
                      view={view}
                      viewNonce={viewNonce}
                      replayProgress={stage ? stage.cloud : null}
                    />
                  ) : null}
                  <div className={styles.hud}>
                    深度色标 · {activeDefectId ? `内壁视角 · 缺陷 #${activeDefectId}` : '整体视角'}<br />
                    <b>{stage && stage.step <= 1 ? `扫描中 ${Math.round(stage.cloud * 360)}°` : '360° 全周已重建'}</b>
                  </div>
                  <div className={styles.viewButtons}>
                    {(['iso', 'top', 'front'] as CloudView[]).map((item) => (
                      <button
                        type="button"
                        key={item}
                        className={view === item && !activeDefectId ? styles.viewActive : undefined}
                        onClick={() => { clearDefect(); setView(item); setViewNonce((n) => n + 1); }}
                      >
                        {{ iso: '等轴测', top: '俯视', front: '正视' }[item]}
                      </button>
                    ))}
                  </div>
                  <div className={styles.cloudFoot}>
                    {displayCloud
                      ? `${displayCloud.label} · ${(displayCloud.positions.length / 3 / 10000).toFixed(0)} 万有效点`
                      : '2 台 RH-LR1540 · 各覆盖 180° · 配准拼接'}
                  </div>
                  {loading ? <div className={styles.loading}>{loading}</div> : null}
                </div>
                <div className={styles.scanBar}>
                  <div className={styles.scanTop}>
                    <button type="button" className={styles.button} disabled={!currentResult || replay !== null} onClick={startReplay}>
                      重放本次扫描
                    </button>
                    <b>{stage ? stage.label : `扫描已完成 · 耗时 ${scan?.durationSec ?? '—'}s`}</b>
                    <span>{Math.round((replay ?? 1) * 100)}%</span>
                  </div>
                  <div className={styles.scanTrack}><i style={{ width: `${(replay ?? 1) * 100}%` }} /></div>
                  <div className={styles.steps}>
                    {replaySteps.map((label, index) => (
                      <div
                        key={label}
                        className={cx(
                          styles.step,
                          (!stage || index < stage.step) && styles.stepDone,
                          stage && index === stage.step && styles.stepOn,
                        )}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className={styles.ocrChip}>
                    OCR 包号识别 <b>{stage && replay !== null && replay < 0.14 ? '--' : scan?.ladleNo ?? '--'}</b>
                    <span className={styles.safe}>{stage && replay !== null && replay < 0.14 ? '识别中…' : `置信度 ${scan?.ocrConfidence ?? '—'}%`}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className={styles.grid3}>
            <section className={styles.panel}>
              <div className={styles.panelHead}><h3>缺陷清单</h3><span>规则引擎自动判定 · {defects.length} 项</span></div>
              <div className={styles.panelBody}>
                <div className={styles.defectList}>
                  {defects.length === 0 ? (
                    <div className={styles.emptyText}>本次检测未触发任何缺陷规则，各项指标均在正常范围内。</div>
                  ) : null}
                  {defects.map((defect) => {
                    const text = defectValueText(defect);
                    return (
                      <button
                        type="button"
                        key={defect.id}
                        className={cx(styles.defectItem, activeDefectId === defect.id && styles.defectActive)}
                        onClick={() => selectDefect(defect.id)}
                      >
                        <span className={cx(styles.defectNo, defect.level === 1 && styles.defectNoWarn)}>{defect.id}</span>
                        <span className={styles.defectInfo}>
                          <b>{slagDefectNames[defect.type]}</b>
                          <span>
                            {defect.azimuth === null ? '全周统计' : `@ ${formatAzimuth(defect.azimuth)} 方位 · 高度 ${(defect.height ?? 0).toFixed(0)} mm`}
                            {' · '}{defect.level === 2 ? '二级报警' : '一级预警'}
                          </span>
                        </span>
                        <span className={styles.defectValue}><b>{text.value}</b><span>{text.unit}</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHead}><h3>红外测温 · {thermalChannels.length} 路测点</h3><span>{scanThermal ? `役内第 ${scanThermal.heatInCampaign} 炉` : '无数据'}</span></div>
              <div className={styles.panelBody}>
                <div className={styles.channelList}>
                  {thermalChannels.map((channel, index) => {
                    const temp = temps[index] ?? null;
                    const tone = tempTone(temp);
                    return (
                      <div key={channel.id} className={styles.channel}>
                        <span>{channel.name}</span>
                        <b className={styles[tone]}>{temp ?? '—'}</b>
                        <em>{tone === 'danger' ? '超限' : tone === 'warning' ? '预警' : '正常'}</em>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHead}><h3>深度与温度趋势</h3><span>X 轴：役内炉次</span></div>
              <div className={styles.panelBody}>
                <TrendChart
                  labels={trend.labels}
                  series={[
                    { name: '最大侵蚀深度', color: '#f59e0b', values: trend.depth, bars: true },
                    { name: '外壁最高温', color: '#22d3ee', values: trend.temp, axis: 'right' },
                  ]}
                  left={{ min: 0, max: 210, unit: 'mm', warn: slagThresholds.depthWarnMm, alarm: slagThresholds.depthAlarmMm }}
                  right={{ min: 180, max: 430, unit: '℃' }}
                  height={230}
                />
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h3>多时相展开图对比</h3>
              <span>基准 #{baseScan?.seq ?? '—'} → 当前 #{scan?.seq ?? '—'} · 间隔 {baseScan && scan ? scan.heatInCampaign - baseScan.heatInCampaign : '—'} 炉</span>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.compareGrid}>
                <div className={styles.canvasBox}>
                  <div className={styles.compareHead}><b>基准时相</b> 役内第 {baseScan?.heatInCampaign ?? '—'} 炉<span>{baseScan?.time.slice(0, 10)}</span></div>
                  <UnrollMap grid={baseResult?.analysis.depthGrid ?? null} height={180} showZones={false} />
                </div>
                <div className={styles.canvasBox}>
                  <div className={styles.compareHead}><b>当前时相</b> 役内第 {scan?.heatInCampaign ?? '—'} 炉<span>{scan?.time.slice(0, 10)}</span></div>
                  <UnrollMap grid={currentResult?.analysis.depthGrid ?? null} height={180} showZones={false} />
                </div>
              </div>
              <div className={cx(styles.canvasBox, styles.diffBox)}>
                <div className={styles.compareHead}>
                  <b>差值图</b> 当前 − 基准
                  <span>{compareRate !== null ? `平均侵蚀速率 ${compareRate.toFixed(2)} mm/炉` : '—'}</span>
                </div>
                <UnrollMap grid={diff} mode="diff" height={190} />
              </div>
              <div className={styles.colorLegend}>
                <span>−40mm 回补</span><ColorScale mode="diff" /><span>+80mm 新增侵蚀</span>
                <span style={{ marginLeft: 'auto' }}>灰 = 无显著变化（&lt;{radarGeometry.repeatabilityMm * 2}mm，2 倍重复精度内不做过度解读）</span>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}><h3>区域划分分析</h3><span>按圆周方向分区统计，识别不均匀磨损</span></div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>区域</th><th>最大深度</th><th>平均深度</th><th>超标面积占比</th><th>本周期增量</th><th>判定</th></tr></thead>
                <tbody>
                  {zones.map((zone) => (
                    <tr key={zone.name}>
                      <td>{zone.name}　<span className={styles.dim}>{zone.from}°~{zone.to}°</span></td>
                      <td className={cx(styles.cellNum, styles[depthTone(zone.maxDepth)])}>{zone.maxDepth.toFixed(0)} mm</td>
                      <td className={styles.cellNum}>{zone.avgDepth.toFixed(0)} mm</td>
                      <td className={styles.cellNum}>{(zone.overWarnRatio * 100).toFixed(0)} %</td>
                      <td className={styles.cellNum}>{zone.increment === null ? '—' : `${zone.increment >= 0 ? '+' : ''}${zone.increment.toFixed(1)} mm`}</td>
                      <td><span className={cx(styles.badge, styles[riskLevelTone[zone.level]])}>{riskLevelNames[zone.level]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

const tabLabels: Record<Tab, string> = {
  detail: '单包检测详情',
  compare: '历史对比分析',
};

const tabIntro: Record<Tab, string> = {
  detail: '双雷达点云 · 侵蚀基准：本役新修后首次检测 · 判定标准 v2.1',
  compare: '同一包役内两次检测对比 · 识别侵蚀增量与不均匀磨损',
};

/** 未指定包号时打开最近一次检测的钢包。 */
export default function SlagLineInspection({ ladleNo, onSelectLadle }: SlagLineInspectionProps) {
  const [tab, setTab] = useState<Tab>('detail');

  useEffect(() => {
    if (ladleNo) return;
    let cancelled = false;
    void fetchLadleReportRows().then((result) => {
      const latest = result.data.slice().sort((a, b) => b.lastScanTime.localeCompare(a.lastScanTime))[0];
      if (!cancelled && latest) onSelectLadle(latest.ladleNo);
    });
    return () => { cancelled = true; };
  }, [ladleNo, onSelectLadle]);

  return (
    <section className={styles.shell} aria-label="雷达渣线检测">
      <div className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><Radar size={13} /> SLAG LINE RADAR</span>
          <h2>雷达渣线检测{ladleNo ? <span className={styles.titleLadle}> · {ladleNo}</span> : null}</h2>
          <p>{tabIntro[tab]}</p>
        </div>
        <div className={styles.tabs}>
          {(Object.keys(tabLabels) as Tab[]).map((item) => (
            <button
              type="button"
              key={item}
              className={cx(styles.tab, tab === item && styles.tabActive)}
              onClick={() => setTab(item)}
            >
              {tabLabels[item]}
            </button>
          ))}
        </div>
      </div>

      {ladleNo ? (
        <LadleInspector ladleNo={ladleNo} tab={tab} onSelectLadle={onSelectLadle} />
      ) : (
        <div className={styles.notice}>正在定位最近一次检测的钢包…</div>
      )}
    </section>
  );
}
