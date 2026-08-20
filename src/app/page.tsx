'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { WinCCInstance, DeviceType } from '@/types/template';
import { getDeviceTypeConfig, groupWinCCByDeviceType } from '@/data/wincc-config';
import Sidebar from '@/components/Sidebar';
import SystemOverview from '@/components/SystemOverview';
import DeviceTypeOverview from '@/components/DeviceTypeOverview';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadAlarmCount } from '@/hooks/useUnreadAlarmCount';
import { overviewDeviceTypes } from '@/lib/product-mode';
import { LogOut, User } from 'lucide-react';

// 次屏/重型模块延后加载；总览组件保持同步导入，避免首屏再等一轮动态编译。
const AlarmCenter = dynamic(() => import('@/components/AlarmCenter'), { ssr: false });
const TemperatureTrendReport = dynamic(() => import('@/components/TemperatureTrendReport'), { ssr: false });
const LadleCurveAnalysis = dynamic(() => import('@/components/LadleCurveAnalysis'), { ssr: false });
const LadleManagement = dynamic(() => import('@/components/LadleManagement'), { ssr: false });
const WeeklyReportQuery = dynamic(() => import('@/components/WeeklyReportQuery'), { ssr: false });
const DeviceMonitorPanel = dynamic(() => import('@/components/DeviceMonitorPanel'), { ssr: false });
const MonitorCenter = dynamic(() => import('@/components/MonitorCenter'), { ssr: false });

export default function Home() {
  const { user, isLoading, logout } = useAuth();
  const [selectedWinCC, setSelectedWinCC] = useState<WinCCInstance | null>(null);
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [activeNav, setActiveNav] = useState('dashboard');
  const unreadAlarmCount = useUnreadAlarmCount();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const updateViewportState = () => setIsNarrowViewport(mediaQuery.matches);

    updateViewportState();
    mediaQuery.addEventListener('change', updateViewportState);
    return () => mediaQuery.removeEventListener('change', updateViewportState);
  }, []);

  if (isLoading || !user) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--void)',
          color: 'var(--text-tertiary)',
        }}
      >
        加载中...
      </div>
    );
  }

  const isHotMetalTrough = selectedDeviceType === 'hot-metal-trough';
  const isHotMetalTroughSim = selectedDeviceType === 'hot-metal-trough-sim';
  const isLadleRecognition = selectedDeviceType === 'ladle-recognition';
  const isImmersiveTwin = isHotMetalTrough || isHotMetalTroughSim || isLadleRecognition;
  const isReportView = activeNav === 'reports';
  const deviceConfig = selectedWinCC ? getDeviceTypeConfig(selectedWinCC.deviceType) : null;
  const effectiveSidebarCollapsed = sidebarCollapsed || isNarrowViewport;

  const handleSelectDeviceType = (deviceType: DeviceType) => {
    const grouped = groupWinCCByDeviceType();
    const instances = grouped[deviceType] || [];
    setSelectedDeviceType(deviceType);
    setSelectedWinCC(instances[0] ?? null);
  };

  const handleBackToOverview = () => {
    setSelectedDeviceType(null);
    setSelectedWinCC(null);
  };

  const renderDashboard = () => {
    if (selectedDeviceType && selectedWinCC) {
      return (
        <DeviceMonitorPanel
          selectedWinCC={selectedWinCC}
          selectedDeviceType={selectedDeviceType}
          onSelectWinCC={setSelectedWinCC}
          onBack={handleBackToOverview}
        />
      );
    }

    return (
      <>
        <SystemOverview visibleDeviceTypes={overviewDeviceTypes} />
        <DeviceTypeOverview
          onSelectDeviceType={handleSelectDeviceType}
          visibleDeviceTypes={overviewDeviceTypes}
        />
      </>
    );
  };

  const renderPlaceholder = (title: string, description: string) => (
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
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{description}</div>
    </div>
  );

  const renderContent = () => {
    switch (activeNav) {
      case 'dashboard':
        return renderDashboard();
      case 'devices':
        return <MonitorCenter />;
      case 'reports':
        return <TemperatureTrendReport />;
      case 'curves':
        return <LadleCurveAnalysis />;
      case 'ladles':
        return <LadleManagement />;
      case 'alarms':
        return <AlarmCenter />;
      case 'settings':
        return <WeeklyReportQuery />;
      case 'help':
        return renderPlaceholder('帮助文档', '使用说明和帮助文档编写中...');
      default:
        return renderDashboard();
    }
  };

  const handleNavChange = (navId: string) => {
    setActiveNav(navId);
    if (navId !== 'dashboard') {
      setSelectedDeviceType(null);
      setSelectedWinCC(null);
    }
  };

  const navTitles: Record<string, string> = {
    dashboard: '监控总览',
    devices: '监控中心',
    reports: '报表分析',
    curves: '曲线分析',
    ladles: '钢包管理',
    alarms: '告警中心',
    settings: '查询周报',
    help: '帮助文档',
  };

  const getCurrentTitle = () => {
    if (activeNav === 'dashboard' && selectedDeviceType === 'hot-metal-trough-sim') {
      return '铁水沟一视觉仿真';
    }
    if (activeNav === 'dashboard' && selectedDeviceType === 'hot-metal-trough') {
      return '铁水沟数字孪生';
    }
    if (activeNav === 'dashboard' && selectedDeviceType === 'ladle-recognition') {
      return '钢包识别';
    }
    if (activeNav === 'dashboard' && selectedDeviceType && deviceConfig) {
      return `${deviceConfig.name}监控`;
    }
    return navTitles[activeNav];
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--void)',
      }}
    >
      <Sidebar
        activeNav={activeNav}
        onNavChange={handleNavChange}
        unreadAlarmCount={unreadAlarmCount}
        collapsed={effectiveSidebarCollapsed}
        onToggleCollapse={isNarrowViewport ? undefined : () => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >        <header
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isNarrowViewport ? '0 12px' : '0 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h1 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
              {getCurrentTitle()}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {!isNarrowViewport && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                background: 'var(--surface-hover)',
                borderRadius: 8,
              }}
            >
              <User size={14} color="var(--text-tertiary)" />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user.name}</span>
              <button
                onClick={logout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  marginLeft: 4,
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 69, 58, 0.1)';
                  e.currentTarget.style.color = 'var(--status-error)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
                title="退出登录"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </header>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: isImmersiveTwin || isReportView ? 'hidden' : 'auto',
            padding: isImmersiveTwin ? 0 : isNarrowViewport ? 12 : isReportView ? 16 : 20,
          }}
        >
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
