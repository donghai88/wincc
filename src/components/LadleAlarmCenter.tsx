'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  buildLadleAlarmPagePath,
  formatLadleDateTime,
  getMockLadleNos,
  processLadleAlarmBatch,
  queryLadleAlarmPage,
} from '@/data/ladle-api-config';
import {
  buildApiUrl,
  canUseMockData,
  isMockOnly,
  unwrapApiData,
} from '@/lib/api-config';
import type { LadleAlarmPageQuery, LadleAlarmRecord } from '@/types/ladle-api';
import styles from './LadleManagement.module.css';

type ApiStatus = 'idle' | 'loading' | 'success' | 'mock' | 'fallback' | 'error';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const getRecentSevenDayRange = () => {
  const end = new Date();
  const start = new Date(end.getTime() - SEVEN_DAYS_MS);
  return {
    startTime: formatLadleDateTime(start),
    endTime: formatLadleDateTime(end),
  };
};

export default function LadleAlarmCenter() {
  const [draft, setDraft] = useState<LadleAlarmPageQuery>({
    pageNum: 1,
    pageSize: 10,
    isRead: undefined,
    level: undefined,
    ladleNo: '',
    ...getRecentSevenDayRange(),
  });
  const [applied, setApplied] = useState(draft);
  const [records, setRecords] = useState<LadleAlarmRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<ApiStatus>('idle');
  const [message, setMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processor, setProcessor] = useState('张三');
  const [processContent, setProcessContent] = useState('已现场排查，恢复正常');
  const ladleOptions = useMemo(() => getMockLadleNos(), []);

  const loadData = async (query: LadleAlarmPageQuery) => {
    setMessage('');

    if (isMockOnly) {
      const result = queryLadleAlarmPage(query);
      setRecords(result.data.list);
      setTotal(result.data.total);
      setStatus('mock');
      return;
    }

    setStatus('loading');
    try {
      const response = await fetch(buildApiUrl(buildLadleAlarmPagePath(query)), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as unknown;
      const data = unwrapApiData(payload) as { list?: LadleAlarmRecord[]; total?: number };
      setRecords(Array.isArray(data.list) ? data.list : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
      setStatus('success');
    } catch {
      if (canUseMockData) {
        const result = queryLadleAlarmPage(query);
        setRecords(result.data.list);
        setTotal(result.data.total);
        setStatus('fallback');
        setMessage('接口异常，已展示演示数据');
      } else {
        setRecords([]);
        setTotal(0);
        setStatus('error');
        setMessage('加载失败，请稍后重试');
      }
    }
  };

  useEffect(() => {
    void loadData(applied);
  }, [applied]);

  const submitQuery = () => {
    setApplied({ ...draft, pageNum: 1 });
  };

  const toggleSelect = (eventId: string) => {
    setSelectedIds((current) => (
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId]
    ));
  };

  const processSelected = async () => {
    if (selectedIds.length === 0) {
      setMessage('请先选择需要处理的报警记录');
      return;
    }

    const request = { eventIds: selectedIds, processor, processContent };

    if (isMockOnly || canUseMockData) {
      processLadleAlarmBatch(request);
      setSelectedIds([]);
      await loadData(applied);
      setMessage(`已处理 ${request.eventIds.length} 条报警`);
      return;
    }

    try {
      const response = await fetch(buildApiUrl('/alarm/batch-process'), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSelectedIds([]);
      await loadData(applied);
      setMessage(`已处理 ${request.eventIds.length} 条报警`);
    } catch {
      processLadleAlarmBatch(request);
      setSelectedIds([]);
      await loadData(applied);
      setMessage('接口异常，已在本地演示环境中标记为已处理');
    }
  };

  const unreadCount = records.filter((record) => record.isRead === 0).length;
  const totalPages = Math.max(1, Math.ceil(total / applied.pageSize));

  return (
    <section className={styles.shell} aria-label="钢包报警管理">
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}><AlertTriangle size={14} aria-hidden="true" /> 报警管理</span>
          <h2>报警管理</h2>
          <p>按钢包号、报警等级与已读状态查询告警记录，并支持批量处理。</p>
        </div>
      </header>

      {message && <div className={styles.notice} role="status">{message}</div>}

      <div className={styles.summary}>
        <div><span>查询结果</span><b>{total}</b><em>{status === 'loading' ? '加载中' : '当前筛选总数'}</em></div>
        <div><span>本页未读</span><b className={styles.warning}>{unreadCount}</b><em>待处理记录</em></div>
        <div><span>已选</span><b>{selectedIds.length}</b><em>批量处理</em></div>
        <div><span>数据源</span><b>{status === 'mock' || status === 'fallback' ? 'Mock' : 'API'}</b><em>ladleNo 维度</em></div>
      </div>

      <section className={styles.registry}>
        <div className={styles.registryHeader}>
          <div><h3>筛选条件</h3><p>接口字段与铁水沟一致，位置维度替换为钢包号</p></div>
          <button type="button" className={styles.primaryButton} onClick={submitQuery}>
            <RefreshCw size={15} aria-hidden="true" /> 查询
          </button>
        </div>
        <div className={styles.filters}>
          <label>
            钢包号
            <select
              value={draft.ladleNo ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, ladleNo: event.target.value }))}
            >
              <option value="">全部钢包</option>
              {ladleOptions.map((ladleNo) => <option key={ladleNo} value={ladleNo}>{ladleNo}</option>)}
            </select>
          </label>
          <label>
            等级
            <select
              value={draft.level ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, level: (event.target.value || undefined) as LadleAlarmPageQuery['level'] }))}
            >
              <option value="">全部等级</option>
              <option value="1">一级</option>
              <option value="2">二级</option>
            </select>
          </label>
          <label>
            已读状态
            <select
              value={draft.isRead === undefined ? '' : String(draft.isRead)}
              onChange={(event) => setDraft((current) => ({
                ...current,
                isRead: event.target.value === '' ? undefined : Number(event.target.value) as 0 | 1,
              }))}
            >
              <option value="">全部</option>
              <option value="0">未读</option>
              <option value="1">已读</option>
            </select>
          </label>
        </div>

        <div className={styles.filters}>
          <label>处理人<input value={processor} onChange={(event) => setProcessor(event.target.value)} /></label>
          <label style={{ flex: 2 }}>处理内容<input value={processContent} onChange={(event) => setProcessContent(event.target.value)} /></label>
          <button type="button" className={styles.primaryButton} onClick={() => void processSelected()}>
            <CheckCircle2 size={15} aria-hidden="true" /> 批量处理
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th />
                <th>钢包号</th>
                <th>设备</th>
                <th>规则</th>
                <th>等级</th>
                <th>温度</th>
                <th>时间</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.eventId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(record.eventId)}
                      onChange={() => toggleSelect(record.eventId)}
                      aria-label={`选择报警 ${record.eventId}`}
                    />
                  </td>
                  <td><b>{record.ladleNo}</b></td>
                  <td>{record.channelName}</td>
                  <td>{record.ruleType}</td>
                  <td>{record.level}</td>
                  <td>{record.maxTemp.toFixed(1)}°C</td>
                  <td>{record.eventTimeStamp}</td>
                  <td>{record.isRead === 1 ? '已读' : '未读'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length === 0 && <p className={styles.empty}>暂无报警记录。</p>}
        </div>

        <div className={styles.filters} style={{ justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--muted)', fontSize: 11 }}>第 {applied.pageNum} / {totalPages} 页</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={applied.pageNum <= 1}
              onClick={() => setApplied((current) => ({ ...current, pageNum: Math.max(1, current.pageNum - 1) }))}
            >
              上一页
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={applied.pageNum >= totalPages}
              onClick={() => setApplied((current) => ({ ...current, pageNum: Math.min(totalPages, current.pageNum + 1) }))}
            >
              下一页
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
