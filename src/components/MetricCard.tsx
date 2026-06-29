'use client';

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit: string;
  trend?: number;
  status?: 'normal' | 'warning' | 'danger';
}

export default function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  trend,
  status = 'normal',
}: MetricCardProps) {
  const getStatusStyle = () => {
    switch (status) {
      case 'warning':
        return {
          gradient: 'linear-gradient(135deg, #f5a623, #f093fb)',
          color: '#f5a623',
          glow: 'rgba(245,166,35,0.5)',
        };
      case 'danger':
        return {
          gradient: 'linear-gradient(135deg, #f5515f, #9f041b)',
          color: '#f5515f',
          glow: 'rgba(245,81,95,0.5)',
        };
      default:
        return {
          gradient: 'linear-gradient(135deg, #00f5a0, #00d9f5)',
          color: '#00f5a0',
          glow: 'rgba(0,245,160,0.5)',
        };
    }
  };

  const style = getStatusStyle();
  const TrendIcon = trend !== undefined && trend >= 0 ? TrendingUp : TrendingDown;
  const trendColor = trend !== undefined && trend >= 0 ? '#00f5a0' : '#f5515f';

  return (
    <div
      className="relative rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: 'linear-gradient(145deg, rgba(18,18,24,0.95), rgba(12,12,16,0.98))',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '20px',
      }}
    >
      {/* Top accent glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${style.color}50 50%, transparent 100%)`,
        }}
      />

      {/* Background glow */}
      <div
        className="absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-10 blur-2xl"
        style={{ background: style.gradient }}
      />

      {/* Status Indicator */}
      <div
        className="absolute w-2 h-2 rounded-full"
        style={{
          top: '16px',
          right: '16px',
          background: style.gradient,
          boxShadow: `0 0 8px ${style.glow}`,
        }}
      />

      {/* Icon */}
      <div
        className="flex items-center justify-center"
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: `${style.color}15`,
          border: `1px solid ${style.color}25`,
          marginBottom: '14px',
        }}
      >
        <Icon size={18} style={{ color: style.color }} />
      </div>

      {/* Label */}
      <div
        className="flex items-center gap-2 mb-2"
      >
        <div
          className="w-0.5 h-3 rounded-full"
          style={{ background: style.gradient }}
        />
        <span
          className="uppercase text-[10px] tracking-[0.15em]"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-2xl font-light"
          style={{
            background: style.gradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {value}
        </span>
        <span className="text-xs text-gray-500">{unit}</span>
      </div>

      {/* Trend */}
      {trend !== undefined && (
        <div
          className="flex items-center gap-1.5 mt-3 px-2 py-1 rounded-lg w-fit"
          style={{
            background: `${trendColor}10`,
            border: `1px solid ${trendColor}20`,
          }}
        >
          <TrendIcon size={12} style={{ color: trendColor }} />
          <span
            className="text-[11px] font-mono"
            style={{ color: trendColor }}
          >
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}
