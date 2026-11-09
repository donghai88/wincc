#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"

if [ ! -f out/index.html ]; then
  echo "[ERROR] 找不到 out/index.html，请先完整解压演示包。" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] 未找到 Node.js，请安装 Node.js 18 或更高版本。" >&2
  exit 1
fi

PORT="${PORT:-3001}" exec node scripts/serve-demo.mjs
