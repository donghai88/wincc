'use client';

import {
  Power,
  PlayCircle,
  PauseCircle,
  StopCircle,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Settings2,
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Clock,
  Thermometer,
  Zap,
  Shield,
} from 'lucide-react';
import type { SystemMetrics, SystemInfo, ProcessStage } from '@/types/template';
import ControlPanel from '@/components/ControlPanel';
import GaugeChart from '@/components/GaugeChart';
import ProcessFlow from '@/components/ProcessFlow';
import LiveChart from '@/components/LiveChart';
import CameraFeed from '@/components/CameraFeed';

interface ControlCenterProps {
  metrics: SystemMetrics;
  systems: SystemInfo[];
  processStages: ProcessStage[];
}

// Cyber Control Button - 精致小巧的控制按钮
function CyberButton({
  icon: Icon,
  label,
  gradient,
  active = false,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  gradient: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden"
    >
      {/* Glow Effect */}
      {active && (
        <div
          className="absolute inset-0 opacity-30 blur-xl"
          style={{ background: gradient }}
        />
      )}

      {/* Button Body */}
      <div
        className={`
          relative flex items-center gap-3 px-6 py-3 rounded-xl
          transition-all duration-300 backdrop-blur-sm
          ${active
            ? 'bg-white/10'
            : 'bg-black/40 hover:bg-white/5'
          }
        `}
        style={{
          border: active ? '1px solid transparent' : '1px solid rgba(255,255,255,0.1)',
          backgroundImage: active ? `linear-gradient(#0a0a0a, #0a0a0a), ${gradient}` : undefined,
          backgroundOrigin: 'border-box',
          backgroundClip: active ? 'padding-box, border-box' : undefined,
        }}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{
            background: active ? gradient : 'rgba(255,255,255,0.05)',
          }}
        >
          <Icon size={18} className={active ? 'text-white' : 'text-gray-400'} />
        </div>
        <span className={`text-sm font-medium tracking-wide ${active ? 'text-white' : 'text-gray-400'}`}>
          {label}
        </span>
      </div>
    </button>
  );
}

