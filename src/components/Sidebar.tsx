'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  Monitor,
  FileBarChart,
  Settings,
  Bell,
  HelpCircle,
  PanelLeftClose,
  PanelLeft,
  Flame,
} from 'lucide-react';

interface NavItem {
  id: string;
  name: string;
  icon: React.ElementType;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'dashboard', name: '监控总览', icon: LayoutDashboard },
  { id: 'devices', name: '设备管理', icon: Monitor },
  { id: 'reports', name: '报表分析', icon: FileBarChart },
  { id: 'alarms', name: '告警中心', icon: Bell, badge: 3 },
  { id: 'settings', name: '系统设置', icon: Settings },
  { id: 'help', name: '帮助文档', icon: HelpCircle },
];

interface SidebarProps {
  activeNav: string;
  onNavChange: (navId: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ activeNav, onNavChange, collapsed = false, onToggleCollapse }: SidebarProps) {
  return (
    <aside
      style={{
        width: collapsed ? 64 : 220,
        height: '100vh',
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
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;

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

                  {item.badge && (
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
                      {item.badge}
                    </span>
                  )}
                </>
              )}

              {collapsed && item.badge && (
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
