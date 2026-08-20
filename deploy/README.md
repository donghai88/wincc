# 铁水沟前端部署包（真实 API）

此包面向 Windows 测试服务器。前端由 Node.js 提供静态文件，并把浏览器的 `/api/*` 与 `/ws/*` 请求转发到同一台服务器的 `http://127.0.0.1:8080`。

## 前置条件

- Node.js 18 或更高版本（测试机已有 Node.js 22 可直接使用）
- Java 后端已启动并监听 `127.0.0.1:8080`
- 浏览器可访问测试服务器的 `3001` 端口；若从其他机器访问，请放通该端口

## 启动

1. 将 ZIP 解压到例如 `E:\project\ruihai_steel_frontend`。
2. 在解压目录中双击 `deploy\start.cmd`，或执行：

   ```bat
   deploy\start.cmd
   ```

3. 浏览器打开 `http://127.0.0.1:3001`。

若需留存排查日志，请改用 `deploy\start-with-log.cmd`。运行日志写入 `logs\frontend.log`；HTTP 请求日志包含方法、路径、状态码与耗时，代理故障会记录为 `[proxy]`。

## 一键验证

在前端启动后执行：

```bat
deploy\verify-deployment.cmd
```

脚本会检查：

- 后端 `8080` 的设备与告警接口；
- 前端 `3001` 静态页面；
- 前端 `/api` 到后端的反向代理；
- `/ws/modbus` 与 `/ws/business/alarm` 的 WebSocket 代理。

如果后端当前没有启动 WebSocket 服务，可先跳过 WebSocket 检查：

```bat
deploy\verify-deployment.cmd -SkipWebSocket
```

## 说明

- 此版本在构建时已经固定为真实 API 模式：不使用 Mock 数据。
- 本机访问后端使用 `127.0.0.1:8080`；不需要浏览器直接访问 8080，也不会受跨域限制。
- 关闭启动窗口或在窗口中按 `Ctrl+C` 可停止前端服务。
