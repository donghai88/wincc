'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { WinCCInstance, DeviceType } from '@/types/template';
import { getDeviceTypeConfig, groupWinCCByDeviceType } from '@/data/wincc-config';
import Sidebar from '@/components/Sidebar';
import LadleSidebar from '@/components/LadleSidebar';
import SystemOverview from '@/components/SystemOverview';
import DeviceTypeOverview from '@/components/DeviceTypeOverview';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadAlarmCount } from '@/hooks/useUnreadAlarmCount';
import { useLadleUnreadAlarmCount } from '@/hooks/useLadleUnreadAlarmCount';
import {
  defaultLadleNav,
  isLadleNavId,
  ladleNavTitles,
  type LadleNavId,
} from '@/lib/ladle-navigation';
import {
  createDefaultAppRoute,
  pushAppRoute,
  readAppRouteFromLocation,
  replaceAppRoute,
  type AppRouteState,
  type LadlePanelMode,
} from '@/lib/app-navigation';
import { isLadleProductMode, isTroughProductMode, overviewDeviceTypes } from '@/lib/product-mode';
import { LogOut, User } from 'lucide-react';

const AlarmCenter = dynamic(() => import('@/components/AlarmCenter'), { ssr: false });
const TemperatureTrendReport = dynamic(() => import('@/components/TemperatureTrendReport'), { ssr: false });
const LadleCurveAnalysis = dynamic(() => import('@/components/LadleCurveAnalysis'), { ssr: false });
const LadleManagement = dynamic(() => import('@/components/LadleManagement'), { ssr: false });
const LadleDataQuery = dynamic(() => import('@/components/LadleDataQuery'), { ssr: false });
const LadleAlarmCenter = dynamic(() => import('@/components/LadleAlarmCenter'), { ssr: false });
const LadleUserManual = dynamic(() => import('@/components/LadleUserManual'), { ssr: false });
const UserManual = dynamic(() => import('@/components/UserManual'), { ssr: false });
const WeeklyReportQuery = dynamic(() => import('@/components/WeeklyReportQuery'), { ssr: false });
const DeviceMonitorPanel = dynamic(() => import('@/components/DeviceMonitorPanel'), { ssr: false });
const MonitorCenter = dynamic(() => import('@/components/MonitorCenter'), { ssr: false });
const LadleRecognitionMonitor = dynamic(() => import('@/components/LadleRecognitionMonitor'), { ssr: false });

function resolveWinCC(deviceType: DeviceType | null): WinCCInstance | null {
  if (!deviceType) return null;
  const grouped = groupWinCCByDeviceType();
  return grouped[deviceType]?.[0] ?? null;
}

function applyRouteToState(
  route: AppRouteState,
  setters: {
    setSelectedDeviceType: (value: DeviceType | null) => void;
    setSelectedWinCC: (value: WinCCInstance | null) => void;
    setLadleShellActive: (value: boolean) => void;
    setLadlePanelMode: (value: LadlePanelMode) => void;
    setActiveNav: (value: string) => void;
  },
) {
  setters.setSelectedDeviceType(route.deviceType);
  setters.setSelectedWinCC(resolveWinCC(route.deviceType));
  setters.setLadleShellActive(route.ladleShellActive);
  setters.setLadlePanelMode(route.ladlePanelMode);
  setters.setActiveNav(route.nav);
}

