import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// 锁定为本项目目录，避免被上级 /Users/qihoo/package-lock.json 误判为工作区根。
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const isProdBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // 静态导出仅用于生产构建；开发态关闭可减少不必要的导出约束开销。
  ...(isProdBuild ? { output: "export" as const } : {}),
  // 防止上级目录中的 lockfile 被错误识别为工作区根目录，缩小 Turbopack 的文件解析与监听范围。
  turbopack: {
    root: projectRoot,
  },
  // 开发态持久化 Turbopack 缓存，二次启动明显更快。
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};

export default nextConfig;
