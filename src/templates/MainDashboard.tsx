'use client';

import {
  Gauge,
  Thermometer,
  Zap,
  Droplets,
} from 'lucide-react';
import type { SystemMetrics, SystemInfo, AlertInfo, ProcessStage } from '@/types/template';
import GaugeChart from '@/components/GaugeChart';
import LiveChart from '@/components/LiveChart';
import MetricCard from '@/components/MetricCard';
import ControlPanel from '@/components/ControlPanel';
import ToggleSwitch from '@/components/ToggleSwitch';
import ProgressRing from '@/components/ProgressRing';
import SystemStatus from '@/components/SystemStatus';
import AlertList from '@/components/AlertList';
import SliderControl from '@/components/SliderControl';
import ProcessFlow from '@/components/ProcessFlow';
import CameraFeed from '@/components/CameraFeed';

interface MainDashboardProps {
  metrics: SystemMetrics;
  systems: SystemInfo[];
  alerts: AlertInfo[];
  processStages: ProcessStage[];
}

export default function MainDashboard({
  metrics,
  systems,
  alerts,
  processStages,
}: MainDashboardProps) {
  return (
    <div className="space-y-8">
      {/* Top Row - Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={Thermometer}
          label="温度"
          value={metrics.temperature.current.toFixed(1)}
          unit="°C"
          trend={2.3}
          status={metrics.temperature.current > 80 ? 'warning' : 'normal'}
        />
        <MetricCard
          icon={Gauge}
          label="压力"
          value={metrics.pressure.current.toFixed(2)}
          unit="MPa"
          trend={-0.8}
        />
        <MetricCard
          icon={Droplets}
          label="流量"
          value={metrics.flowRate.current.toFixed(0)}
          unit="L/min"
          trend={1.2}
        />
        <MetricCard
          icon={Zap}
          label="功率"
          value={metrics.power.current.toFixed(1)}
          unit="kW"
          trend={-1.5}
        />
      </div>

      {/* Main Content - Left/Right Split */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        {/* Left Column - Camera Monitoring (70%) */}
        <div className="lg:col-span-7 space-y-8">
          {/* Main Camera Grid */}
          <ControlPanel title="实时监控" accentColor="#00d4aa">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Main Camera - Large */}
              <div className="md:col-span-2">
                <CameraFeed
                  cameraId="CAM-001"
                  cameraName="主控室"
                  location="A区 1层"
                  status="online"
                  size="large"
                />
              </div>
              {/* Secondary Cameras */}
              <CameraFeed
                cameraId="CAM-002"
                cameraName="生产车间"
                location="B区 2层"
                status="online"
              />
              <CameraFeed
                cameraId="CAM-003"
                cameraName="设备间"
                location="B区 地下1层"
                status="online"
              />
            </div>
          </ControlPanel>

          {/* Process Flow */}
          <ControlPanel title="生产流水线" accentColor="#60a5fa">
            <ProcessFlow stages={processStages} />
          </ControlPanel>
        </div>

        {/* Right Column - Status & Controls (30%) */}
        <div className="lg:col-span-3 space-y-8">
          {/* System Status */}
          <ControlPanel title="系统状态" accentColor="#00d4aa">
            <SystemStatus systems={systems} />
          </ControlPanel>

          {/* Efficiency Rings */}
          <ControlPanel title="运行性能" accentColor="#60a5fa">
            <div className="flex justify-around py-6">
              <ProgressRing
                value={metrics.efficiency}
                max={100}
                label="效率"
                color="#00d4aa"
                size={100}
              />
              <ProgressRing
                value={metrics.uptime}
                max={100}
                label="在线率"
                color="#60a5fa"
                size={100}
              />
            </div>
          </ControlPanel>

          {/* Quick Controls */}
          <ControlPanel title="快捷控制" accentColor="#fbbf24">
            <div className="space-y-3">
              <ToggleSwitch label="自动模式" defaultChecked={true} />
              <ToggleSwitch label="安全锁定" defaultChecked={true} />
              <ToggleSwitch label="告警通知" defaultChecked={true} />
            </div>
          </ControlPanel>

          {/* Alerts */}
          <ControlPanel title="最近告警" accentColor="#f87171">
            <AlertList alerts={alerts} />
          </ControlPanel>
        </div>
      </div>

      {/* Bottom Row - Charts & Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Live Charts */}
        <ControlPanel title="温度趋势" accentColor="#00d4aa">
          <LiveChart
            data={metrics.temperature.data}
            label="核心温度"
            unit="°C"
            color="#00d4aa"
            height={140}
          />
        </ControlPanel>

        <ControlPanel title="压力趋势" accentColor="#60a5fa">
          <LiveChart
            data={metrics.pressure.data}
            label="系统压力"
            unit="MPa"
            color="#60a5fa"
            height={140}
          />
        </ControlPanel>
      </div>

      {/* Footer Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: '累计运行', value: '2,847 小时' },
          { label: '节能总量', value: '12.4 MWh' },
          { label: '效率提升', value: '+8.2%' },
          { label: '下次维护', value: '14 天后' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="text-center py-6 rounded-3xl bg-[#0d0d0d] border border-white/10"
          >
            <div className="text-2xl text-white mb-2 font-mono">{stat.value}</div>
            <div className="text-sm text-gray-500 uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
