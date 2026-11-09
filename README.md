This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 分支

本分支 `product/ladle-recognition` 默认只呈现山西钢包识别：热成像为主，雷达渣线和钢包报表关闭。其它模块源码仍保留，共享修复从 `product/integrated` 合并。`npm run dev` 和 `npm run build` 已固定为该版本。

## 本地启动

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:3001。

## 构建与 Docker

`docker:build` 先执行本分支的构建，再将静态 `out/` 封入镜像。镜像只含静态产物和 Nginx。

```bash
npm run docker:build
docker run --rm -p 3001:8080 wincc:ladle-recognition

# 真实后端为本机 8080，禁用 mock
npm run docker:build:local-backend
docker run --rm --add-host=host.docker.internal:host-gateway -p 3001:8080 wincc:ladle-recognition-local-backend
```

容器监听 `8080`，映射为本机 `http://localhost:3001`。`NEXT_PUBLIC_*` 在构建时写入前端产物，变更后需要重新构建。

`build:local-backend` 写入 `NEXT_PUBLIC_API_MOCK_MODE=off`。镜像通过 Nginx 将同源 `/api/*` 和 `/ws/*` 代理到宿主机 `localhost:8080`。Linux 上需要 `--add-host=host.docker.internal:host-gateway`。现场包使用 `Dockerfile.serve-static`。

## 钢包监测冒烟测试

默认按 Mock UI 验收实时监控、数据查询（含导出）、曲线分析、报警管理、钢包管理。结果保存到 `output/e2e-ladle-smoke/`。

```bash
npm run dev
# 另一终端
npx playwright install chromium
E2E_BASE_URL=http://127.0.0.1:3001 npm run test:e2e:ladle
```

对接真实后端时可附加 `E2E_EXPECT_API=true`，脚本会额外等待 `/ladle-record/list`、`/ladle-chart/list`、`/alarm/page`、`/ladle/list` 等接口响应。
## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