// Neon System Row - 霓虹系统状态行
function NeonSystemRow({
  system,
  onToggle,
}: {
  system: SystemInfo;
  onToggle?: () => void;
}) {
  const isOnline = system.status === 'online';
  const statusGradient = system.status === 'online'
    ? 'linear-gradient(135deg, #00f5a0, #00d9f5)'
    : system.status === 'warning'
    ? 'linear-gradient(135deg, #f5a623, #f093fb)'
    : 'linear-gradient(135deg, #f5515f, #9f041b)';

  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: statusGradient }}
        />
        <span className="text-sm text-gray-300">{system.name}</span>
      </div>
      <div className="flex items-center gap-4">
        {system.load !== undefined && (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${system.load}%`,
                  background: statusGradient,
                }}
              />
            </div>
            <span className="text-xs text-gray-500 font-mono w-8">{system.load}%</span>
          </div>
        )}
        <span
          className="text-xs px-2 py-1 rounded-md font-medium"
          style={{
            background: `${isOnline ? 'rgba(0,245,160,0.1)' : 'rgba(255,255,255,0.05)'}`,
            color: isOnline ? '#00f5a0' : '#666',
          }}
        >
          {isOnline ? '运行中' : '已停止'}
        </span>
      </div>
    </div>
  );
}

// Cyber Resource Bar - 赛博资源条
function CyberResourceBar({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  gradient: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={14} className="text-gray-500 flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-400">{label}</span>
          <span className="text-xs font-mono text-white">{value}%</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${value}%`,
              background: gradient,
              boxShadow: `0 0 10px ${gradient.includes('#00f5a0') ? 'rgba(0,245,160,0.5)' : gradient.includes('#60a5fa') ? 'rgba(96,165,250,0.5)' : gradient.includes('#f5a623') ? 'rgba(245,166,35,0.5)' : 'rgba(244,114,182,0.5)'}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Holographic Stat - 全息数据显示
function HoloStat({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  gradient: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <Icon size={14} style={{ color: gradient.split(',')[1]?.replace(')', '').trim() || '#fff' }} />
        </div>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <span
        className="text-base font-mono font-medium"
        style={{
          background: gradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// Cyber Toggle - 霓虹开关
function CyberToggle({
  label,
  checked = false,
  onChange,
}: {
  label: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-400">{label}</span>
      <button
        onClick={() => onChange?.(!checked)}
        className="relative w-10 h-5 rounded-full transition-all duration-300"
        style={{
          background: checked
            ? 'linear-gradient(135deg, #00f5a0, #00d9f5)'
            : 'rgba(255,255,255,0.1)',
          boxShadow: checked ? '0 0 15px rgba(0,245,160,0.4)' : 'none',
        }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-200"
          style={{ left: checked ? '1.375rem' : '0.125rem' }}
        />
      </button>
    </div>
  );
}

// Status Card - 状态卡片
function StatusCard({
  icon: Icon,
  count,
  label,
  gradient,
}: {
  icon: React.ElementType;
  count: number;
  label: string;
  gradient: string;
}) {
  return (
    <div className="flex flex-col items-center py-4 px-3 rounded-xl bg-white/[0.02] border border-white/5">
      <Icon size={20} style={{ color: gradient.split(',')[1]?.replace(')', '').trim() || '#fff' }} />
      <span
        className="text-2xl font-light font-mono mt-2"
        style={{
          background: gradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {count}
      </span>
      <span className="text-xs text-gray-500 mt-1">{label}</span>
    </div>
  );
}

export default function ControlCenter({
  metrics,
  systems,
  processStages,
}: ControlCenterProps) {
  return (
    <div className="space-y-5">
      {/* Control Buttons - 紧凑的控制按钮组 */}
      <div className="flex flex-wrap gap-3">
        <CyberButton
          icon={PlayCircle}
          label="全部启动"
          gradient="linear-gradient(135deg, #00f5a0, #00d9f5)"
          active={true}
        />
        <CyberButton
          icon={PauseCircle}
          label="暂停"
          gradient="linear-gradient(135deg, #f5a623, #f093fb)"
        />
        <CyberButton
          icon={StopCircle}
          label="紧急停止"
          gradient="linear-gradient(135deg, #f5515f, #9f041b)"
        />
        <CyberButton
          icon={RotateCcw}
          label="重置"
          gradient="linear-gradient(135deg, #667eea, #764ba2)"
        />
      </div>

      {/* Process Flow */}
      <ControlPanel title="流程控制" accentColor="#00f5a0">
        <ProcessFlow stages={processStages} />
      </ControlPanel>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-8 space-y-5">
          {/* System Controls */}
          <ControlPanel title="系统控制" accentColor="#60a5fa">
            <div className="space-y-0">
              {systems.map((system) => (
                <NeonSystemRow key={system.name} system={system} />
              ))}
            </div>
          </ControlPanel>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ControlPanel title="温度监控" accentColor="#00f5a0">
              <LiveChart
                data={metrics.temperature.data}
                label="核心温度"
                unit="°C"
                color="#00f5a0"
                height={160}
              />
            </ControlPanel>
            <ControlPanel title="压力监控" accentColor="#60a5fa">
              <LiveChart
                data={metrics.pressure.data}
                label="系统压力"
                unit="MPa"
                color="#60a5fa"
                height={160}
              />
            </ControlPanel>
          </div>

          {/* Camera Feeds */}
          <ControlPanel title="现场监控" accentColor="#f472b6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CameraFeed
                cameraId="CAM-003"
                cameraName="控制室"
                location="中控区"
                status="online"
              />
              <CameraFeed
                cameraId="CAM-004"
                cameraName="设备间"
                location="B区 地下1层"
                status="online"
              />
            </div>
          </ControlPanel>
        </div>

        {/* Right Column - Status & Controls */}
        <div className="lg:col-span-4 space-y-5">
          {/* System Status */}
          <ControlPanel title="系统状态" accentColor="#f5a623">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatusCard
                icon={CheckCircle2}
                count={4}
                label="在线"
                gradient="linear-gradient(135deg, #00f5a0, #00d9f5)"
              />
              <StatusCard
                icon={AlertTriangle}
                count={1}
                label="警告"
                gradient="linear-gradient(135deg, #f5a623, #f093fb)"
              />
            </div>
            <div className="space-y-3">
              <CyberResourceBar
                icon={Cpu}
                label="CPU 使用率"
                value={67}
                gradient="linear-gradient(90deg, #00f5a0, #00d9f5)"
              />
              <CyberResourceBar
                icon={HardDrive}
                label="内存占用"
                value={54}
                gradient="linear-gradient(90deg, #60a5fa, #a78bfa)"
              />
              <CyberResourceBar
                icon={Wifi}
                label="网络负载"
                value={23}
                gradient="linear-gradient(90deg, #f5a623, #f093fb)"
              />
              <CyberResourceBar
                icon={Thermometer}
                label="系统温度"
                value={45}
                gradient="linear-gradient(90deg, #f472b6, #ec4899)"
              />
            </div>
          </ControlPanel>

          {/* Quick Controls */}
          <ControlPanel title="快捷控制" accentColor="#f472b6">
            <div className="space-y-1">
              <CyberToggle label="自动模式" checked={true} />
              <CyberToggle label="安全锁定" checked={true} />
              <CyberToggle label="远程控制" checked={false} />
              <CyberToggle label="日志记录" checked={true} />
            </div>
          </ControlPanel>

          {/* Runtime Stats */}
          <ControlPanel title="运行统计" accentColor="#00f5a0">
            <div className="space-y-0">
              <HoloStat
                icon={Clock}
                label="运行时间"
                value="127:45:32"
                gradient="linear-gradient(135deg, #00f5a0, #00d9f5)"
              />
              <HoloStat
                icon={Activity}
                label="处理任务"
                value="2,847"
                gradient="linear-gradient(135deg, #60a5fa, #a78bfa)"
              />
              <HoloStat
                icon={CheckCircle2}
                label="成功率"
                value="99.7%"
                gradient="linear-gradient(135deg, #f5a623, #f093fb)"
              />
            </div>
          </ControlPanel>
        </div>
      </div>

      {/* Live Gauges */}
      <ControlPanel title="实时监测" accentColor="#f472b6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4">
          <GaugeChart
            value={metrics.temperature.current}
            max={100}
            label="温度"
            unit="°C"
            status={metrics.temperature.current > 80 ? 'warning' : 'normal'}
          />
          <GaugeChart
            value={metrics.pressure.current}
            max={2}
            label="压力"
            unit="MPa"
          />
          <GaugeChart
            value={metrics.flowRate.current}
            max={600}
            label="流量"
            unit="L/min"
          />
          <GaugeChart
            value={metrics.power.current}
            max={100}
            label="功率"
            unit="kW"
          />
        </div>
      </ControlPanel>

      {/* Bottom Quick Actions */}
      <div className="flex flex-wrap gap-3">
        {[
          { icon: Power, label: '电源管理', gradient: 'linear-gradient(135deg, #667eea, #764ba2)' },
          { icon: Settings2, label: '系统配置', gradient: 'linear-gradient(135deg, #00f5a0, #00d9f5)' },
          { icon: Shield, label: '安全覆盖', gradient: 'linear-gradient(135deg, #f5a623, #f093fb)' },
          { icon: RotateCcw, label: '系统重置', gradient: 'linear-gradient(135deg, #f472b6, #ec4899)' },
        ].map((action) => (
          <button
            key={action.label}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition-colors"
          >
            <action.icon size={16} className="text-gray-500" />
            <span className="text-sm text-gray-400">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
