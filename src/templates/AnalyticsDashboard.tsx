'use client';

import {
  Thermometer,
  Gauge,
  Droplets,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { SystemMetrics, SystemInfo, AlertInfo } from '@/types/template';
import ControlPanel from '@/components/ControlPanel';
import LiveChart from '@/components/LiveChart';

interface AnalyticsDashboardProps {
  metrics: SystemMetrics;
  systems: SystemInfo[];
  alerts: AlertInfo[];
}

// Cyber KPI Card - 赛博数据卡片
function CyberKPICard({
  icon: Icon,
  label,
  value,
  unit,
  trend,
  gradient,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit: string;
  trend?: number;
  gradient: string;
  color: string;
}) {
  const TrendIcon = trend === undefined ? null : trend >= 0 ? TrendingUp : TrendingDown;
  const trendColor = trend === undefined ? '#6b7280' : trend >= 0 ? '#00f5a0' : '#f5515f';

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
          background: `linear-gradient(90deg, transparent 0%, ${color}50 50%, transparent 100%)`,
        }}
      />

      {/* Background Glow */}
      <div
        className="absolute -top-10 -right-10 w-28 h-28 opacity-15 rounded-full blur-2xl"
        style={{ background: gradient }}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: `${color}15`,
              border: `1px solid ${color}25`,
            }}
          >
            <Icon size={18} style={{ color }} />
          </div>
          {trend !== undefined && TrendIcon && (
            <div
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
              style={{
                color: trendColor,
                background: `${trendColor}10`,
                border: `1px solid ${trendColor}20`,
              }}
            >
              <TrendIcon size={12} />
              <span className="font-mono">{Math.abs(trend).toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* Label with accent */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-0.5 h-3 rounded-full"
            style={{ background: gradient }}
          />
          <span className="text-[10px] text-gray-500 tracking-wide uppercase">{label}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className="text-3xl font-light font-mono"
            style={{
              background: gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {value}
          </span>
          <span className="text-sm text-gray-500">{unit}</span>
        </div>
      </div>
    </div>
  );
}

// Neon Stat Row - 霓虹统计行
function NeonStatRow({
  label,
  value,
  percentage,
  gradient,
  color,
}: {
  label: string;
  value: string;
  percentage: number;
  gradient: string;
  color: string;
}) {
  return (
    <div className="py-3 border-b border-white/5 last:border-0 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: gradient,
              boxShadow: `0 0 6px ${color}`,
            }}
          />
          <span className="text-xs text-gray-400">{label}</span>
        </div>
        <span
          className="text-xs font-mono px-2 py-0.5 rounded-md"
          style={{
            color,
            background: `${color}10`,
            border: `1px solid ${color}20`,
          }}
        >
          {value}
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${percentage}%`,
            background: gradient,
            boxShadow: `0 0 8px ${color}50`,
          }}
        />
      </div>
    </div>
  );
}

export default function AnalyticsDashboard({
  metrics,
  systems,
  alerts,
}: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CyberKPICard
          icon={Thermometer}
          label="平均温度"
          value={metrics.temperature.current.toFixed(1)}
          unit="°C"
          trend={2.3}
          gradient="linear-gradient(135deg, #00f5a0, #00d9f5)"
          color="#00f5a0"
        />
        <CyberKPICard
          icon={Gauge}
          label="平均压力"
          value={metrics.pressure.current.toFixed(2)}
          unit="MPa"
          trend={-0.8}
          gradient="linear-gradient(135deg, #60a5fa, #a78bfa)"
          color="#60a5fa"
        />
        <CyberKPICard
          icon={Droplets}
          label="总流量"
          value={(metrics.flowRate.current * 60).toFixed(0)}
          unit="L/hr"
          trend={5.2}
          gradient="linear-gradient(135deg, #f5a623, #f093fb)"
          color="#f5a623"
        />
        <CyberKPICard
          icon={Zap}
          label="功耗"
          value={metrics.power.current.toFixed(1)}
          unit="kW"
          trend={-3.1}
          gradient="linear-gradient(135deg, #f472b6, #ec4899)"
          color="#f472b6"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ControlPanel title="温度分析" accentColor="#00f5a0">
          <LiveChart
            data={metrics.temperature.data}
            label="温度趋势"
            unit="°C"
            color="#00f5a0"
            height={180}
          />
        </ControlPanel>

        <ControlPanel title="压力分析" accentColor="#60a5fa">
          <LiveChart
            data={metrics.pressure.data}
            label="压力趋势"
            unit="MPa"
            color="#60a5fa"
            height={180}
          />
        </ControlPanel>

        <ControlPanel title="流量分析" accentColor="#f5a623">
          <LiveChart
            data={metrics.flowRate.data}
            label="流量趋势"
            unit="L/min"
            color="#f5a623"
            height={180}
          />
        </ControlPanel>

        <ControlPanel title="功耗分析" accentColor="#f472b6">
          <LiveChart
            data={metrics.power.data}
            label="功率趋势"
            unit="kW"
            color="#f472b6"
            height={180}
          />
        </ControlPanel>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* System Health */}
        <ControlPanel title="系统健康" accentColor="#00f5a0">
          <NeonStatRow
            label="主反应堆"
            value="98.5%"
            percentage={98.5}
            gradient="linear-gradient(90deg, #00f5a0, #00d9f5)"
            color="#00f5a0"
          />
          <NeonStatRow
            label="冷却系统"
            value="94.2%"
            percentage={94.2}
            gradient="linear-gradient(90deg, #60a5fa, #a78bfa)"
            color="#60a5fa"
          />
          <NeonStatRow
            label="电力网格"
            value="99.1%"
            percentage={99.1}
            gradient="linear-gradient(90deg, #f5a623, #f093fb)"
            color="#f5a623"
          />
          <NeonStatRow
            label="安全系统"
            value="100%"
            percentage={100}
            gradient="linear-gradient(90deg, #00f5a0, #00d9f5)"
            color="#00f5a0"
          />
        </ControlPanel>

        {/* Performance Metrics */}
        <ControlPanel title="性能指标" accentColor="#60a5fa">
          <NeonStatRow
            label="运行效率"
            value={`${metrics.efficiency.toFixed(1)}%`}
            percentage={metrics.efficiency}
            gradient="linear-gradient(90deg, #00f5a0, #00d9f5)"
            color="#00f5a0"
          />
          <NeonStatRow
            label="在线率"
            value={`${metrics.uptime.toFixed(1)}%`}
            percentage={metrics.uptime}
            gradient="linear-gradient(90deg, #60a5fa, #a78bfa)"
            color="#60a5fa"
          />
          <NeonStatRow
            label="产能利用率"
            value="87.3%"
            percentage={87.3}
            gradient="linear-gradient(90deg, #f5a623, #f093fb)"
            color="#f5a623"
          />
          <NeonStatRow
            label="响应时间"
            value="12ms"
            percentage={88}
            gradient="linear-gradient(90deg, #f472b6, #ec4899)"
            color="#f472b6"
          />
        </ControlPanel>

        {/* Recent Activity */}
        <ControlPanel title="最近活动" accentColor="#f5a623">
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={alert.id}
                className="relative flex items-center gap-3 p-3 rounded-xl overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                {/* Left accent */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-0.5"
                  style={{
                    background: index === 0
                      ? 'linear-gradient(180deg, #f5a623, #f093fb)'
                      : 'linear-gradient(180deg, #60a5fa, #a78bfa)',
                  }}
                />
                <Activity
                  size={14}
                  className="text-gray-500 flex-shrink-0 ml-2"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 truncate">{alert.message}</p>
                  <p className="text-[10px] text-gray-600 mt-1 font-mono">{alert.time}</p>
                </div>
                {index === 0 && (
                  <div
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{
                      background: 'linear-gradient(135deg, #f5a623, #f093fb)',
                      boxShadow: '0 0 6px #f5a623',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </ControlPanel>
      </div>
    </div>
  );
}
