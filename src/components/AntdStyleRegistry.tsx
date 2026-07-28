'use client';

import { AntdRegistry } from '@ant-design/nextjs-registry';

/** 仅在使用 antd 的页面包裹，避免根布局拖入 antd 拖慢首页编译。 */
export default function AntdStyleRegistry({ children }: { children: React.ReactNode }) {
  return <AntdRegistry>{children}</AntdRegistry>;
}
