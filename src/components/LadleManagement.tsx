'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, ClipboardList, PackagePlus, Search, Wrench } from 'lucide-react';
import { conditionLabel, ladleAssets, type LadleAsset, type LadleCondition } from '@/data/ladle-assets';
import styles from './LadleManagement.module.css';

const statusClass: Record<LadleCondition, string> = { normal: 'safe', attention: 'warning', maintenance: 'danger' };

function conditionText(asset: LadleAsset) {
  if (asset.condition === 'maintenance') return '已达到停用检修条件';
  if (asset.condition === 'attention') return '渣线磨损进入关注区间';
  return '检测指标处于可用区间';
}

export default function LadleManagement() {
  const [assetRegister, setAssetRegister] = useState(ladleAssets);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | LadleCondition>('all');
  const [selectedId, setSelectedId] = useState(ladleAssets[0].id);
  const [notice, setNotice] = useState('');
  const assets = useMemo(() => assetRegister.filter((asset) => (filter === 'all' || asset.condition === filter) && asset.id.includes(query.trim().toUpperCase())), [assetRegister, filter, query]);
  const selected = assetRegister.find((asset) => asset.id === selectedId) ?? assetRegister[0];
  const normalCount = assetRegister.filter((asset) => asset.condition === 'normal').length;
  const attentionCount = assetRegister.filter((asset) => asset.condition === 'attention').length;
  const maintenanceCount = assetRegister.filter((asset) => asset.condition === 'maintenance').length;

  const createAsset = () => {
    const id = `A${3316 + assetRegister.length}`;
    const asset: LadleAsset = {
      id,
      condition: 'normal',
      useCount: 0,
      monthlyUses: 0,
      lastTemperature: 0,
      slagDepth: 0,
      lastInspection: '待首次检测',
      commissionedAt: '待投用',
      lastRepair: '—',
      designLife: 500,
      remainingLife: 500,
      owner: '炼钢二厂 · 热修位',
      nextAction: '完成首次检测后投入使用',
    };
    setAssetRegister((previous) => [asset, ...previous]);
    setSelectedId(id);
    setNotice(`已创建 ${id} 钢包档案，等待录入首次检测数据。`);
  };

  return (
    <section className={styles.shell} aria-label="钢包管理">
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><ClipboardList size={14} aria-hidden="true" /> 铁包资产台账</span>
          <h2>钢包管理</h2>
          <p>钢包档案、检测记录、使用寿命与检修计划统一归档。</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={createAsset}><PackagePlus size={16} aria-hidden="true" /> 新建钢包档案</button>
      </header>

      {notice && <div className={styles.notice} role="status">{notice}</div>}

      <div className={styles.summary}>
        <div><span>在册钢包</span><b>{assetRegister.length}</b><em>当前纳入在线管理</em></div>
        <div><span>使用中</span><b className={styles.safe}>{normalCount}</b><em>检测指标正常</em></div>
        <div><span>需关注</span><b className={styles.warning}>{attentionCount}</b><em>已生成复检建议</em></div>
        <div><span>待检修</span><b className={styles.danger}>{maintenanceCount}</b><em>需要安排停用窗口</em></div>
      </div>

      <div className={styles.layout}>
        <section className={styles.registry}>
          <div className={styles.registryHeader}>
            <div><h3>钢包档案</h3><p>点击条目查看完整生命周期档案</p></div>
            <span>共 {assets.length} 条</span>
          </div>
          <div className={styles.filters}>
            <label><Search size={15} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索钢包编号" aria-label="搜索钢包编号" /></label>
            <select value={filter} onChange={(event) => setFilter(event.target.value as 'all' | LadleCondition)} aria-label="按状态筛选钢包"><option value="all">全部状态</option><option value="normal">使用中</option><option value="attention">需关注</option><option value="maintenance">待检修</option></select>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>包号</th><th>状态</th><th>累计使用</th><th>渣线深度</th><th>最近检测</th><th aria-label="操作" /></tr></thead>
              <tbody>{assets.map((asset) => <tr key={asset.id} className={asset.id === selected.id ? styles.selectedRow : ''} onClick={() => setSelectedId(asset.id)}><td><b>{asset.id}</b><small>{asset.owner}</small></td><td><span className={`${styles.badge} ${styles[statusClass[asset.condition]]}`}>{conditionLabel[asset.condition]}</span></td><td>{asset.useCount} 次<small>本月 {asset.monthlyUses} 次</small></td><td className={styles[statusClass[asset.condition]]}>{asset.slagDepth.toFixed(1)} mm</td><td>{asset.lastInspection}<small>{asset.lastTemperature}°C</small></td><td><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedId(asset.id); }}>查看档案</button></td></tr>)}</tbody>
            </table>
            {assets.length === 0 && <p className={styles.empty}>未找到符合条件的钢包档案。</p>}
          </div>
        </section>

        <aside className={styles.detail} aria-label={`${selected.id} 档案详情`}>
          <div className={styles.detailHead}><div><span>当前档案</span><h3>{selected.id}</h3></div><span className={`${styles.badge} ${styles[statusClass[selected.condition]]}`}>{conditionLabel[selected.condition]}</span></div>
          <p className={styles.statusText}>{conditionText(selected)}</p>
          <div className={styles.metrics}><div><span>累计使用</span><b>{selected.useCount}<small>次</small></b></div><div><span>剩余寿命预估</span><b>{selected.remainingLife}<small>次</small></b></div><div><span>最近渣线深度</span><b className={styles[statusClass[selected.condition]]}>{selected.slagDepth.toFixed(1)}<small>mm</small></b></div><div><span>最近温度</span><b>{selected.lastTemperature}<small>°C</small></b></div></div>
          <div className={styles.life}><div><span>设计寿命</span><b>{selected.designLife} 次</b></div><div className={styles.lifeBar}><i style={{ width: `${Math.min(100, (selected.useCount / selected.designLife) * 100)}%` }} /></div><span>已使用 {Math.round((selected.useCount / selected.designLife) * 100)}%</span></div>
          <dl><div><dt>投用日期</dt><dd>{selected.commissionedAt}</dd></div><div><dt>上次热修</dt><dd>{selected.lastRepair}</dd></div><div><dt>最后检测</dt><dd>{selected.lastInspection}</dd></div><div><dt>责任工位</dt><dd>{selected.owner}</dd></div></dl>
          <section className={styles.plan}><div><CalendarClock size={17} aria-hidden="true" /><h4>下一步处置</h4></div><p>{selected.nextAction}</p><button type="button" onClick={() => setNotice(`已为 ${selected.id} 登记热修计划，待工位负责人确认检修窗口。`)}><Wrench size={15} aria-hidden="true" /> 登记热修计划</button></section>
        </aside>
      </div>
    </section>
  );
}
