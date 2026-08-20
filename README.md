This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Docker 部署

`docker:build` 会先在构建机执行 `next build`，再将生成的静态 `out/` 封入镜像。最终镜像仅包含静态导出产物和 Nginx；运行容器不依赖源码、Node.js 或任何构建工具。

```bash
# 完整平台
npm run docker:build
docker run --rm -p 3001:8080 wincc:latest

# 只展示铁水沟模块
npm run docker:build:trough
docker run --rm -p 3001:8080 wincc:trough

# 铁水沟：真实后端为本机 8080 端口，禁用所有 mock/fallback 数据
npm run docker:build:trough:local-backend
docker run --rm --add-host=host.docker.internal:host-gateway -p 3001:8080 wincc:trough-local-backend

# 只展示钢包识别模块
npm run docker:build:ladle-recognition
docker run --rm -p 3001:8080 wincc:ladle-recognition
```

容器监听 `8080`，上述命令会映射为本机的 `http://localhost:3001`。`NEXT_PUBLIC_*` 配置会在镜像构建时写入前端产物；变更这些配置后需要重新构建镜像。

`build:trough:local-backend` 固定构建为铁水沟单模块，并写入 `NEXT_PUBLIC_API_MOCK_MODE=off`，不会使用 mock 或在接口失败时回退为 mock 数据。镜像通过 Nginx 将浏览器的同源 `/api/*` 和 `/ws/*` 请求代理到测试服务器宿主机的 `localhost:8080`；`--add-host=host.docker.internal:host-gateway` 是 Linux Docker 容器访问宿主机服务所必需的参数。这样外部浏览器不会把 `localhost:8080` 误解为访问者自己的电脑。

镜像将 Nginx 访问日志和错误日志输出到标准输出/错误流，可在测试服务器执行 `docker logs -f <容器名>` 排查静态文件 404、接口状态码和请求耗时。

## 真实接口全链路冒烟测试

脚本会在真实浏览器中登录页面，依次验证设备实时数据、温度趋势、告警分页/统计、周报查询/下载，以及两个铁水沟 WebSocket 连接。测试结果和失败截图会保存到 `output/e2e-api-smoke/`。

```bash
npx playwright install chromium
E2E_BASE_URL=http://测试服务器IP:3001 npm run test:e2e:api
```

Windows CMD：

```cmd
set E2E_BASE_URL=http://测试服务器IP:3001 && npm run test:e2e:api
```

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
