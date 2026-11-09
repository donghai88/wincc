import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  FileSpreadsheet,
  Radar,
  Search,
} from 'lucide-react';
import { isBenxiSuiteEnabled } from '@/lib/product-mode';

export type LadleNavId =
  | 'ladle-monitor'
  | 'ladle-radar'
  | 'ladle-report'
  | 'ladle-query'
  | 'ladle-curves'
  | 'ladle-alarms'
  | 'ladle-manage'
  | 'ladle-manual';

export interface LadleNavItem {
  id: LadleNavId;
  name: string;
  icon: LucideIcon;
  /** 本溪扩展功能，仅 isBenxiSuiteEnabled 时展示 */
  benxiOnly?: boolean;
}

const allLadleNavItems: LadleNavItem[] = [
  { id: 'ladle-monitor', name: '实时监控', icon: Activity },
  { id: 'ladle-radar', name: '雷达渣线', icon: Radar, benxiOnly: true },
  { id: 'ladle-report', name: '钢包报表', icon: FileSpreadsheet, benxiOnly: true },
  { id: 'ladle-query', name: '数据查询', icon: Search },
  { id: 'ladle-curves', name: '曲线分析', icon: BarChart3 },
  { id: 'ladle-alarms', name: '报警管理', icon: Bell },
  { id: 'ladle-manage', name: '钢包管理', icon: ClipboardList },
  { id: 'ladle-manual', name: '使用手册', icon: BookOpen },
];

export const ladleNavItems: LadleNavItem[] = allLadleNavItems.filter(
  (item) => !item.benxiOnly || isBenxiSuiteEnabled,
);

export const ladleNavTitles: Record<LadleNavId, string> = {
  'ladle-monitor': '实时监控',
  'ladle-radar': '雷达渣线检测',
  'ladle-report': '钢包报表',
  'ladle-query': '数据查询',
  'ladle-curves': '曲线分析',
  'ladle-alarms': '报警管理',
  'ladle-manage': '钢包管理',
  'ladle-manual': '使用手册',
};

export const defaultLadleNav: LadleNavId = 'ladle-monitor';

export function isLadleNavId(value: string): value is LadleNavId {
  return ladleNavItems.some((item) => item.id === value);
}
