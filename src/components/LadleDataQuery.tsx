'use client';

import { useEffect, useState } from 'react';
import { Download, Eye, RefreshCw, Search } from 'lucide-react';
import {
  buildLadleRecordDownloadPath,
  buildLadleRecordListPath,
  exportLadleRecordsCsv,
  formatLadleDateTime,
  getMockLadleNos,
  ladleDeviceNameOptions,
  queryLadleRecordDetail,
  queryLadleRecordList,
} from '@/data/ladle-api-config';
import {
  buildApiUrl,
  canUseMockData,
  isMockOnly,
  resolveSnapshotUrl,
  unwrapApiData,
} from '@/lib/api-config';
import { fetchLadleNoOptions } from '@/lib/ladle-options';
import type { LadleRecordDetail, LadleRecordListQuery, LadleRecordRow } from '@/types/ladle-api';
import styles from './LadleManagement.module.css';

type QueryStatus = 'idle' | 'loading' | 'success' | 'mock' | 'fallback' | 'error';

const formatTempCell = (value: number | null | undefined, digits = 2) => (
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—'
);

const defaultQuery = (): LadleRecordListQuery => {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return {
    ladleNo: 'Y-111',
    /** 全部设备时不传 deviceNameList，避免硬编码设备名与真实/演示数据不一致导致 0 条 */
    deviceNameList: undefined,
    startTime: formatLadleDateTime(start),
    endTime: formatLadleDateTime(end),
    pageNum: 1,
    pageSize: 10,
  };
};

