'use client';

import {
  Atom,
  Snowflake,
  Zap,
  Waves,
  Wind,
  ArrowRightLeft,
  Circle,
  MapPin,
  Network,
  Clock,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import type { WinCCInstance } from '@/types/template';
import { getDeviceTypeConfig, getTemplateByWinCC } from '@/data/wincc-config';

interface WinCCHeaderProps {
  wincc: WinCCInstance;
}

// 图标映射
const iconMap: Record<string, LucideIcon> = {
  atom: Atom,
  snowflake: Snowflake,
  zap: Zap,
  waves: Waves,
  wind: Wind,
  'arrow-right-left': ArrowRightLeft,
};

// 状态样式
const statusStyles: Record<string, { color: string; gradient: string; text: string }> = {
  online: {
    color: '#00f5a0',
    gradient: 'linear-gradient(135deg, #00f5a0, #00d9f5)',
    text: '运行中',
  },
  offline: {
    color: '#f5515f',
    gradient: 'linear-gradient(135deg, #f5515f, #9f041b)',
    text: '离线',
  },
  warning: {
    color: '#f5a623',
    gradient: 'linear-gradient(135deg, #f5a623, #f093fb)',
    text: '警告',
  },
  maintenance: {
    color: '#a78bfa',
    gradient: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
    text: '维护中',
  },
};

export default function WinCCHeader({ wincc }: WinCCHeaderProps) {
  const deviceType = getDeviceTypeConfig(wincc.deviceType);
  const template = getTemplateByWinCC(wincc);
  const status = statusStyles[wincc.status];
  const Icon = deviceType ? iconMap[deviceType.icon] || Circle : Circle;

  return (
    <div
      className="relative overflow-hidden rounded-xl mb-5"
      style={{
        background: 'linear-gradient(145deg, rgba(18,18,24,0.95), rgba(12,12,16,0.98))',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Top accent glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${deviceType?.color || '#00f5a0'}50 50%, transparent 100%)`,
        }}
      />

      {/* Background decorations */}
      <div
        className="absolute -top-20 -right-20 w-40 h-40 opacity-10 rounded-full blur-3xl"
        style={{ background: deviceType?.color || '#00f5a0' }}
      />

      <div className="relative p-5">
        <div className="flex items-start justify-between">
          {/* Left: Main Info */}
          <div className="flex items-start gap-4">
            {/* Device Icon */}
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center"
              style={{
                background: `${deviceType?.color || '#00f5a0'}15`,
                border: `1px solid ${deviceType?.color || '#00f5a0'}25`,
                boxShadow: `0 0 20px ${deviceType?.color || '#00f5a0'}20`,
              }}
            >
              <Icon size={24} style={{ color: deviceType?.color || '#00f5a0' }} />
            </div>

            {/* Info */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1
                  className="text-xl font-light"
                  style={{
                    background: `linear-gradient(135deg, ${deviceType?.color || '#00f5a0'}, #fff)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {wincc.name}
                </h1>
                {/* Status Badge */}
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                  style={{
                    background: `${status.color}15`,
                    border: `1px solid ${status.color}25`,
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{
                      background: status.gradient,
                      boxShadow: `0 0 6px ${status.color}`,
                    }}
                  />
                  <span className="text-xs font-medium" style={{ color: status.color }}>
                    {status.text}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-3">
                {deviceType?.name} · {deviceType?.description}
              </p>

              {/* Meta Info Row */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-gray-500" />
                  <span className="text-[11px] text-gray-400">{wincc.location}</span>
                </div>
                {wincc.ipAddress && (
                  <div className="flex items-center gap-1.5">
                    <Network size={12} className="text-gray-500" />
                    <span className="text-[11px] text-gray-400 font-mono">{wincc.ipAddress}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-gray-500" />
                  <span className="text-[11px] text-gray-400">{wincc.lastUpdate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Template & Tags */}
          <div className="flex flex-col items-end gap-2">
            {/* Template Badge */}
            {template && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">模板</span>
                <span
                  className="text-xs font-medium"
                  style={{ color: template.color }}
                >
                  {template.name}
                </span>
              </div>
            )}

            {/* Tags */}
            {wincc.tags && wincc.tags.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Tag size={10} className="text-gray-600" />
                {wincc.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-md"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      color: '#9ca3af',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
