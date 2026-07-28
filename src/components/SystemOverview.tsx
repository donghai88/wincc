'use client';

import { CheckCircle2, AlertTriangle, XCircle, WifiOff } from 'lucide-react';
import { groupWinCCByDeviceType } from '@/data/wincc-config';
import type { DeviceType } from '@/types/template';

interface SystemOverviewProps {
  visibleDeviceTypes?: DeviceType[];
}

export default function SystemOverview({ visibleDeviceTypes }: SystemOverviewProps) {
  const grouped = groupWinCCByDeviceType();
  const allInstances = (visibleDeviceTypes
    ? visibleDeviceTypes.flatMap((deviceType) => grouped[deviceType] ?? [])
    : Object.values(grouped).flat());

  const totalOnline = allInstances.filter((i) => i.status === 'online').length;
  const totalWarning = allInstances.filter((i) => i.status === 'warning').length;
  const totalError = allInstances.filter((i) => i.status === 'error').length;
  const totalOffline = allInstances.filter(
    (i) => i.status === 'offline' || i.status === 'maintenance'
  ).length;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        padding: '12px 20px',
        background: 'var(--surface)',
        borderRadius: 10,
        border: '1px solid var(--border)',
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
        系统概览
      </div>

      <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

      <div style={{ display: 'flex', gap: 24 }}>
        {/* 设备总数 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>设备总数</span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {allInstances.length}
          </span>
        </div>

        {/* 正常运行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={14} color="var(--status-online)" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>运行中</span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: 'var(--status-online)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {totalOnline}
          </span>
        </div>

        {/* 预警 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} color="var(--status-warning)" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>预警</span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: totalWarning > 0 ? 'var(--status-warning)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {totalWarning}
          </span>
        </div>

        {/* 故障 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <XCircle size={14} color="var(--status-error)" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>故障</span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: totalError > 0 ? 'var(--status-error)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {totalError}
          </span>
        </div>

        {/* 离线/维护 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <WifiOff size={14} color="var(--text-muted)" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>离线</span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {totalOffline}
          </span>
        </div>
      </div>
    </div>
  );
}
