'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { WinCCInstance, MetricValue, DeviceType } from '@/types/template';
import {
  getAlarms,
  getIronLevelMetrics,
  getIronLevelAlarms,
  getDeviceTypeConfig,
  getIronLevelTrend,
  getIronLevelHistoryTrend,
} from '@/data/wincc-config';
import DeviceSelector from '@/components/DeviceSelector';
import SystemOverview from '@/components/SystemOverview';
import {
  Thermometer,
  Weight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Video,
  TrendingUp,
  TrendingDown,
  Waves,
  Activity,
  CircleDot,
  Clock,
  History,
} from 'lucide-react';

const HotMetalTroughTwin = dynamic(() => import('@/components/digital-twin/HotMetalTroughTwin'), { ssr: false });
const HotMetalTroughSimTwin = dynamic(() => import('@/components/digital-twin/HotMetalTroughSimTwin'), { ssr: false });
const LadleRecognitionMonitor = dynamic(() => import('@/components/LadleRecognitionMonitor'), { ssr: false });

// 判断指标状态
function getMetricStatus(metric: MetricValue): 'normal' | 'warning' | 'critical' {
  const { current, min, max, warningLow, warningHigh } = metric;

  if ((max !== undefined && current > max) || (min !== undefined && current < min)) {
    return 'critical';
  }
  if ((warningHigh !== undefined && current > warningHigh) || (warningLow !== undefined && current < warningLow)) {
    return 'warning';
  }
  return 'normal';
}

const statusColors = {
  normal: 'var(--status-online)',
  warning: 'var(--status-warning)',
  critical: 'var(--status-error)',
};

