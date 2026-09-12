# 钢包监测版本 Node.js 部署打包提示词

> 用途：交给另一个 Agent 执行，为「钢包监测」产品版打前端包，并在服务器上用 Node.js 启动。  
> 仓库约定参考：`package.json`、`scripts/serve-static.mjs`、`deploy/`、`README.md`。

---

## 可复制提示词

请为当前仓库打包「钢包监测」产品版前端，目标是部署到服务器上用 Node.js 启动（不要用 Docker/Nginx 作为最终运行方式）。

### 目标

- 产品模式：`NEXT_PUBLIC_PRODUCT_MODE=ladle-recognition`
- 构建产物：Next.js 静态导出 `out/`
- 运行方式：`node scripts/serve-static.mjs`（已有脚本，会托管 `out/`，并把 `/api/*`、`/ws/*` 反向代理到后端）
- 参考已有铁水沟 Node 部署包：`deploy/`（`start.cmd`、`README.md`、`verify-deployment.*`）

### 构建要求

1. 在项目根目录执行依赖安装（如需要）：`npm ci` 或 `npm install`
2. 按「真实后端」模式构建钢包版（对齐铁水沟 `build:trough:local-backend` 思路）：
   - `NEXT_PUBLIC_PRODUCT_MODE=ladle-recognition`
   - `NEXT_PUBLIC_API_MOCK_MODE=off`
   - `NEXT_PUBLIC_API_BASE_URL=/api`
   - `NEXT_PUBLIC_WS_BASE_URL=`（空，走同源代理）
3. 若仓库还没有对应 npm script，可新增：
   - `build:ladle-recognition:local-backend`
   - 可选：`docker:build:ladle-recognition:local-backend` 不必做（本次只要 Node 部署包）
4. 执行构建，确认生成 `out/index.html`

### 部署包内容（打 zip）

打一个可解压即用的包，建议目录名类似：

`ruihai-ladle-recognition-frontend-YYYYMMDD-HHMMSS/`

包内至少包含：

- `out/`（完整静态产物）
- `scripts/serve-static.mjs`
- `package.json`（至少保证能装上 `serve-static.mjs` 所需依赖，当前依赖 `ws`）
- `package-lock.json`（如有）
- `deploy/` 启动与说明文件（可基于现有铁水沟 deploy 复制并改成钢包版文案）：
  - `deploy/start.cmd`：`PORT=3001`，`API_PROXY_TARGET=http://127.0.0.1:8080`，执行 `node scripts/serve-static.mjs`
  - `deploy/start-with-log.cmd`（可选）
  - `deploy/README.md`：写明前置条件、启动步骤、访问地址、代理说明
  - 验证脚本可按需要保留/调整

不要把这些打进包：

- `.next/`、源码大目录（除非运行必需）
- `node_modules/`（体积大；改为在服务器 `npm ci --omit=dev` 或 `npm install --omit=dev`）
- `*.tar`、PDF、无关 zip

### 服务器启动约定

解压后在包根目录：

```bash
npm ci --omit=dev
# 或 npm install --omit=dev
PORT=3001 API_PROXY_TARGET=http://127.0.0.1:8080 node scripts/serve-static.mjs
```

Windows 可用 `deploy\start.cmd`。

约定：

- 前端监听 `0.0.0.0:3001`
- 后端在同机 `127.0.0.1:8080`
- 浏览器只访问前端 3001，接口走 `/api`、`/ws` 同源代理
- 测温截图 Windows 绝对路径由 `serve-static` 的 `/api/media/snapshot` 同机读文件（默认白名单 `D:\data\ladle`，可用 `SNAPSHOT_ALLOW_ROOTS` 调整）

### 验收

1. 本地构建成功，`out/` 存在
2. 用上述方式启动后，打开 `http://127.0.0.1:3001` 能进入钢包监测一级菜单（监控总览 / 实时监控 / 数据查询等）
3. 页面不应再走 mock；接口应打到代理目标后端（可用浏览器 Network 或现有 verify 脚本验证）
4. 输出：
   - zip 包路径
   - 构建命令
   - 启动命令
   - 简短部署说明（中文）

### 约束

- 只做钢包监测打包与必要的 script/deploy 文案改动，不做无关重构
- 不要提交/上传大二进制 tar
- 若构建失败，先修到可构建再打包

---

## 快速对照

| 项 | 值 |
|---|---|
| 构建命令核心 | `NEXT_PUBLIC_PRODUCT_MODE=ladle-recognition NEXT_PUBLIC_API_MOCK_MODE=off NEXT_PUBLIC_API_BASE_URL=/api NEXT_PUBLIC_WS_BASE_URL= next build` |
| 启动 | `node scripts/serve-static.mjs` |
| 端口 | `3001` |
| 后端代理 | `API_PROXY_TARGET=http://127.0.0.1:8080` |
| 参考 | `deploy/README.md`、`npm run build:trough:local-backend` |

## 常见调整

- 后端不是 `8080`：改 `API_PROXY_TARGET`
- 只要 mock 演示包：将 `NEXT_PUBLIC_API_MOCK_MODE=off` 改为 `mock`
