import type { DeviceType } from '@/types/template';

/**
 * 构建目标会被 NEXT_PUBLIC_PRODUCT_MODE 内联到浏览器产物中。
 * 未设置或不是已知模式时，使用 branchDefaultProductMode。
 * 集成分支为 null，呈现完整平台；产品分支把默认值固定为对应模式。
 *
 * 集成分支脚本：
 * - npm run dev                     → 集成平台（铁水沟 + 钢包识别，含本溪扩展）
 * - npm run dev:trough              → 仅铁水沟（平台一级菜单）
 * - npm run dev:ladle-recognition   → 仅钢包识别（热成像为主，雷达入口关闭）
 * - npm run dev:benxi-ladle         → 本溪钢包（钢包监测壳 + 开启雷达渣线模块）
 * - npm run dev:demo                → 集成平台，强制 Mock
 */
export type ProductMode = 'trough' | 'ladle-recognition' | 'benxi-ladle';

interface ProductConfig {
  deviceType: DeviceType;
  title: string;
  brandTitle: string;
  brandSubtitle: string;
}

const ladleVendorName = '西安豪克电子有限公司';
const demoVendorName = '天津市瑞海电子科技有限公司';

const productConfigs: Record<ProductMode, ProductConfig> = {
  // 当前“铁水沟”产品对应视觉仿真数字孪生模块。
  trough: {
    deviceType: 'hot-metal-trough-sim',
    title: '铁水沟视觉仿真数字孪生',
    brandTitle: '监控集成平台',
    brandSubtitle: '钢铁冶金监控系统',
  },
  'ladle-recognition': {
    deviceType: 'ladle-recognition',
    title: '钢包识别',
    brandTitle: '钢包监测系统',
    brandSubtitle: ladleVendorName,
  },
  'benxi-ladle': {
    deviceType: 'ladle-recognition',
    title: '智能检测系统',
    brandTitle: '智能检测系统',
    brandSubtitle: '',
  },
};

/** 集成平台默认展示的业务模块入口。 */
export const integratedOverviewDeviceTypes: DeviceType[] = [
  'hot-metal-trough-sim',
  'ladle-recognition',
];

function isProductMode(value: string | undefined): value is ProductMode {
  return value === 'trough' || value === 'ladle-recognition' || value === 'benxi-ladle';
}

/** 未设置 NEXT_PUBLIC_PRODUCT_MODE 时的默认产品。null 表示集成平台。 */
const branchDefaultProductMode: ProductMode | null = null;

export const productMode = isProductMode(process.env.NEXT_PUBLIC_PRODUCT_MODE)
  ? process.env.NEXT_PUBLIC_PRODUCT_MODE
  : branchDefaultProductMode;

export const productConfig = productMode ? productConfigs[productMode] : null;

/** 钢包业务壳（侧栏/登录品牌等）：钢包识别版与本溪钢包版共用。 */
export const isLadleProductMode =
  productMode === 'ladle-recognition' || productMode === 'benxi-ladle';

export const isBenxiLadleProductMode = productMode === 'benxi-ladle';
export const isTroughProductMode = productMode === 'trough';

/**
 * 雷达渣线模块：本溪钢包版开启；集成平台保留入口便于演示；
 * 常规钢包识别产品版保持关闭（与现网一致）。
 */
export const isRadarModuleEnabled = productMode !== 'ladle-recognition';

/**
 * 本溪钢包扩展功能（总览驾驶舱 / 雷达渣线 / 钢包报表）：
 * 本溪钢包版与集成演示平台开启，山西钢包识别版不开放。
 */
export const isBenxiSuiteEnabled = productMode === 'benxi-ladle' || productMode === null;

export const productBrandTitle = productConfig?.brandTitle
  ?? (isLadleProductMode ? '钢包监测系统' : '监控集成平台');

export const productBrandSubtitle = productConfig?.brandSubtitle
  ?? (isLadleProductMode ? ladleVendorName : '钢铁冶金监控系统');

/** 钢包模块侧栏、使用手册中展示的系统提供方：集成演示版为瑞海，钢包产品版为豪克。 */
export const productVendorName = productMode === null ? demoVendorName : ladleVendorName;

/** 钢包模块侧栏标题。本溪版用智能检测系统，且不展示公司名。 */
export const ladleShellTitle = isBenxiLadleProductMode ? '智能检测系统' : '钢包监测系统';

/** 总览页可见设备类型：单产品模式只开对应模块，否则展示全部集成入口。 */
export const overviewDeviceTypes: DeviceType[] = productConfig
  ? [productConfig.deviceType]
  : integratedOverviewDeviceTypes;
