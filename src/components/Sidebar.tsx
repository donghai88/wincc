'use client';

import {
  LayoutDashboard,
  Monitor,
  FileBarChart,
  FileSearch,
  Bell,
  BookOpen,
  PanelLeftClose,
  PanelLeft,
  Flame,
  type LucideIcon,
} from 'lucide-react';
import { isLadleProductMode, productBrandSubtitle, productBrandTitle } from '@/lib/product-mode';

interface NavItem {
  id: string;
  name: string;
  icon: LucideIcon;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'dashboard', name: '监控总览', icon: LayoutDashboard },
  { id: 'devices', name: '监控中心', icon: Monitor },
  { id: 'reports', name: '报表分析', icon: FileBarChart },
  { id: 'alarms', name: '告警中心', icon: Bell },
  { id: 'settings', name: '查询周报', icon: FileSearch },
  { id: 'manual', name: '使用手册', icon: BookOpen },
];

const visibleNavItems = isLadleProductMode
  ? navItems.filter((item) => item.id !== 'devices')
  : navItems;

/** 长系统名在侧栏拆成主标题和较轻的后缀，避免在按钮旁被挤断。 */
function brandTitleLines(title: string): [string, string] | [string] {
  const suffix = '监测系统';
  const index = title.indexOf(suffix);
  if (index > 0) return [title.slice(0, index), title.slice(index)];
  return [title];
}

interface SidebarProps {
  activeNav: string;
  onNavChange: (navId: string) => void;
  unreadAlarmCount?: number | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  activeNav,
  onNavChange,
  unreadAlarmCount = null,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <aside
      style={{
        width: collapsed ? 64 : 248,
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
      {/* Logo */}
      <div
        style={{
          position: 'relative',
          padding: collapsed ? '20px 16px' : '16px 14px 14px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.22)',
            }}
          >
            <Flame size={17} color="#fff" />
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              {brandTitleLines(productBrandTitle).map((line, index) => (
                <div
                  key={line}
                  style={index === 0
                    ? {
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        lineHeight: 1.25,
                        letterSpacing: '0.03em',
                        whiteSpace: 'nowrap',
                      }
                    : {
                        marginTop: 2,
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.2,
                        letterSpacing: '0.18em',
                      }}
                >
                  {line}
                </div>
              ))}
              {productBrandSubtitle ? (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {productBrandSubtitle}
                </div>
              ) : null}
            </div>
          )}
        </div>
        {!collapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            style={{
              marginLeft: 'auto',
              flexShrink: 0,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-hover)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title="收起侧边栏"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
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
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-hover)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          title="展开侧边栏"
        >
          <PanelLeft size={18} />
        </button>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, overflow: 'auto', padding: '12px 8px' }}>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          const badge = item.id === 'alarms' ? unreadAlarmCount ?? 0 : item.badge ?? 0;

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
                transition: 'background var(--transition-fast)',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--surface-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              title={collapsed ? item.name : undefined}
            >
              {/* Active Indicator */}
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
                    background: 'var(--accent)',
                    borderRadius: collapsed ? '2px 2px 0 0' : '0 2px 2px 0',
                  }}
                />
              )}

              <Icon
                size={18}
                style={{
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
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

              {collapsed && badge > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: collapsed ? 12 : 'auto',
                    width: 8,
                    height: 8,
                    background: 'var(--status-error)',
                    borderRadius: '50%',
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: collapsed ? '16px 0' : '16px 20px',
          borderTop: '1px solid var(--border-subtle)',
          textAlign: collapsed ? 'center' : 'left',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          {collapsed ? 'v1.0' : 'v1.0.0 · 钢包监控'}
        </div>
      </div>
    </aside>
  );
}
