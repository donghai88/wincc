'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, FileSpreadsheet, Lock, Radar, RefreshCw, Search } from 'lucide-react';
import { buildLadleAlarmPagePath, queryLadleAlarmPage } from '@/data/ladle-api-config';
import { buildApiUrl, isMockOnly, unwrapApiData } from '@/lib/api-config';
import {
  fetchLadleReportDetail,
  fetchLadleReportRows,
  type DataSourceStatus,
} from '@/lib/benxi-ladle-api';
import {
  formatAzimuth,
  judgeLadle,
  maxTemp,
  remainingHeats,
  riskLevelTone,
  slagThresholds,
  thermalChannels,
} from '@/lib/benxi-ladle-rules';
import type { LadleAlarmRecord } from '@/types/ladle-api';
import type { LadleReportDetail, LadleReportRow, RiskLevel } from '@/types/benxi-ladle';
import styles from './Benxi.module.css';
import { DataNotice, RiskBadge, RunStateBadge, TrendChart, cx, depthTone, tempTone } from './shared';

type SortMode = 'risk' | 'no';

interface LadleReportProps {
  ladleNo: string | null;
  onSelectLadle: (ladleNo: string | null) => void;
  onOpenRadar: (ladleNo: string) => void;
}

const levelFilters: Array<{ id: 'all' | RiskLevel; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 2, label: '危险' },
  { id: 1, label: '关注' },
  { id: 0, label: '正常' },
];

function tempCellClass(temp: number | null) {
  const tone = tempTone(temp);
  return cx(styles.cellNum, tone === 'danger' && styles.cellDanger, tone === 'warning' && styles.cellWarn);
}

function depthCellClass(depth: number) {
  const tone = depthTone(depth);
  return cx(styles.cellNum, tone === 'danger' && styles.cellDanger, tone === 'warning' && styles.cellWarn);
}

