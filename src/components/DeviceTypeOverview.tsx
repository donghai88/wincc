'use client';

import {
  Container,
  Flame,
  GitBranch,
  Thermometer,
  Cog,
  Waves,
  ScanText,
  Circle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DeviceType } from '@/types/template';
import { deviceTypes, groupWinCCByDeviceType } from '@/data/wincc-config';

interface DeviceTypeOverviewProps {
  onSelectDeviceType: (deviceType: DeviceType) => void;
}

// 图标映射
const iconMap: Record<string, LucideIcon> = {
  container: Container,
  flame: Flame,
  'git-branch': GitBranch,
  thermometer: Thermometer,
  cog: Cog,
  waves: Waves,
  'scan-text': ScanText,
};

export default function DeviceTypeOverview({ onSelectDeviceType }: DeviceTypeOverviewProps) {
  const grouped = groupWinCCByDeviceType();

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
          选择监控设备类型
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>
          点击进入对应设备类型的详细监控面板
        </p>
      </div>

      {/* 设备类型卡片网格 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {deviceTypes.map((dt) => {
          const Icon = iconMap[dt.icon] || Circle;
          const instances = grouped[dt.id] || [];
          const onlineCount = instances.filter((i) => i.status === 'online').length;
          const warningCount = instances.filter((i) => i.status === 'warning').length;
          const errorCount = instances.filter((i) => i.status === 'error').length;
          const offlineCount = instances.filter(
            (i) => i.status === 'offline' || i.status === 'maintenance'
          ).length;
          const hasIssue = warningCount > 0 || errorCount > 0;

          return (
            <button
              key={dt.id}
              onClick={() => onSelectDeviceType(dt.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 20,
                background: 'var(--surface)',
                border: `1px solid ${hasIssue ? 'rgba(255, 69, 58, 0.3)' : 'var(--border)'}`,
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                textAlign: 'left',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = dt.color;
                e.currentTarget.style.background = 'var(--surface-hover)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 8px 24px ${dt.color}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = hasIssue
                  ? 'rgba(255, 69, 58, 0.3)'
                  : 'var(--border)';
                e.currentTarget.style.background = 'var(--surface)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* 顶部装饰线 */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: dt.color,
                  opacity: 0.8,
                }}
              />

              {/* 头部：图标 + 名称 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: `${dt.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={22} style={{ color: dt.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {dt.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {dt.description}
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </div>

              {/* 设备统计 */}
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  padding: '12px 0',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                {/* 总数 */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    设备总数
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {instances.length}
                  </div>
                </div>

                {/* 在线 */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginBottom: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <CheckCircle2 size={10} color="var(--status-online)" />
                    运行中
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 500,
                      color: 'var(--status-online)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {onlineCount}
                  </div>
                </div>

                {/* 告警/故障 */}
                {(warningCount > 0 || errorCount > 0) && (
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        marginBottom: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <AlertTriangle size={10} color="var(--status-error)" />
                      异常
                    </div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 500,
                        color: 'var(--status-error)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {warningCount + errorCount}
                    </div>
                  </div>
                )}

                {/* 离线/维护 */}
                {offlineCount > 0 && (
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        marginBottom: 4,
                      }}
                    >
                      离线
                    </div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 500,
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {offlineCount}
                    </div>
                  </div>
                )}
              </div>

              {/* 异常提示 */}
              {hasIssue && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 8,
                    padding: '8px 10px',
                    background: 'rgba(255, 69, 58, 0.08)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: 'var(--status-error)',
                  }}
                >
                  <AlertTriangle size={14} />
                  {errorCount > 0 && `${errorCount} 台故障`}
                  {errorCount > 0 && warningCount > 0 && '，'}
                  {warningCount > 0 && `${warningCount} 台预警`}
                </div>
              )}
            </button>
          );
        })}
      </div>

    </div>
  );
}