export default function Home() {
  const { user, isLoading, logout } = useAuth();
  const [selectedWinCC, setSelectedWinCC] = useState<WinCCInstance | null>(null);
  const [selectedDeviceType, setSelectedDeviceType] = useState<DeviceType | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [ladleShellActive, setLadleShellActive] = useState(false);
  const [ladlePanelMode, setLadlePanelMode] = useState<LadlePanelMode>('selector');
  const [activeNav, setActiveNav] = useState('dashboard');
  const [routeReady, setRouteReady] = useState(false);
  const troughUnreadAlarmCount = useUnreadAlarmCount();
  const ladleUnreadAlarmCount = useLadleUnreadAlarmCount(ladleShellActive || isLadleProductMode);

  const syncFromRoute = useCallback((route: AppRouteState) => {
    applyRouteToState(route, {
      setSelectedDeviceType,
      setSelectedWinCC,
      setLadleShellActive,
      setLadlePanelMode,
      setActiveNav,
    });
  }, []);

  const navigateTo = useCallback((route: AppRouteState, mode: 'push' | 'replace' = 'push') => {
    syncFromRoute(route);
    if (mode === 'replace') replaceAppRoute(route);
    else pushAppRoute(route);
  }, [syncFromRoute]);

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

  useEffect(() => {
    const initial = readAppRouteFromLocation();
    syncFromRoute(initial);
    replaceAppRoute(initial);
    setRouteReady(true);

    const onPopState = () => {
      syncFromRoute(readAppRouteFromLocation());
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [syncFromRoute]);

  if (isLoading || !user || !routeReady) {
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

  // 钢包产品版业务菜单为一级；监控总览进入层级与铁水沟共用
  const isLadleShell = ladleShellActive;
  const useLadleProductSidebar = isLadleProductMode;
  const isHotMetalTrough = selectedDeviceType === 'hot-metal-trough';
  const isHotMetalTroughSim = selectedDeviceType === 'hot-metal-trough-sim';
  const isLadleRecognition = selectedDeviceType === 'ladle-recognition';
  const isImmersiveTwin = !isLadleShell && (isHotMetalTrough || isHotMetalTroughSim || isLadleRecognition);
  const isReportView = !isLadleShell && activeNav === 'reports';
  const deviceConfig = selectedWinCC ? getDeviceTypeConfig(selectedWinCC.deviceType) : null;
  const effectiveSidebarCollapsed = sidebarCollapsed || isNarrowViewport;
  const unreadAlarmCount = (isLadleShell || useLadleProductSidebar) ? ladleUnreadAlarmCount : troughUnreadAlarmCount;

  const handleSelectDeviceType = (deviceType: DeviceType) => {
    navigateTo({
      nav: 'dashboard',
      deviceType,
      ladlePanelMode: 'selector',
      ladleShellActive: false,
    });
  };

  const handleEnterLadleWorkspace = () => {
    navigateTo({
      nav: defaultLadleNav,
      deviceType: 'ladle-recognition',
      ladlePanelMode: 'selector',
      ladleShellActive: true,
    });
  };

  const handleSelectLadleRadar = () => {
    navigateTo({
      nav: 'dashboard',
      deviceType: 'ladle-recognition',
      ladlePanelMode: 'radar',
      ladleShellActive: false,
    });
  };

  const handleBackFromLadleRadar = () => {
    navigateTo({
      nav: 'dashboard',
      deviceType: 'ladle-recognition',
      ladlePanelMode: 'selector',
      ladleShellActive: false,
    });
  };

  const handleBackToOverview = () => {
    navigateTo(createDefaultAppRoute());
  };

  const handleBackToLadleModeSelector = () => {
    navigateTo({
      nav: 'dashboard',
      deviceType: 'ladle-recognition',
      ladlePanelMode: 'selector',
      ladleShellActive: false,
    });
  };

  const renderDashboard = () => {
    if (selectedDeviceType && selectedWinCC) {
      return (
        <DeviceMonitorPanel
          selectedWinCC={selectedWinCC}
          selectedDeviceType={selectedDeviceType}
          onSelectWinCC={setSelectedWinCC}
          onBack={handleBackToOverview}
          ladlePanelMode={ladlePanelMode}
          onSelectLadleRadar={
            selectedDeviceType === 'ladle-recognition' ? handleSelectLadleRadar : undefined
          }
          onBackFromLadleRadar={
            selectedDeviceType === 'ladle-recognition' ? handleBackFromLadleRadar : undefined
          }
          onEnterLadleWorkspace={
            selectedDeviceType === 'ladle-recognition' ? handleEnterLadleWorkspace : undefined
          }
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

  const renderLadleContent = () => {
    const monitor = (
      <LadleRecognitionMonitor
        embedded
        onBack={handleBackToLadleModeSelector}
        wincc={selectedWinCC ?? undefined}
      />
    );

    if (!isLadleNavId(activeNav)) return monitor;

    switch (activeNav) {
      case 'ladle-monitor':
        return monitor;
      case 'ladle-query':
        return <LadleDataQuery />;
      case 'ladle-curves':
        return <LadleCurveAnalysis />;
      case 'ladle-alarms':
        return <LadleAlarmCenter />;
      case 'ladle-manage':
        return <LadleManagement />;
      case 'ladle-manual':
        return <LadleUserManual />;
      default:
        return monitor;
    }
  };

  const renderContent = () => {
    if (isLadleShell) {
      return renderLadleContent();
    }

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
      case 'manual':
        return isTroughProductMode
          ? renderDashboard()
          : <UserManual onOpenLadle={() => handleSelectDeviceType('ladle-recognition')} />;
      case 'help':
        return isTroughProductMode
          ? renderDashboard()
          : <UserManual onOpenLadle={() => handleSelectDeviceType('ladle-recognition')} />;
      default:
        return renderDashboard();
    }
  };

  const handleNavChange = (navId: string) => {
    navigateTo({
      nav: navId,
      deviceType: null,
      ladlePanelMode: 'selector',
      ladleShellActive: false,
    });
  };

  const handleLadleNavChange = (navId: LadleNavId) => {
    navigateTo({
      nav: navId,
      deviceType: 'ladle-recognition',
      ladlePanelMode: 'selector',
      ladleShellActive: true,
    });
  };

  const navTitles: Record<string, string> = {
    dashboard: '监控总览',
    devices: '监控中心',
    reports: '报表分析',
    curves: '曲线分析',
    ladles: '钢包管理',
    alarms: '告警中心',
    settings: '查询周报',
    manual: '用户使用手册',
    help: '用户使用手册',
    ...ladleNavTitles,
  };

  const getCurrentTitle = () => {
    if (isLadleShell && isLadleNavId(activeNav)) {
      return ladleNavTitles[activeNav];
    }
    if (activeNav === 'dashboard' && selectedDeviceType === 'hot-metal-trough-sim') {
      return '铁水沟一视觉仿真';
    }
    if (activeNav === 'dashboard' && selectedDeviceType === 'hot-metal-trough') {
      return '铁水沟数字孪生';
    }
    if (activeNav === 'dashboard' && selectedDeviceType === 'ladle-recognition' && ladlePanelMode === 'radar') {
      return '雷达渣线检测';
    }
    if (activeNav === 'dashboard' && selectedDeviceType === 'ladle-recognition') {
      return '钢包识别';
    }
    if (activeNav === 'dashboard' && selectedDeviceType && deviceConfig) {
      return `${deviceConfig.name}监控`;
    }
    return navTitles[activeNav];
  };

  const contentPadding = isLadleShell
    ? (activeNav === 'ladle-monitor' ? 0 : (isNarrowViewport ? 12 : 20))
    : (isImmersiveTwin ? 0 : isNarrowViewport ? 12 : isReportView ? 16 : 20);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--void)',
      }}
    >
      {useLadleProductSidebar || isLadleShell ? (
        <LadleSidebar
          activeNav={
            isLadleNavId(activeNav)
              ? activeNav
              : (useLadleProductSidebar ? 'dashboard' : defaultLadleNav)
          }
          onNavChange={handleLadleNavChange}
          includeOverview={useLadleProductSidebar}
          onOverviewClick={useLadleProductSidebar ? handleBackToOverview : undefined}
          unreadAlarmCount={unreadAlarmCount}
          collapsed={effectiveSidebarCollapsed}
          onToggleCollapse={isNarrowViewport ? undefined : () => setSidebarCollapsed(!sidebarCollapsed)}
        />
      ) : (
        <Sidebar
          activeNav={activeNav}
          onNavChange={handleNavChange}
          unreadAlarmCount={unreadAlarmCount}
          collapsed={effectiveSidebarCollapsed}
          onToggleCollapse={isNarrowViewport ? undefined : () => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header
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
            {isLadleShell && (
              <button
                type="button"
                onClick={handleBackToLadleModeSelector}
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                返回功能选择
              </button>
            )}
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
            overflow: isLadleShell && activeNav === 'ladle-monitor' ? 'hidden' : 'auto',
            padding: contentPadding,
          }}
        >
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
