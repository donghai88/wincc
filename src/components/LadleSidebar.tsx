'use client';

import {
  Activity,
  ArrowLeft,
  Flame,
  LayoutDashboard,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { ladleNavItems, type LadleNavId } from '@/lib/ladle-navigation';

export type LadleSidebarNavId = LadleNavId | 'dashboard';

interface LadleSidebarProps {
  activeNav: LadleSidebarNavId;
  onNavChange: (navId: LadleNavId) => void;
  /** 钢包产品版：展示与铁水沟共用的「监控总览」一级入口 */
  includeOverview?: boolean;
  onOverviewClick?: () => void;
  onBackToModeSelector?: () => void;
  unreadAlarmCount?: number | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function LadleSidebar({
  activeNav,
  onNavChange,
  includeOverview = false,
  onOverviewClick,
  onBackToModeSelector,
  unreadAlarmCount = null,
  collapsed = false,
  onToggleCollapse,
}: LadleSidebarProps) {
  const overviewActive = activeNav === 'dashboard';

  return (
    <aside
      style={{
        width: collapsed ? 64 : 220,
        height: '100%',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'width var(--transition-base)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: collapsed ? '24px 16px' : '24px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Flame size={16} color="#fff" />
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                监控集成平台
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                钢铁冶金监控系统
              </div>
            </div>
          )}
        </div>
        {!collapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
            title="收起侧边栏"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {collapsed && onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          style={{
            width: '100%',
            padding: '12px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--border-subtle)',
            cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
          title="展开侧边栏"
        >
          <PanelLeft size={18} />
        </button>
      )}

      <nav style={{ flex: 1, overflow: 'auto', padding: '12px 8px' }}>
        {onBackToModeSelector && (
          <button
            type="button"
            onClick={onBackToModeSelector}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: collapsed ? '12px 0' : '10px 12px',
              marginBottom: 10,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: 'var(--text-secondary)',
            }}
            title="返回功能选择"
          >
            <ArrowLeft size={18} style={{ flexShrink: 0 }} />
            {!collapsed && (
              <span style={{ fontSize: 13, textAlign: 'left' }}>返回功能选择</span>
            )}
          </button>
        )}

        {includeOverview && (
          <button
            type="button"
            onClick={onOverviewClick}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: collapsed ? '12px 0' : '10px 12px',
              marginBottom: 4,
              background: overviewActive ? 'var(--surface-hover)' : 'transparent',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              position: 'relative',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
            title={collapsed ? '监控总览' : undefined}
          >
            {overviewActive && (
              <div
                style={{
                  position: 'absolute',
                  left: collapsed ? '50%' : 0,
                  transform: collapsed ? 'translateX(-50%)' : 'none',
                  bottom: collapsed ? 0 : 'auto',
                  top: collapsed ? 'auto' : '50%',
                  marginTop: collapsed ? 0 : -10,
                  width: collapsed ? 20 : 3,
                  height: collapsed ? 3 : 20,
                  background: '#0a84ff',
                  borderRadius: collapsed ? '2px 2px 0 0' : '0 2px 2px 0',
                }}
              />
            )}
            <LayoutDashboard
              size={18}
              style={{
                color: overviewActive ? '#0a84ff' : 'var(--text-muted)',
                flexShrink: 0,
              }}
            />
            {!collapsed && (
              <span
                style={{
                  flex: 1,
                  textAlign: 'left',
                  fontSize: 13,
                  color: overviewActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: overviewActive ? 500 : 400,
                }}
              >
                监控总览
              </span>
            )}
          </button>
        )}

        {ladleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          const badge = item.id === 'ladle-alarms' ? unreadAlarmCount ?? 0 : 0;

          return (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: collapsed ? '12px 0' : '10px 12px',
                marginBottom: 4,
                background: isActive ? 'var(--surface-hover)' : 'transparent',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                position: 'relative',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
              title={collapsed ? item.name : undefined}
            >
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    left: collapsed ? '50%' : 0,
                    transform: collapsed ? 'translateX(-50%)' : 'none',
                    bottom: collapsed ? 0 : 'auto',
                    top: collapsed ? 'auto' : '50%',
                    marginTop: collapsed ? 0 : -10,
                    width: collapsed ? 20 : 3,
                    height: collapsed ? 3 : 20,
                    background: '#0a84ff',
                    borderRadius: collapsed ? '2px 2px 0 0' : '0 2px 2px 0',
                  }}
                />
              )}

              <Icon
                size={18}
                style={{
                  color: isActive ? '#0a84ff' : 'var(--text-muted)',
                  flexShrink: 0,
                }}
              />

              {!collapsed && (
                <>
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      fontSize: 13,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 500 : 400,
                    }}
                  >
                    {item.name}
                  </span>
                  {badge > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        background: 'rgba(255, 69, 58, 0.15)',
                        color: 'var(--status-error)',
                        borderRadius: 10,
                        fontWeight: 500,
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      <div
        style={{
          padding: collapsed ? '16px 0' : '16px 20px',
          borderTop: '1px solid var(--border-subtle)',
          textAlign: collapsed ? 'center' : 'left',
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <Activity size={12} />
          {collapsed ? 'v2' : 'RH-LadleMonitor V2.0'}
        </div>
      </div>
    </aside>
  );
}
