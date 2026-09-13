'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ClipboardList, PackagePlus, RefreshCw, Search, Trash2, Wrench } from 'lucide-react';
import {
  buildLadleListPath,
  createLadle,
  deleteLadles,
  formatLadleDateTime,
  getLadleById,
  queryLadleList,
  updateLadle,
} from '@/data/ladle-api-config';
import {
  buildApiUrl,
  canUseMockData,
  isMockOnly,
  unwrapApiData,
} from '@/lib/api-config';
import type { LadleEntity, LadleListQuery, LadleStatusCode } from '@/types/ladle-api';
import { ladleStatusLabels } from '@/types/ladle-api';
import styles from './LadleManagement.module.css';

type ApiStatus = 'idle' | 'loading' | 'success' | 'mock' | 'fallback' | 'error';

const statusClass: Record<LadleStatusCode, string> = {
  '1': 'safe',
  '2': 'danger',
  '3': 'warning',
  '4': 'danger',
};

const emptyForm = (): Omit<LadleEntity, 'id'> => ({
  ladleNo: '',
  productionDate: '2026-07-20',
  plannedLifespan: 500,
  estimatedRemainingLife: 400,
  latestTemperature: '300',
  lastMaintenanceTime: '2026-07-30',
  totalUsageCount: 0,
  currentStatus: '1',
});

