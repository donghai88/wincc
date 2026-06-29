'use client';

import { Circle, ChevronLeft } from 'lucide-react';
import type { WinCCInstance, DeviceType } from '@/types/template';
import { deviceTypes, groupWinCCByDeviceType } from '@/data/wincc-config';

interface DeviceSelectorProps {
  deviceType: DeviceType;
  selectedWinCC: WinCCInstance | null;
  onSelectWinCC: (wincc: WinCCInstance) => void;
  onBack: () => void;
}

const statusColor: Record<string, string> = {
  online: 'var(--status-online)',
  warning: 'var(--status-warning)',
  error: 'var(--status-error)',
  offline: 'var(--status-offline)',
  maintenance: 'var(--status-offline)',
};

const statusText: Record<string, string> = {
  online: '运行中',
  warning: '预警',
  error: '故障',
  offline: '离线',
  maintenance: '维护中',
};

export default function DeviceSelector({
  deviceType,
  selectedWinCC,
  onSelectWinCC,
  onBack,
}: DeviceSelectorProps) {
  const grouped = groupWinCCByDeviceType();
  const instances = grouped[deviceType] || [];
  const deviceConfig = deviceTypes.find((d) => d.id === deviceType);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--surface)',
        borderRadius: 10,
        border: '1px solid var(--border)',
      }}
    >
      {/* 返回按钮 */}
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: 13,
          transition: 'all var(--transition-fast)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface-hover)';
          e.currentTarget.style.borderColor = 'var(--border-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--surface-raised)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <ChevronLeft size={16} />
        返回
      </button>

      {/* 分隔线 */}
      <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

      {/* 设备类型名称 */}
      <div
        style={{
          fontSize: 13,
          color: deviceConfig?.color || 'var(--text-secondary)',
          fontWeight: 500,
        }}
      >
        {deviceConfig?.name || deviceType}
      </div>

      {/* 分隔线 */}
      <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

      {/* 设备列表 */}
      <div style={{ display: 'flex', gap: 8, flex: 1, overflow: 'auto' }}>
        {instances.map((instance) => {
          const isSelected = selectedWinCC?.id === instance.id;
          const hasWarning = instance.status === 'warning' || instance.status === 'error';

          return (
            <button
              key={instance.id}
              onClick={() => onSelectWinCC(instance)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: isSelected
                  ? `linear-gradient(135deg, ${deviceConfig?.color || '#666'}15, ${deviceConfig?.color || '#666'}08)`
                  : 'var(--surface-raised)',
                border: isSelected
                  ? `1px solid ${deviceConfig?.color || 'var(--border)'}50`
                  : '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                  e.currentTarget.style.background = 'var(--surface-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--surface-raised)';
                }
              }}
            >
              {/* Status dot */}
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: statusColor[instance.status],
                  boxShadow: hasWarning ? `0 0 8px ${statusColor[instance.status]}` : 'none',
                  animation: hasWarning ? 'pulse 1.5s infinite' : 'none',
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isSelected ? 500 : 400,
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {instance.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: statusColor[instance.status],
                }}
              >
                {statusText[instance.status]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
