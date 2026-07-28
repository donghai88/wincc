import type { DeviceType } from '@/types/template';

/**
 * 构建目标会被 NEXT_PUBLIC_PRODUCT_MODE 内联到浏览器产物中。
 * 未设置时保留完整的集成平台；设置后只呈现指定业务模块。
 */
export type ProductMode = 'trough' | 'ladle-recognition';

interface ProductConfig {
  deviceType: DeviceType;
  title: string;
}

const productConfigs: Record<ProductMode, ProductConfig> = {
  // 当前“铁水沟”产品对应视觉仿真数字孪生模块。
  trough: { deviceType: 'hot-metal-trough-sim', title: '铁水沟视觉仿真数字孪生' },
  'ladle-recognition': { deviceType: 'ladle-recognition', title: '钢包识别' },
};

function isProductMode(value: string | undefined): value is ProductMode {
  return value === 'trough' || value === 'ladle-recognition';
}

export const productMode = isProductMode(process.env.NEXT_PUBLIC_PRODUCT_MODE)
  ? process.env.NEXT_PUBLIC_PRODUCT_MODE
  : null;

export const productConfig = productMode ? productConfigs[productMode] : null;