export default function LadleManagement() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | LadleStatusCode>('all');
  const [pageNum, setPageNum] = useState(1);
  const [rows, setRows] = useState<LadleEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<LadleEntity | null>(null);
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState<ApiStatus>('idle');
  const [form, setForm] = useState(emptyForm());
  const [editing, setEditing] = useState(false);
  /** 与「列表选中编辑」区分，避免新建时仍带着选中项走更新接口 */
  const [creating, setCreating] = useState(false);

  const listQuery = useMemo<LadleListQuery>(() => ({
    ladleNo: query.trim() || undefined,
    currentStatus: filter === 'all' ? undefined : filter,
    pageNum,
    pageSize: 10,
  }), [filter, pageNum, query]);

  const loadList = async (options?: { allowAutoSelect?: boolean }) => {
    const allowAutoSelect = options?.allowAutoSelect ?? true;

    if (isMockOnly) {
      const result = queryLadleList(listQuery);
      setRows(result.rows);
      setTotal(result.total);
      setStatus('mock');
      if (allowAutoSelect && result.rows[0] && selectedId == null && !creating) {
        setSelectedId(result.rows[0].id);
      }
      return;
    }

    setStatus('loading');
    try {
      const response = await fetch(buildApiUrl(buildLadleListPath(listQuery)), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as unknown;
      const data = unwrapApiData(payload) as { rows?: LadleEntity[]; total?: number };
      const nextRows = Array.isArray(data.rows) ? data.rows : [];
      setRows(nextRows);
      setTotal(typeof data.total === 'number' ? data.total : 0);
      setStatus('success');
      if (allowAutoSelect && nextRows[0] && selectedId == null && !creating) {
        setSelectedId(nextRows[0].id);
      }
    } catch {
      if (canUseMockData) {
        const result = queryLadleList(listQuery);
        setRows(result.rows);
        setTotal(result.total);
        setStatus('fallback');
        if (allowAutoSelect && result.rows[0] && selectedId == null && !creating) {
          setSelectedId(result.rows[0].id);
        }
      } else {
        setRows([]);
        setTotal(0);
        setStatus('error');
      }
    }
  };

  const loadDetail = async (id: number) => {
    if (isMockOnly || canUseMockData) {
      setSelected(getLadleById(id).data);
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`/ladle/${id}`), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as unknown;
      setSelected(unwrapApiData(payload) as LadleEntity);
    } catch {
      setSelected(getLadleById(id).data);
    }
  };

  useEffect(() => {
    void loadList();
  }, [listQuery]);

  useEffect(() => {
    if (creating) return;
    if (selectedId !== null) void loadDetail(selectedId);
  }, [selectedId, creating]);

  const startCreate = () => {
    setCreating(true);
    setEditing(true);
    setSelectedId(null);
    setSelected(null);
    setForm(emptyForm());
    setNotice('');
  };

  const startEdit = () => {
    if (!selected) return;
    setCreating(false);
    setEditing(true);
    setForm({ ...selected });
  };

  const cancelEdit = () => {
    setCreating(false);
    setEditing(false);
    setForm(emptyForm());
  };

  const normalCount = rows.filter((item) => item.currentStatus === '1').length;
  const attentionCount = rows.filter((item) => item.currentStatus === '3').length;
  const maintenanceCount = rows.filter((item) => ['2', '4'].includes(item.currentStatus)).length;
  const totalPages = Math.max(1, Math.ceil(total / 10));

  const submitCreate = async () => {
    const payload = { ...form, ladleNo: form.ladleNo.trim() };
    if (!payload.ladleNo) {
      setNotice('请填写钢包号');
      return;
    }

    if (isMockOnly || canUseMockData) {
      createLadle(payload);
      setCreating(false);
      setEditing(false);
      setForm(emptyForm());
      await loadList({ allowAutoSelect: true });
      setNotice(`已创建钢包 ${payload.ladleNo}`);
      return;
    }

    try {
      const response = await fetch(buildApiUrl('/ladle'), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setCreating(false);
      setEditing(false);
      setForm(emptyForm());
      await loadList({ allowAutoSelect: true });
      setNotice(`已创建钢包 ${payload.ladleNo}`);
    } catch {
      createLadle(payload);
      setCreating(false);
      setEditing(false);
      setForm(emptyForm());
      await loadList({ allowAutoSelect: true });
      setNotice('接口异常，已在本地演示环境中创建');
    }
  };

  const submitUpdate = async () => {
    if (!selected) return;
    const payload = { ...selected, ...form, id: selected.id };

    if (isMockOnly || canUseMockData) {
      updateLadle(payload);
      setNotice(`已更新钢包 ${payload.ladleNo}`);
      setCreating(false);
      setEditing(false);
      void loadList({ allowAutoSelect: false });
      void loadDetail(payload.id);
      return;
    }

    try {
      const response = await fetch(buildApiUrl('/ladle'), {
        method: 'PUT',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setNotice(`已更新钢包 ${payload.ladleNo}`);
      setCreating(false);
      setEditing(false);
      void loadList({ allowAutoSelect: false });
      void loadDetail(payload.id);
    } catch {
      updateLadle(payload);
      setNotice('接口异常，已在本地演示环境中更新');
      void loadDetail(payload.id);
    }
  };

  const removeSelected = async () => {
    if (!selected) return;

    if (isMockOnly || canUseMockData) {
      deleteLadles([selected.id]);
      setNotice(`已删除钢包 ${selected.ladleNo}`);
      setSelectedId(null);
      setSelected(null);
      void loadList();
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`/ladle/${selected.id}`), { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setNotice(`已删除钢包 ${selected.ladleNo}`);
      setSelectedId(null);
      setSelected(null);
      void loadList();
    } catch {
      deleteLadles([selected.id]);
      setNotice('接口异常，已在本地演示环境中删除');
      void loadList();
    }
  };

  return (
    <section className={styles.shell} aria-label="钢包管理">
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><ClipboardList size={14} aria-hidden="true" /> 钢包档案</span>
          <h2>钢包管理</h2>
          <p>对接 `/ladle` 增删改查与分页列表，状态字段映射文档 `currentStatus`。</p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={startCreate}
        >
          <PackagePlus size={16} aria-hidden="true" /> 新建钢包
        </button>
      </header>

      {notice && <div className={styles.notice} role="status">{notice}</div>}

      <div className={styles.summary}>
        <div><span>在册钢包</span><b>{total}</b><em>{status === 'loading' ? '加载中' : '分页查询总数'}</em></div>
        <div><span>使用中</span><b className={styles.safe}>{normalCount}</b><em>状态 1</em></div>
        <div><span>需关注</span><b className={styles.warning}>{attentionCount}</b><em>状态 3</em></div>
        <div><span>待检修/检修中</span><b className={styles.danger}>{maintenanceCount}</b><em>状态 2 / 4</em></div>
      </div>

      <div className={styles.layout}>
        <section className={styles.registry}>
          <div className={styles.registryHeader}>
            <div><h3>钢包档案</h3><p>GET /ladle/list</p></div>
            <button type="button" className={styles.primaryButton} onClick={() => void loadList()}>
              <RefreshCw size={14} aria-hidden="true" /> 刷新
            </button>
          </div>
          <div className={styles.filters}>
            <label><Search size={15} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索钢包编号" /></label>
            <select value={filter} onChange={(event) => setFilter(event.target.value as 'all' | LadleStatusCode)}>
              <option value="all">全部状态</option>
              <option value="1">使用中</option>
              <option value="3">需关注</option>
              <option value="2">待检修</option>
              <option value="4">正在检修</option>
            </select>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>包号</th><th>状态</th><th>累计使用</th><th>最近温度</th><th>上次检修</th></tr></thead>
              <tbody>
                {rows.map((asset) => (
                  <tr
                    key={asset.id}
                    className={asset.id === selectedId && !creating ? styles.selectedRow : ''}
                    onClick={() => {
                      setCreating(false);
                      setEditing(false);
                      setSelectedId(asset.id);
                    }}
                  >
                    <td><b>{asset.ladleNo}</b><small>ID {asset.id}</small></td>
                    <td><span className={`${styles.badge} ${styles[statusClass[asset.currentStatus]]}`}>{ladleStatusLabels[asset.currentStatus]}</span></td>
                    <td>{asset.totalUsageCount} 次</td>
                    <td>{asset.latestTemperature}°C</td>
                    <td>{asset.lastMaintenanceTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className={styles.empty}>未找到符合条件的钢包档案。</p>}
          </div>
          <div className={styles.filters} style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)', fontSize: 11 }}>第 {pageNum} / {totalPages} 页</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className={styles.primaryButton} disabled={pageNum <= 1} onClick={() => setPageNum((value) => Math.max(1, value - 1))}>上一页</button>
              <button type="button" className={styles.primaryButton} disabled={pageNum >= totalPages} onClick={() => setPageNum((value) => Math.min(totalPages, value + 1))}>下一页</button>
            </div>
          </div>
        </section>

        <aside className={styles.detail} aria-label="钢包档案详情">
          {editing ? (
            <>
              <div className={styles.detailHead}><div><span>{creating ? '新建钢包' : '编辑钢包'}</span><h3>{form.ladleNo || '待填写'}</h3></div></div>
              <div className={styles.filters} style={{ flexDirection: 'column' }}>
                <label>钢包号<input value={form.ladleNo} onChange={(event) => setForm((current) => ({ ...current, ladleNo: event.target.value }))} /></label>
                <label>投产时间<input value={form.productionDate} onChange={(event) => setForm((current) => ({ ...current, productionDate: event.target.value }))} /></label>
                <label>计划寿命<input type="number" value={form.plannedLifespan} onChange={(event) => setForm((current) => ({ ...current, plannedLifespan: Number(event.target.value) }))} /></label>
                <label>剩余寿命<input type="number" value={form.estimatedRemainingLife} onChange={(event) => setForm((current) => ({ ...current, estimatedRemainingLife: Number(event.target.value) }))} /></label>
                <label>最近温度<input type="number" value={form.latestTemperature} onChange={(event) => setForm((current) => ({ ...current, latestTemperature: event.target.value }))} /></label>
                <label>累计使用<input type="number" value={form.totalUsageCount} onChange={(event) => setForm((current) => ({ ...current, totalUsageCount: Number(event.target.value) }))} /></label>
                <label>上次检修<input value={form.lastMaintenanceTime} onChange={(event) => setForm((current) => ({ ...current, lastMaintenanceTime: event.target.value }))} /></label>
                <label>
                  状态
                  <select value={form.currentStatus} onChange={(event) => setForm((current) => ({ ...current, currentStatus: event.target.value as LadleStatusCode }))}>
                    {Object.entries(ladleStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </div>
              <div className={styles.filters}>
                <button type="button" className={styles.primaryButton} onClick={() => void (creating ? submitCreate() : submitUpdate())}>保存</button>
                <button type="button" className={styles.primaryButton} onClick={cancelEdit}>取消</button>
              </div>
            </>
          ) : selected ? (
            <>
              <div className={styles.detailHead}><div><span>当前档案</span><h3>{selected.ladleNo}</h3></div><span className={`${styles.badge} ${styles[statusClass[selected.currentStatus]]}`}>{ladleStatusLabels[selected.currentStatus]}</span></div>
              <p className={styles.statusText}>最近更新 {selected.updateTime ?? selected.createTime ?? formatLadleDateTime(new Date())}</p>
              <div className={styles.metrics}>
                <div><span>累计使用</span><b>{selected.totalUsageCount}<small>次</small></b></div>
                <div><span>剩余寿命预估</span><b>{selected.estimatedRemainingLife}<small>次</small></b></div>
                <div><span>计划寿命</span><b>{selected.plannedLifespan}<small>次</small></b></div>
                <div><span>最近温度</span><b>{selected.latestTemperature}<small>°C</small></b></div>
              </div>
              <dl>
                <div><dt>投产日期</dt><dd>{selected.productionDate}</dd></div>
                <div><dt>上次检修</dt><dd>{selected.lastMaintenanceTime}</dd></div>
                <div><dt>创建时间</dt><dd>{selected.createTime ?? '—'}</dd></div>
                <div><dt>记录 ID</dt><dd>{selected.id}</dd></div>
              </dl>
              <section className={styles.plan}>
                <div><CalendarClock size={17} aria-hidden="true" /><h4>档案操作</h4></div>
                <p>支持 PUT /ladle 更新与 DELETE /ladle/{'{ids}'} 删除。</p>
                <div className={styles.filters}>
                  <button type="button" onClick={startEdit}><Wrench size={15} aria-hidden="true" /> 编辑档案</button>
                  <button type="button" onClick={() => void removeSelected()}><Trash2 size={15} aria-hidden="true" /> 删除档案</button>
                </div>
              </section>
            </>
          ) : (
            <p className={styles.empty}>请选择一条钢包档案，或点击「新建钢包」。</p>
          )}
        </aside>
      </div>
    </section>
  );
}