function exportCsv(rows: LadleReportRow[]) {
  const header = [
    '钢包号', '当前状态', '包役', '役内炉次', '累计炉次',
    ...thermalChannels.map((channel) => `${channel.name}最高温℃`),
    '维修前温度℃', '渣线最深mm', '最小残厚mm', '判定结论', '系统建议动作',
  ];
  const lines = rows.map((row) => [
    row.ladleNo, row.runState, `第${row.campaignNo}役`, row.heatsInCampaign, row.totalHeats,
    ...row.temps.map((value) => value ?? ''),
    row.preRepairTemp ?? '—', row.maxDepth, row.minResidual, row.verdict, row.advice,
  ].join(','));
  const blob = new Blob([`\uFEFF${[header.join(','), ...lines].join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `钢包报表_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function LadleReport({ ladleNo, onSelectLadle, onOpenRadar }: LadleReportProps) {
  if (ladleNo) {
    return <LadleReportDetailView key={ladleNo} ladleNo={ladleNo} onBack={() => onSelectLadle(null)} onOpenRadar={onOpenRadar} />;
  }
  return <LadleReportList onSelectLadle={onSelectLadle} />;
}

function LadleReportList({ onSelectLadle }: { onSelectLadle: (ladleNo: string) => void }) {
  const [rows, setRows] = useState<LadleReportRow[]>([]);
  const [status, setStatus] = useState<DataSourceStatus | 'loading'>('loading');
  const [message, setMessage] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | RiskLevel>('all');
  const [sortMode, setSortMode] = useState<SortMode>('risk');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchLadleReportRows().then((result) => {
      if (cancelled) return;
      setRows(result.data);
      setStatus(result.status);
      setMessage(result.message);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const visible = useMemo(() => {
    const filtered = rows.filter((row) => (
      (levelFilter === 'all' || row.level === levelFilter)
      && (!keyword.trim() || row.ladleNo.toUpperCase().includes(keyword.trim().toUpperCase()))
    ));
    return filtered.sort((a, b) => (
      sortMode === 'no'
        ? a.ladleNo.localeCompare(b.ladleNo)
        : b.level - a.level || b.maxDepth - a.maxDepth || a.ladleNo.localeCompare(b.ladleNo)
    ));
  }, [keyword, levelFilter, rows, sortMode]);

  const counts = [2, 1, 0].map((level) => rows.filter((row) => row.level === level).length);

  return (
    <section className={styles.shell} aria-label="钢包报表">
      <div className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><FileSpreadsheet size={13} /> LADLE REPORT</span>
          <h2>钢包报表</h2>
          <p>报表一屏看全部 · 颜色即风险 · 点击任意钢包查看包役详情</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.ghostButton} onClick={() => { setStatus('loading'); setReloadKey((key) => key + 1); }}><RefreshCw size={14} /> 刷新</button>
          <button type="button" className={styles.button} onClick={() => exportCsv(visible)} disabled={visible.length === 0}><Download size={14} /> 导出 CSV</button>
        </div>
      </div>

      <DataNotice status={status} message={message} />

      <div className={styles.toolbar}>
        <label><Search size={13} /><input className={styles.input} placeholder="钢包号" value={keyword} onChange={(event) => setKeyword(event.target.value)} /></label>
        <div className={styles.tabs}>
          {levelFilters.map((item) => (
            <button type="button" key={String(item.id)} className={cx(styles.tab, levelFilter === item.id && styles.tabActive)} onClick={() => setLevelFilter(item.id)}>
              {item.label}{item.id !== 'all' ? ` ${counts[2 - item.id]}` : ` ${rows.length}`}
            </button>
          ))}
        </div>
        <div className={styles.toolbarRight}>
          <label>排序
            <select className={styles.select} value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="risk">风险优先</option>
              <option value="no">按钢包号</option>
            </select>
          </label>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={cx(styles.tableWrap, styles.tableWrapScreen)}>
          <table className={cx(styles.table, styles.clickableRows)}>
            <thead>
              <tr>
                <th>钢包号</th><th>当前状态</th><th>役内炉次</th><th>累计炉次</th>
                {thermalChannels.map((channel) => (
                  <th key={channel.id}>{channel.name.replace('热像仪', '')}<br />最高温℃</th>
                ))}
                <th>维修前温度<br />（待定）℃</th><th>渣线最深<br />mm</th><th>最小残厚<br />mm</th><th>判定结论</th><th>系统建议动作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.ladleNo} className={styles[`rowLv${row.level}`]} onClick={() => onSelectLadle(row.ladleNo)}>
                  <td><b>{row.ladleNo}</b></td>
                  <td>{row.runState === '在线运行' ? row.runState : <RunStateBadge state={row.runState} />}</td>
                  <td className={styles.cellNum}>{row.heatsInCampaign}</td>
                  <td className={styles.cellNum}>{row.totalHeats}</td>
                  {row.temps.map((temp, index) => (
                    <td key={thermalChannels[index]?.id ?? index} className={tempCellClass(temp)}>{temp ?? '—'}</td>
                  ))}
                  <td className={tempCellClass(row.preRepairTemp)}>{row.preRepairTemp ?? '—'}</td>
                  <td className={depthCellClass(row.maxDepth)}>{row.maxDepth}</td>
                  <td className={depthCellClass(row.maxDepth)}>{row.minResidual}</td>
                  <td><RiskBadge level={row.level} /></td>
                  <td className={styles[riskLevelTone[row.level]]}>{row.advice}</td>
                </tr>
              ))}
              {visible.length === 0 ? <tr><td colSpan={16} className={styles.emptyText}>暂无数据</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className={styles.thresholdNote}>
          当前阈值：设计渣线厚度 {slagThresholds.designThicknessMm} mm · 侵蚀 {slagThresholds.depthWarnMm} mm 预警 · 侵蚀 {slagThresholds.depthAlarmMm} mm 报警 ·
          温度 {slagThresholds.tempWarnC} ℃ 预警 / {slagThresholds.tempAlarmC} ℃ 报警。判定结论 = 温度与渣线两项取更严重者，不做平均。
        </div>
      </section>
    </section>
  );
}

async function loadLadleAlarms(ladleNo: string): Promise<LadleAlarmRecord[]> {
  const query = { pageNum: 1, pageSize: 50, ladleNo };
  if (isMockOnly) return queryLadleAlarmPage(query).data.list;
  try {
    const response = await fetch(buildApiUrl(buildLadleAlarmPagePath(query)), { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = unwrapApiData(await response.json() as unknown) as { list?: LadleAlarmRecord[] };
    return Array.isArray(data?.list) ? data.list : [];
  } catch {
    return queryLadleAlarmPage(query).data.list;
  }
}

function LadleReportDetailView({ ladleNo, onBack, onOpenRadar }: { ladleNo: string; onBack: () => void; onOpenRadar: (no: string) => void }) {
  const [campaignNo, setCampaignNo] = useState<number | undefined>();
  const [detail, setDetail] = useState<LadleReportDetail | null>(null);
  const [alarms, setAlarms] = useState<LadleAlarmRecord[]>([]);
  const [status, setStatus] = useState<DataSourceStatus | 'loading'>('loading');
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    void loadLadleAlarms(ladleNo).then((list) => { if (!cancelled) setAlarms(list); });
    return () => { cancelled = true; };
  }, [ladleNo]);

  useEffect(() => {
    let cancelled = false;
    void fetchLadleReportDetail(ladleNo, campaignNo).then((result) => {
      if (cancelled) return;
      setDetail(result.data);
      setStatus(result.status);
      setMessage(result.message);
    });
    return () => { cancelled = true; };
  }, [campaignNo, ladleNo]);

  if (!detail) {
    return (
      <section className={styles.shell}>
        <button type="button" className={styles.ghostButton} onClick={onBack}><ArrowLeft size={14} /> 返回报表</button>
        <div style={{ marginTop: 12 }}><DataNotice status={status} message={message ?? `未找到钢包 ${ladleNo}`} /></div>
      </section>
    );
  }

  const { row, campaigns, current } = detail;
  const { campaign, scans, thermal, events, repairs } = current;
  const isCurrent = campaign.campaignNo === row.campaignNo;
  const lastScan = scans[scans.length - 1];
  const lastThermal = thermal[thermal.length - 1];
  const temps = isCurrent ? row.temps : lastThermal?.temps ?? [];
  const depth = isCurrent ? row.maxDepth : campaign.finalMaxDepth;
  const judged = judgeLadle(depth, temps);
  const level = isCurrent ? row.level : judged.level;
  const wearRate = depth / Math.max(campaign.heats, 1);
  const preRepairTemp = isCurrent ? row.preRepairTemp : maxTemp(lastThermal?.temps ?? []);
  const p1Series = thermal.map((item) => maxTemp(item.temps.slice(0, 3)));
  const p2Series = thermal.map((item) => maxTemp(item.temps.slice(3)));

  return (
    <section className={styles.shell} aria-label={`${ladleNo} 钢包报表详情`}>
      <div className={styles.pageHeader}>
        <div>
          <button type="button" className={styles.ghostButton} onClick={onBack}><ArrowLeft size={14} /> 返回报表</button>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.button} onClick={() => onOpenRadar(ladleNo)}><Radar size={14} /> 查看雷达点云</button>
        </div>
      </div>

      <DataNotice status={status} message={message} />

      <div className={styles.detailHead}>
        <div className={styles.detailNo}><b>{row.ladleNo}</b><span>{row.ladleType} · 第 {campaign.campaignNo} 役</span></div>
        <div className={styles.headMetrics}>
          <div className={styles.headMetric}><span>渣线最深</span><b className={styles[depthTone(depth)]}>{depth}<small>mm</small></b></div>
          <div className={styles.headMetric}><span>最小残厚</span><b>{slagThresholds.designThicknessMm - depth}<small>mm</small></b></div>
          <div className={styles.headMetric}><span>外壁最高温</span><b className={styles[tempTone(maxTemp(temps))]}>{maxTemp(temps) ?? '—'}<small>℃</small></b></div>
          <div className={styles.headMetric}><span>预测剩余寿命</span><b>{isCurrent ? remainingHeats(depth, wearRate) : '—'}<small>炉</small></b></div>
        </div>
        <div className={styles.verdictBox}>
          <span className={cx(styles.verdict, styles[riskLevelTone[level]])}>{judged.verdict}</span>
          <div className={styles.advice}>{isCurrent ? row.advice : campaign.finalNote}</div>
        </div>
      </div>

      <div className={styles.campaignBar}>
        <span>包役</span>
        {campaigns.map((item) => (
          <button
            type="button"
            key={item.campaignNo}
            className={cx(styles.campaignTab, item.campaignNo === campaign.campaignNo && styles.campaignTabActive)}
            onClick={() => { setStatus('loading'); setCampaignNo(item.campaignNo); }}
          >
            第 {item.campaignNo} 役
            <small>{item.sealed ? '已封存' : '当前役'}</small>
          </button>
        ))}
        {campaign.sealed ? (
          <span className={styles.readonlyNote}><Lock size={12} /> 历史役数据已封存，只读不可修改</span>
        ) : null}
      </div>

      <div className={styles.blocks}>
        <section className={cx(styles.panel, styles.blockWide)}>
          <div className={styles.panelHead}><h3><span className={styles.blockNo}>1</span>基本信息</h3></div>
          <div className={styles.panelBody}>
            <div className={styles.infoGrid}>
              <div><span>钢包号</span><b>{row.ladleNo}</b></div>
              <div><span>包型</span><b>{row.ladleType}</b></div>
              <div><span>第几役</span><b>第 {campaign.campaignNo} 役 / 共 {campaigns.length} 役</b></div>
              <div><span>当前状态</span><b>{isCurrent ? row.runState : '已下线大修'}</b></div>
              <div><span>役内炉次</span><b>{campaign.heats}</b></div>
              <div><span>累计炉次</span><b>{campaign.startTotalHeat} → {campaign.startTotalHeat + campaign.heats - 1}</b></div>
              <div><span>投用日期</span><b>{row.commissionDate}</b></div>
              <div><span>本役起止</span><b>{campaign.startDate} ~ {campaign.endDate ?? '在线'}</b></div>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}><h3><span className={styles.blockNo}>2</span>热像温度</h3><span>每次检测最高温 · {thermal.length} 次</span></div>
          <div className={styles.panelBody}>
            <div className={styles.tempChips}>
              {thermalChannels.map((channel, index) => (
                <div key={channel.id} className={styles.tempChip}>
                  <span>{channel.name.replace('热像仪', '')}</span>
                  <b className={styles[tempTone(temps[index] ?? null)]}>{temps[index] ?? '—'}<small className={styles.dim}> ℃</small></b>
                </div>
              ))}
            </div>
            <TrendChart
              labels={thermal.map((item) => item.heatInCampaign)}
              series={[
                { name: 'P1 检测区最高温', color: '#22d3ee', values: p1Series },
                { name: 'P2 热维位最高温', color: '#a78bfa', values: p2Series },
              ]}
              left={{ min: 180, max: 420, unit: '℃', warn: slagThresholds.tempWarnC, alarm: slagThresholds.tempAlarmC }}
              xTitle="役内炉次"
              height={180}
            />
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}><h3><span className={styles.blockNo}>4</span>渣线雷达检测</h3><span>{scans.length} 次检测</span></div>
          <div className={styles.panelBody}>
            <div className={styles.infoGrid}>
              <div><span>最大侵蚀深度</span><b className={styles[depthTone(depth)]}>{depth} mm</b></div>
              <div><span>所在方位 / 高度</span><b>{lastScan ? `${formatAzimuth(lastScan.maxAzimuth)} / ${lastScan.maxHeight}mm` : '—'}</b></div>
              <div><span>最小残厚</span><b>{slagThresholds.designThicknessMm - depth} mm</b></div>
              <div><span>磨损速率</span><b>{wearRate.toFixed(2)} mm/炉</b></div>
            </div>
            <div className={styles.subTitle}>侵蚀深度随役内炉次变化</div>
            <TrendChart
              labels={scans.map((scan) => scan.heatInCampaign)}
              series={[{ name: '最大侵蚀深度', color: '#f59e0b', values: scans.map((scan) => scan.maxDepth), bars: true }]}
              left={{ min: 0, max: 200, unit: 'mm', warn: slagThresholds.depthWarnMm, alarm: slagThresholds.depthAlarmMm }}
              xTitle="役内炉次"
              height={150}
            />
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}><h3><span className={styles.blockNo}>3</span>准备维修前温度</h3><span>下线前最后一次温度</span></div>
          <div className={styles.panelBody}>
            <div className={styles.bigValue}>
              <b className={styles[tempTone(preRepairTemp)]}>{preRepairTemp ?? '—'}</b><span className={styles.muted}>℃</span>
            </div>
            <div className={styles.subNote}>
              设备点位待客户确认（Excel Q2）。当前取值：{isCurrent ? '下线待修时的最后一次测温' : '本役大修前最后一次热像检测最高温'}。
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}><h3><span className={styles.blockNo}>5</span>运行记录</h3><span>役内事件 {events.length} 条</span></div>
          <div className={styles.tableWrap} style={{ maxHeight: 260 }}>
            <table className={styles.table}>
              <thead><tr><th>序号</th><th>事件</th><th>时间</th><th>站点</th><th>役内炉次</th><th>累计炉次</th><th>操作人</th></tr></thead>
              <tbody>
                {events.map((event) => (
                  <tr key={`${event.campaignNo}-${event.seq}`}>
                    <td className={styles.cellNum}>{event.seq}</td>
                    <td><span className={cx(styles.badge, event.type === '大修' ? styles.purple : event.type === '热修' ? styles.warning : styles.neutral)}>{event.type}</span></td>
                    <td className={styles.cellNum}>{event.time.slice(0, 16)}</td>
                    <td>{event.station}</td>
                    <td className={styles.cellNum}>{event.heatInCampaign}</td>
                    <td className={styles.cellNum}>{event.totalHeat}</td>
                    <td>{event.operator}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={cx(styles.panel, styles.blockWide)}>
          <div className={styles.panelHead}><h3><span className={styles.blockNo}>6</span>维修与告警</h3><span>维修履历按役展示 · 告警跨役可追溯</span></div>
          <div className={styles.grid2} style={{ marginTop: 0, padding: 12 }}>
            <div>
              <div className={styles.subTitle} style={{ marginTop: 0 }}>维修履历（第 {campaign.campaignNo} 役）</div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>时间</th><th>类型</th><th>役内炉次</th><th>深度 前→后</th><th>温度 前→后</th><th>内容</th></tr></thead>
                  <tbody>
                    {repairs.length === 0 ? <tr><td colSpan={6} className={styles.emptyText}>本役暂无维修记录</td></tr> : null}
                    {repairs.map((repair) => (
                      <tr key={`${repair.time}-${repair.type}`}>
                        <td className={styles.cellNum}>{repair.time.slice(0, 16)}</td>
                        <td><span className={cx(styles.badge, repair.type === '大修' ? styles.purple : styles.warning)}>{repair.type}</span></td>
                        <td className={styles.cellNum}>{repair.heatInCampaign}</td>
                        <td className={styles.cellNum}>{repair.depthBefore} → {repair.depthAfter} mm</td>
                        <td className={styles.cellNum}>{repair.tempBefore} → {repair.tempAfter} ℃</td>
                        <td>{repair.content}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div className={styles.subTitle} style={{ marginTop: 0 }}>告警记录（来自报警管理）</div>
              <div className={styles.tableWrap} style={{ maxHeight: 240 }}>
                <table className={styles.table}>
                  <thead><tr><th>时间</th><th>等级</th><th>内容</th><th>处置状态</th></tr></thead>
                  <tbody>
                    {alarms.length === 0 ? <tr><td colSpan={4} className={styles.emptyText}>暂无告警</td></tr> : null}
                    {alarms.map((alarm) => (
                      <tr key={alarm.eventId}>
                        <td className={styles.cellNum}>{alarm.eventTimeStamp.slice(0, 16)}</td>
                        <td><span className={cx(styles.badge, alarm.level === '2' ? styles.danger : styles.warning)}>{alarm.level === '2' ? '报警' : '预警'}</span></td>
                        <td style={{ whiteSpace: 'normal', textAlign: 'left' }}>{alarm.ruleType} · {alarm.channelName}</td>
                        <td className={alarm.isRead ? styles.safe : styles.warning}>{alarm.isRead ? `已处置 · ${alarm.processor ?? ''}` : '未处置'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
