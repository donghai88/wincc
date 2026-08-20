export type LadleCondition = 'normal' | 'attention' | 'maintenance';

export interface LadleAsset {
  id: string;
  condition: LadleCondition;
  useCount: number;
  monthlyUses: number;
  lastTemperature: number;
  slagDepth: number;
  lastInspection: string;
  commissionedAt: string;
  lastRepair: string;
  designLife: number;
  remainingLife: number;
  owner: string;
  nextAction: string;
}

export const ladleAssets: LadleAsset[] = [
  { id: 'A3256', condition: 'normal', useCount: 156, monthlyUses: 47, lastTemperature: 487, slagDepth: 22.5, lastInspection: '2026-06-26 08:30', commissionedAt: '2025-08-15', lastRepair: '2026-06-20', designLife: 500, remainingLife: 344, owner: '炼钢二厂 · 热修位', nextAction: '按计划进行下次渣线复检' },
  { id: 'A3241', condition: 'attention', useCount: 312, monthlyUses: 52, lastTemperature: 465, slagDepth: 38.7, lastInspection: '2026-06-25 14:15', commissionedAt: '2025-03-10', lastRepair: '2026-05-28', designLife: 500, remainingLife: 188, owner: '炼钢二厂 · 热修位', nextAction: '本周安排热修检查' },
  { id: 'A3198', condition: 'attention', useCount: 287, monthlyUses: 38, lastTemperature: 442, slagDepth: 42.3, lastInspection: '2026-06-24 09:00', commissionedAt: '2025-05-22', lastRepair: '2026-06-05', designLife: 500, remainingLife: 213, owner: '炼钢二厂 · 热修位', nextAction: '复核渣线磨损区域' },
  { id: 'A3302', condition: 'normal', useCount: 98, monthlyUses: 28, lastTemperature: 438, slagDepth: 18.2, lastInspection: '2026-06-26 10:42', commissionedAt: '2025-11-01', lastRepair: '—', designLife: 500, remainingLife: 402, owner: '炼钢二厂 · 热修位', nextAction: '维持常规巡检' },
  { id: 'A3277', condition: 'normal', useCount: 203, monthlyUses: 41, lastTemperature: 455, slagDepth: 28.5, lastInspection: '2026-06-23 16:20', commissionedAt: '2025-06-18', lastRepair: '2026-05-18', designLife: 500, remainingLife: 297, owner: '炼钢二厂 · 热修位', nextAction: '维持常规巡检' },
  { id: 'A3189', condition: 'maintenance', useCount: 415, monthlyUses: 12, lastTemperature: 490, slagDepth: 55.8, lastInspection: '2026-06-20 07:50', commissionedAt: '2024-09-03', lastRepair: '2026-02-14', designLife: 500, remainingLife: 85, owner: '炼钢二厂 · 热修位', nextAction: '停用并安排内衬检修' },
];

export const conditionLabel: Record<LadleCondition, string> = {
  normal: '使用中',
  attention: '需关注',
  maintenance: '待检修',
};