function renderMetricCard(
  label: string,
  metric: MetricValue,
  icon: React.ReactNode,
  showThreshold?: boolean
) {
  const status = getMetricStatus(metric);
  const isAbnormal = status !== 'normal';

  return (
    <div
      style={{
        background: isAbnormal
          ? `linear-gradient(135deg, ${statusColors[status]}08, ${statusColors[status]}03)`
          : 'var(--surface)',
        borderRadius: 12,
        padding: '16px 20px',
        border: `1px solid ${isAbnormal ? statusColors[status] + '40' : 'var(--border)'}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isAbnormal && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColors[status],
            animation: status === 'critical' ? 'pulse 1s infinite' : 'pulse 2s infinite',
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ color: isAbnormal ? statusColors[status] : 'var(--text-tertiary)' }}>
          {icon}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: 32,
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
            color: isAbnormal ? statusColors[status] : 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          {metric.current}
        </span>
        <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
          {metric.unit}
        </span>
        {metric.trend !== undefined && metric.trend !== 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              marginLeft: 8,
              color: metric.trend > 0 ? 'var(--status-error)' : 'var(--status-online)',
            }}
          >
            {metric.trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              {metric.trend > 0 ? '+' : ''}{metric.trend}%
            </span>
          </div>
        )}
      </div>

      {showThreshold && (metric.warningHigh || metric.max) && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              height: 4,
              background: 'var(--border)',
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {metric.max && (
              <div
                style={{
                  position: 'absolute',
                  left: `${Math.min((metric.current / metric.max) * 100, 100)}%`,
                  top: -2,
                  width: 2,
                  height: 8,
                  background: isAbnormal ? statusColors[status] : 'var(--accent)',
                  transform: 'translateX(-50%)',
                }}
              />
            )}
            {metric.warningHigh && metric.max && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(metric.warningHigh / metric.max) * 100}%`,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  background: 'var(--status-warning)',
                  opacity: 0.3,
                }}
              />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {metric.min ?? 0}
            </span>
            {metric.warningHigh && (
              <span style={{ fontSize: 10, color: 'var(--status-warning)' }}>
                预警: {metric.warningHigh}
              </span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {metric.max}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export interface DeviceMonitorPanelProps {
  selectedWinCC: WinCCInstance;
  selectedDeviceType: DeviceType;
  onSelectWinCC: (w: WinCCInstance) => void;
  onBack: () => void;
}

export default function DeviceMonitorPanel({
  selectedWinCC,
  selectedDeviceType,
  onSelectWinCC,
  onBack,
}: DeviceMonitorPanelProps) {
  const [historyHoursAgo, setHistoryHoursAgo] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isLadleType = selectedWinCC.deviceType === 'ladle';
  const trendData = useMemo(() => {
    if (!isLadleType) return null;
    return getIronLevelTrend(selectedWinCC.id);
  }, [isLadleType, selectedWinCC, currentTime]);

  const historyTrendData = useMemo(() => {
    if (!isLadleType || historyHoursAgo === null) return null;
    return getIronLevelHistoryTrend(selectedWinCC.id, historyHoursAgo);
  }, [isLadleType, selectedWinCC, historyHoursAgo]);

  const isHotMetalTrough = selectedDeviceType === 'hot-metal-trough';
  const isHotMetalTroughSim = selectedDeviceType === 'hot-metal-trough-sim';
  const isLadleRecognition = selectedDeviceType === 'ladle-recognition';
  const isIronLevel = selectedWinCC.deviceType === 'ladle';
  const ironLevelData = isIronLevel ? getIronLevelMetrics(selectedWinCC.id) : null;
  const alarms = isIronLevel ? getIronLevelAlarms(selectedWinCC.id) : getAlarms(selectedWinCC.id);
  const deviceConfig = getDeviceTypeConfig(selectedWinCC.deviceType);

  const pulseKeyframes = (
    <style jsx global>{`@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}`}</style>
  );

  if (isHotMetalTrough) {
    return (
      <>
        {pulseKeyframes}
        <HotMetalTroughTwin wincc={selectedWinCC} onBack={onBack} />
      </>
    );
  }

  // 铁水沟：视觉仿真数字孪生
  if (isHotMetalTroughSim) {
    return (
      <>
        {pulseKeyframes}
        <HotMetalTroughSimTwin wincc={selectedWinCC} onBack={onBack} />
      </>
    );
  }

  if (isLadleRecognition) {
    return (
      <>
        {pulseKeyframes}
        <LadleRecognitionMonitor wincc={selectedWinCC} onBack={onBack} />
      </>
    );
  }

  return (
    <>
      {pulseKeyframes}
      {/* 系统概览 - 始终显示 */}
      <SystemOverview />

        {/* 设备选择器 - 只显示当前类型的设备 */}
        <div style={{ marginBottom: 16 }}>
          <DeviceSelector
            deviceType={selectedDeviceType}
            selectedWinCC={selectedWinCC}
            onSelectWinCC={onSelectWinCC}
            onBack={onBack}
          />
        </div>

        {isIronLevel && ironLevelData ? (
          <>
            {/* 铁水液位检测系统 - 双出铁口监控 */}
            {/* 第一行：双摄像头画面 左右排列 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                marginBottom: 16,
              }}
            >
              {/* 出铁口1 视频 */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  aspectRatio: '16/9',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 6,
                    zIndex: 1,
                  }}
                >
                  <Video size={14} color="#06b6d4" />
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>出铁口1</span>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--status-error)',
                      animation: 'pulse 1.5s infinite',
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    padding: '4px 8px',
                    background: ironLevelData.tap1.levelStatus === 'normal'
                      ? 'rgba(52, 199, 89, 0.2)'
                      : ironLevelData.tap1.levelStatus === 'alarm'
                      ? 'rgba(255, 69, 58, 0.2)'
                      : 'rgba(255, 214, 10, 0.2)',
                    border: `1px solid ${ironLevelData.tap1.levelStatus === 'normal'
                      ? 'rgba(52, 199, 89, 0.4)'
                      : ironLevelData.tap1.levelStatus === 'alarm'
                      ? 'rgba(255, 69, 58, 0.4)'
                      : 'rgba(255, 214, 10, 0.4)'}`,
                    borderRadius: 4,
                    fontSize: 10,
                    color: ironLevelData.tap1.levelStatus === 'normal'
                      ? 'var(--status-online)'
                      : ironLevelData.tap1.levelStatus === 'alarm'
                      ? 'var(--status-error)'
                      : 'var(--status-warning)',
                    fontWeight: 500,
                    zIndex: 1,
                  }}
                >
                  {ironLevelData.tap1.levelStatus === 'normal' ? '正常' : ironLevelData.tap1.levelStatus === 'high' ? '偏高' : ironLevelData.tap1.levelStatus === 'low' ? '偏低' : '报警'}
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(180deg, #0d1b2a 0%, #0a0a0f 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                  }}
                >
                  <Video size={40} color="var(--text-muted)" strokeWidth={1} />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    红外热像仪 Camera1
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {selectedWinCC.ipAddress}:8080/tap1
                  </span>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: 12,
                    padding: '4px 8px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#06b6d4',
                  }}
                >
                  液位: {ironLevelData.tap1.levelHeight.current} mm
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    padding: '4px 8px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#fff',
                  }}
                >
                  {currentTime.toLocaleString('zh-CN', { hour12: false })}
                </div>
              </div>

              {/* 出铁口2 视频 */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  aspectRatio: '16/9',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 6,
                    zIndex: 1,
                  }}
                >
                  <Video size={14} color="#06b6d4" />
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>出铁口2</span>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--status-error)',
                      animation: 'pulse 1.5s infinite',
                    }}
                  />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    padding: '4px 8px',
                    background: ironLevelData.tap2.levelStatus === 'normal'
                      ? 'rgba(52, 199, 89, 0.2)'
                      : ironLevelData.tap2.levelStatus === 'alarm'
                      ? 'rgba(255, 69, 58, 0.2)'
                      : 'rgba(255, 214, 10, 0.2)',
                    border: `1px solid ${ironLevelData.tap2.levelStatus === 'normal'
                      ? 'rgba(52, 199, 89, 0.4)'
                      : ironLevelData.tap2.levelStatus === 'alarm'
                      ? 'rgba(255, 69, 58, 0.4)'
                      : 'rgba(255, 214, 10, 0.4)'}`,
                    borderRadius: 4,
                    fontSize: 10,
                    color: ironLevelData.tap2.levelStatus === 'normal'
                      ? 'var(--status-online)'
                      : ironLevelData.tap2.levelStatus === 'alarm'
                      ? 'var(--status-error)'
                      : 'var(--status-warning)',
                    fontWeight: 500,
                    zIndex: 1,
                  }}
                >
                  {ironLevelData.tap2.levelStatus === 'normal' ? '正常' : ironLevelData.tap2.levelStatus === 'high' ? '偏高' : ironLevelData.tap2.levelStatus === 'low' ? '偏低' : '报警'}
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(180deg, #0d1b2a 0%, #0a0a0f 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                  }}
                >
                  <Video size={40} color="var(--text-muted)" strokeWidth={1} />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    红外热像仪 Camera2
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {selectedWinCC.ipAddress}:8080/tap2
                  </span>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: 12,
                    padding: '4px 8px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#06b6d4',
                  }}
                >
                  液位: {ironLevelData.tap2.levelHeight.current} mm
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    padding: '4px 8px',
                    background: 'rgba(0,0,0,0.7)',
                    borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#fff',
                  }}
                >
                  {currentTime.toLocaleString('zh-CN', { hour12: false })}
                </div>
              </div>
            </div>

            {/* 第二行：双出铁口核心参数 左右对称布局 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                marginBottom: 16,
              }}
            >
              {/* 出铁口1 参数 */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <CircleDot size={14} color="#06b6d4" />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>出铁口1 检测参数</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>铁包: {ironLevelData.tap1.ladleId}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {renderMetricCard('液位高度', ironLevelData.tap1.levelHeight, <Waves size={16} />, true)}
                  {renderMetricCard('铁水温度', ironLevelData.tap1.tempSurface, <Thermometer size={16} />, true)}
                  {renderMetricCard('铁水重量', ironLevelData.tap1.weightCalculated, <Weight size={16} />, true)}
                  {renderMetricCard('结壳面积', ironLevelData.tap1.crustingArea, <Activity size={16} />, true)}
                </div>
              </div>

              {/* 出铁口2 参数 */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <CircleDot size={14} color="#06b6d4" />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>出铁口2 检测参数</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>铁包: {ironLevelData.tap2.ladleId}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {renderMetricCard('液位高度', ironLevelData.tap2.levelHeight, <Waves size={16} />, true)}
                  {renderMetricCard('铁水温度', ironLevelData.tap2.tempSurface, <Thermometer size={16} />, true)}
                  {renderMetricCard('铁水重量', ironLevelData.tap2.weightCalculated, <Weight size={16} />, true)}
                  {renderMetricCard('结壳面积', ironLevelData.tap2.crustingArea, <Activity size={16} />, true)}
                </div>
              </div>
            </div>

            {/* 第三行：报警阈值 + 告警列表 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* 报警阈值与状态 */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  报警阈值设置
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>液位上限阈值</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--status-error)' }}>
                        {ironLevelData.tap1.levelThresholdHigh}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>mm</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                        ({Math.round((ironLevelData.tap1.levelThresholdHigh / 800) * 100)}%)
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>液位下限阈值</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--status-warning)' }}>
                        {ironLevelData.tap1.levelThresholdLow}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>mm</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                        ({Math.round((ironLevelData.tap1.levelThresholdLow / 800) * 100)}%)
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>最近报警时间</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} color="var(--text-tertiary)" />
                      <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {ironLevelData.tap1.alarmTime || '无'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>工作模式</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-online)' }} />
                      <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>1对2 双出铁口</span>
                    </div>
                  </div>
                </div>
                {/* 液位范围可视化 */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>液位范围示意</div>
                  <div style={{ position: 'relative', height: 32, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                    {/* 安全区域 */}
                    <div style={{
                      position: 'absolute',
                      left: `${(ironLevelData.tap1.levelThresholdLow / 800) * 100}%`,
                      right: `${100 - (ironLevelData.tap1.levelThresholdHigh / 800) * 100}%`,
                      top: 0,
                      bottom: 0,
                      background: 'rgba(52, 199, 89, 0.15)',
                      borderLeft: '2px solid var(--status-warning)',
                      borderRight: '2px solid var(--status-error)',
                    }} />
                    {/* 出铁口1 当前位置 */}
                    <div style={{
                      position: 'absolute',
                      left: `${(ironLevelData.tap1.levelHeight.current / 800) * 100}%`,
                      top: 2,
                      bottom: 2,
                      width: 3,
                      background: '#06b6d4',
                      borderRadius: 2,
                      transform: 'translateX(-50%)',
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: -16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: 9,
                        color: '#06b6d4',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        1#
                      </div>
                    </div>
                    {/* 出铁口2 当前位置 */}
                    <div style={{
                      position: 'absolute',
                      left: `${(ironLevelData.tap2.levelHeight.current / 800) * 100}%`,
                      top: 2,
                      bottom: 2,
                      width: 3,
                      background: '#a78bfa',
                      borderRadius: 2,
                      transform: 'translateX(-50%)',
                    }}>
                      <div style={{
                        position: 'absolute',
                        bottom: -16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: 9,
                        color: '#a78bfa',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        2#
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>0</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>800 mm</span>
                  </div>
                </div>
              </div>

              {/* 告警列表 */}
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>告警信息</span>
                  {alarms.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                      共 {alarms.length} 条
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                  {alarms.length === 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '32px 0',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <CheckCircle2 size={32} strokeWidth={1} />
                      <span style={{ fontSize: 13, marginTop: 8 }}>暂无告警</span>
                    </div>
                  ) : (
                    alarms.map((alarm) => (
                      <div
                        key={alarm.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: '12px',
                          background:
                            alarm.level === 'critical'
                              ? 'rgba(255, 69, 58, 0.08)'
                              : alarm.level === 'warning'
                              ? 'rgba(255, 214, 10, 0.08)'
                              : 'rgba(255,255,255,0.02)',
                          borderRadius: 8,
                          border: `1px solid ${
                            alarm.level === 'critical'
                              ? 'rgba(255, 69, 58, 0.2)'
                              : alarm.level === 'warning'
                              ? 'rgba(255, 214, 10, 0.2)'
                              : 'var(--border)'
                          }`,
                          opacity: alarm.acknowledged ? 0.5 : 1,
                        }}
                      >
                        <div style={{ flexShrink: 0, marginTop: 2 }}>
                          {alarm.level === 'critical' ? (
                            <XCircle size={16} color="var(--status-error)" />
                          ) : alarm.level === 'warning' ? (
                            <AlertTriangle size={16} color="var(--status-warning)" />
                          ) : (
                            <CheckCircle2 size={16} color="var(--text-tertiary)" />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
                            {alarm.message}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 12 }}>
                            {alarm.value !== undefined && alarm.threshold !== undefined && (
                              <span>
                                当前:{' '}
                                <span style={{ color: alarm.level === 'critical' ? 'var(--status-error)' : 'var(--status-warning)' }}>
                                  {alarm.value}
                                </span>{' '}
                                / 阈值: {alarm.threshold}
                              </span>
                            )}
                            <span>{alarm.time}</span>
                          </div>
                        </div>
                        {alarm.acknowledged && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              background: 'var(--border)',
                              borderRadius: 4,
                              color: 'var(--text-muted)',
                            }}
                          >
                            已确认
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 第四行：液位趋势曲线 + 历史对比 */}
            {trendData && (
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 12,
                  padding: 20,
                  border: '1px solid var(--border)',
                  marginTop: 16,
                }}
              >
                {/* 标题栏 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={14} color="#06b6d4" />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>液位趋势曲线</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>（最近30分钟）</span>
                  </div>
                  {/* 历史对比按钮组 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <History size={13} color="var(--text-muted)" />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>对比:</span>
                    {[1, 2, 4, 8].map((h) => (
                      <button
                        key={h}
                        onClick={() => setHistoryHoursAgo(historyHoursAgo === h ? null : h)}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: `1px solid ${historyHoursAgo === h ? '#06b6d4' : 'var(--border)'}`,
                          background: historyHoursAgo === h ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                          color: historyHoursAgo === h ? '#06b6d4' : 'var(--text-muted)',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        {h}h前
                      </button>
                    ))}
                  </div>
                </div>

                {/* 双出铁口趋势图 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* 出铁口1趋势 */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 3, borderRadius: 2, background: '#06b6d4' }} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>出铁口1 实时</span>
                      {historyTrendData && (
                        <>
                          <div style={{ width: 10, height: 3, borderRadius: 2, background: '#06b6d4', opacity: 0.35 }} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{historyHoursAgo}h前</span>
                        </>
                      )}
                    </div>
                    <svg viewBox="0 0 500 160" style={{ width: '100%', height: 160, display: 'block' }}>
                      {/* 背景网格 */}
                      {[0, 1, 2, 3, 4].map((i) => (
                        <line key={`g1-${i}`} x1={40} y1={20 + i * 30} x2={490} y2={20 + i * 30} stroke="var(--border)" strokeWidth={0.5} />
                      ))}
                      {/* Y轴标签 */}
                      {[800, 600, 400, 200, 0].map((v, i) => (
                        <text key={`y1-${i}`} x={35} y={24 + i * 30} textAnchor="end" fill="var(--text-muted)" fontSize={9} fontFamily="var(--font-mono)">{v}</text>
                      ))}
                      {/* 阈值线 */}
                      <line x1={40} y1={20 + ((800 - ironLevelData!.tap1.levelThresholdHigh) / 800) * 120} x2={490} y2={20 + ((800 - ironLevelData!.tap1.levelThresholdHigh) / 800) * 120} stroke="var(--status-error)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
                      <line x1={40} y1={20 + ((800 - ironLevelData!.tap1.levelThresholdLow) / 800) * 120} x2={490} y2={20 + ((800 - ironLevelData!.tap1.levelThresholdLow) / 800) * 120} stroke="var(--status-warning)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
                      {/* 历史对比曲线 */}
                      {historyTrendData && (
                        <polyline
                          fill="none"
                          stroke="#06b6d4"
                          strokeWidth={1.5}
                          opacity={0.3}
                          points={historyTrendData.tap1.map((p, i) => `${40 + (i / (historyTrendData.tap1.length - 1)) * 450},${20 + ((800 - p.value) / 800) * 120}`).join(' ')}
                        />
                      )}
                      {/* 实时曲线 */}
                      <polyline
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        points={trendData.tap1.map((p, i) => `${40 + (i / (trendData.tap1.length - 1)) * 450},${20 + ((800 - p.value) / 800) * 120}`).join(' ')}
                      />
                      {/* 当前值标记 */}
                      <circle cx={490} cy={20 + ((800 - trendData.tap1[trendData.tap1.length - 1].value) / 800) * 120} r={4} fill="#06b6d4" />
                      <text x={490} y={14 + ((800 - trendData.tap1[trendData.tap1.length - 1].value) / 800) * 120} textAnchor="end" fill="#06b6d4" fontSize={10} fontFamily="var(--font-mono)">{trendData.tap1[trendData.tap1.length - 1].value}mm</text>
                      {/* X轴时间标签 */}
                      {[0, 15, 30, 45, 59].map((idx) => (
                        <text key={`x1-${idx}`} x={40 + (idx / 59) * 450} y={155} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontFamily="var(--font-mono)">
                          {trendData.tap1[idx]?.time.slice(0, 5) || ''}
                        </text>
                      ))}
                    </svg>
                  </div>

                  {/* 出铁口2趋势 */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 3, borderRadius: 2, background: '#a78bfa' }} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>出铁口2 实时</span>
                      {historyTrendData && (
                        <>
                          <div style={{ width: 10, height: 3, borderRadius: 2, background: '#a78bfa', opacity: 0.35 }} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{historyHoursAgo}h前</span>
                        </>
                      )}
                    </div>
                    <svg viewBox="0 0 500 160" style={{ width: '100%', height: 160, display: 'block' }}>
                      {/* 背景网格 */}
                      {[0, 1, 2, 3, 4].map((i) => (
                        <line key={`g2-${i}`} x1={40} y1={20 + i * 30} x2={490} y2={20 + i * 30} stroke="var(--border)" strokeWidth={0.5} />
                      ))}
                      {/* Y轴标签 */}
                      {[800, 600, 400, 200, 0].map((v, i) => (
                        <text key={`y2-${i}`} x={35} y={24 + i * 30} textAnchor="end" fill="var(--text-muted)" fontSize={9} fontFamily="var(--font-mono)">{v}</text>
                      ))}
                      {/* 阈值线 */}
                      <line x1={40} y1={20 + ((800 - ironLevelData!.tap2.levelThresholdHigh) / 800) * 120} x2={490} y2={20 + ((800 - ironLevelData!.tap2.levelThresholdHigh) / 800) * 120} stroke="var(--status-error)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
                      <line x1={40} y1={20 + ((800 - ironLevelData!.tap2.levelThresholdLow) / 800) * 120} x2={490} y2={20 + ((800 - ironLevelData!.tap2.levelThresholdLow) / 800) * 120} stroke="var(--status-warning)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
                      {/* 历史对比曲线 */}
                      {historyTrendData && (
                        <polyline
                          fill="none"
                          stroke="#a78bfa"
                          strokeWidth={1.5}
                          opacity={0.3}
                          points={historyTrendData.tap2.map((p, i) => `${40 + (i / (historyTrendData.tap2.length - 1)) * 450},${20 + ((800 - p.value) / 800) * 120}`).join(' ')}
                        />
                      )}
                      {/* 实时曲线 */}
                      <polyline
                        fill="none"
                        stroke="#a78bfa"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        points={trendData.tap2.map((p, i) => `${40 + (i / (trendData.tap2.length - 1)) * 450},${20 + ((800 - p.value) / 800) * 120}`).join(' ')}
                      />
                      {/* 当前值标记 */}
                      <circle cx={490} cy={20 + ((800 - trendData.tap2[trendData.tap2.length - 1].value) / 800) * 120} r={4} fill="#a78bfa" />
                      <text x={490} y={14 + ((800 - trendData.tap2[trendData.tap2.length - 1].value) / 800) * 120} textAnchor="end" fill="#a78bfa" fontSize={10} fontFamily="var(--font-mono)">{trendData.tap2[trendData.tap2.length - 1].value}mm</text>
                      {/* X轴时间标签 */}
                      {[0, 15, 30, 45, 59].map((idx) => (
                        <text key={`x2-${idx}`} x={40 + (idx / 59) * 450} y={155} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontFamily="var(--font-mono)">
                          {trendData.tap2[idx]?.time.slice(0, 5) || ''}
                        </text>
                      ))}
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: 400,
              color: 'var(--text-tertiary)',
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 16,
                background: `${deviceConfig?.color || '#666'}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Video size={32} color={deviceConfig?.color || '#666'} />
            </div>
            <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {deviceConfig?.name || selectedWinCC.deviceType} 监控
            </div>
            <div style={{ fontSize: 13 }}>{deviceConfig?.description || '监控模板开发中...'}</div>
          </div>
        )}
    </>
  );
}