export default function LadleDataQuery() {
  const [draft, setDraft] = useState(defaultQuery);
  const [applied, setApplied] = useState(defaultQuery);
  const [rows, setRows] = useState<LadleRecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<QueryStatus>('idle');
  const [message, setMessage] = useState('');
  const [detailRows, setDetailRows] = useState<LadleRecordDetail[]>([]);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [ladleOptions, setLadleOptions] = useState<string[]>(() => getMockLadleNos());

  const loadLadleOptions = async () => {
    const next = await fetchLadleNoOptions();
    setLadleOptions(next);
  };

  const loadData = async (query: LadleRecordListQuery) => {
    setMessage('');

    if (isMockOnly) {
      const result = queryLadleRecordList(query);
      setRows(result.rows);
      setTotal(result.total);
      setStatus('mock');
      return;
    }

    setStatus('loading');
    try {
      const response = await fetch(buildApiUrl(buildLadleRecordListPath(query)), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as unknown;
      const data = unwrapApiData(payload) as { rows?: LadleRecordRow[]; total?: number };
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
      setStatus('success');
    } catch {
      if (canUseMockData) {
        const result = queryLadleRecordList(query);
        setRows(result.rows);
        setTotal(result.total);
        setStatus('fallback');
        setMessage('接口异常，已展示备用数据');
      } else {
        setRows([]);
        setTotal(0);
        setStatus('error');
        setMessage('查询失败，请稍后重试');
      }
    }
  };

  useEffect(() => {
    void loadLadleOptions();
  }, []);

  useEffect(() => {
    void loadData(applied);
  }, [applied]);

  useEffect(() => {
    if (!ladleOptions.length) return;
    if (!draft.ladleNo || !ladleOptions.includes(draft.ladleNo)) {
      const nextLadleNo = ladleOptions[0];
      setDraft((current) => ({ ...current, ladleNo: nextLadleNo }));
      setApplied((current) => (
        current.ladleNo === nextLadleNo ? current : { ...current, ladleNo: nextLadleNo, pageNum: 1 }
      ));
    }
  }, [ladleOptions]);

  const submitQuery = () => {
    setApplied({
      ...draft,
      deviceNameList: draft.deviceNameList?.trim() || undefined,
      pageNum: 1,
    });
  };

  const openDetail = async (row: LadleRecordRow) => {
    setDetailTitle(`${row.ladleNo} · ${row.recordTime}`);

    if (isMockOnly) {
      const result = queryLadleRecordDetail(row.ladleNo, row.recordTime);
      setDetailRows(result.data);
      setDetailOpen(true);
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`/ladle-record/${encodeURIComponent(row.ladleNo)}/${encodeURIComponent(row.recordTime)}`), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as unknown;
      const data = unwrapApiData(payload) as LadleRecordDetail[];
      setDetailRows(Array.isArray(data) ? data : []);
      setDetailOpen(true);
    } catch {
      if (canUseMockData) {
        const result = queryLadleRecordDetail(row.ladleNo, row.recordTime);
        setDetailRows(result.data);
        setDetailOpen(true);
        setMessage('原图接口异常，已展示备用数据');
      } else {
        setDetailRows([]);
        setDetailOpen(true);
        setMessage('原图加载失败，请稍后重试');
      }
    }
  };

  const exportData = () => {
    const { pageNum: _pageNum, pageSize: _pageSize, ...exportQuery } = applied;
    if (isMockOnly || canUseMockData) {
      const csv = exportLadleRecordsCsv(exportQuery);
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ladle-records-${Date.now()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('已导出 CSV 文件');
      return;
    }

    window.open(buildApiUrl(buildLadleRecordDownloadPath(exportQuery)).toString(), '_blank');
    setMessage('已触发服务端导出');
  };

  const totalPages = Math.max(1, Math.ceil(total / (applied.pageSize ?? 10)));

  return (
    <section className={styles.shell} aria-label="钢包数据查询">
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><Search size={14} aria-hidden="true" /> 历史温度数据</span>
          <h2>数据查询</h2>
          <p>按钢包号、设备与时间范围检索聚合温度记录，并支持导出与查看原始热成像数据。</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={exportData}>
          <Download size={16} aria-hidden="true" /> 导出数据
        </button>
      </header>

      {message && <div className={styles.notice} role="status">{message}</div>}

      <section className={styles.registry}>
        <div className={styles.registryHeader}>
          <div><h3>查询条件</h3><p>返回值按钢包号 + 记录时间聚合多路热成像数据</p></div>
          <span>{status === 'loading' ? '查询中…' : `共 ${total} 条`}</span>
        </div>
        <div className={styles.filters}>
          <label>
            钢包号
            <select
              value={draft.ladleNo ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, ladleNo: event.target.value }))}
            >
              {ladleOptions.map((ladleNo) => <option key={ladleNo} value={ladleNo}>{ladleNo}</option>)}
            </select>
          </label>
          <label>
            设备
            <select
              value={draft.deviceNameList ?? ''}
              onChange={(event) => setDraft((current) => ({
                ...current,
                deviceNameList: event.target.value || undefined,
              }))}
            >
              <option value="">全部设备</option>
              {ladleDeviceNameOptions.map((device) => (
                <option key={device} value={device}>{device}</option>
              ))}
            </select>
          </label>
          <label>
            开始时间
            <input
              value={draft.startTime ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))}
            />
          </label>
          <label>
            结束时间
            <input
              value={draft.endTime ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))}
            />
          </label>
          <button type="button" className={styles.primaryButton} onClick={submitQuery}>
            <RefreshCw size={15} aria-hidden="true" /> 查询
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>钢包号</th>
                <th>设备名</th>
                <th>最高温</th>
                <th>最低温</th>
                <th>平均温</th>
                <th>记录时间</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.ladleNo}-${row.recordTime}`}>
                  <td><b>{row.ladleNo}</b></td>
                  <td>{row.deviceName}</td>
                  <td>{formatTempCell(row.maxTemp)}</td>
                  <td>{formatTempCell(row.minTemp)}</td>
                  <td>{formatTempCell(row.avgTemp)}</td>
                  <td>{row.recordTime}</td>
                  <td>
                    <button type="button" onClick={() => void openDetail(row)}>
                      <Eye size={12} aria-hidden="true" /> 原图
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className={styles.empty}>暂无符合条件的记录。</p>}
        </div>

        <div className={styles.filters} style={{ justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--muted)', fontSize: 11 }}>
            第 {applied.pageNum ?? 1} / {totalPages} 页
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={(applied.pageNum ?? 1) <= 1}
              onClick={() => setApplied((current) => ({ ...current, pageNum: Math.max(1, (current.pageNum ?? 1) - 1) }))}
            >
              上一页
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={(applied.pageNum ?? 1) >= totalPages}
              onClick={() => setApplied((current) => ({ ...current, pageNum: Math.min(totalPages, (current.pageNum ?? 1) + 1) }))}
            >
              下一页
            </button>
          </div>
        </div>
      </section>

      {detailOpen && (
        <section className={styles.detail} style={{ marginTop: 12 }}>
          <div className={styles.detailHead}>
            <div><span>原始热成像数据</span><h3>{detailTitle}</h3></div>
            <button type="button" className={styles.primaryButton} onClick={() => setDetailOpen(false)}>关闭</button>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>设备</th>
                  <th>最高温</th>
                  <th>最低温</th>
                  <th>平均温</th>
                  <th>记录时间</th>
                  <th>截图</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.map((row, index) => {
                  const snapshotUrl = row.snapshotPath ? resolveSnapshotUrl(row.snapshotPath) : '';
                  return (
                    <tr key={row.id ?? `${row.deviceName}-${row.recordTime}-${index}`}>
                      <td><b>{row.deviceName}</b></td>
                      <td>{formatTempCell(row.maxTemp)}</td>
                      <td>{formatTempCell(row.minTemp)}</td>
                      <td>{formatTempCell(row.avgTemp)}</td>
                      <td>{row.recordTime}</td>
                      <td>
                        {snapshotUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- dynamic snapshot URLs
                          <img
                            src={snapshotUrl}
                            alt={`${row.deviceName} 截图`}
                            style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                          />
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {detailRows.length === 0 && <p className={styles.empty}>暂无原始热成像明细。</p>}
          </div>
        </section>
      )}
    </section>
  );
}
