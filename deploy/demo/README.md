# 监控集成平台 · 演示部署包

本包仅用于演示：全部数据为本地模拟数据，不连接任何后端、数据库、相机或雷达。
包含铁水沟、山西钢包、本溪钢包（实时监控 / 雷达渣线 / 钢包报表 / 数据查询 / 曲线分析 / 报警管理 / 钢包管理）全部功能。

## 前置条件

- Node.js 18 或更高版本（推荐 22 LTS），只需安装一次，无需 npm install
  - Windows：从 https://nodejs.org/ 下载 Windows Installer（.msi），一路默认安装即可；安装后需重新打开命令行窗口
  - 验证：命令行执行 `node -v` 能输出版本号
- 浏览器：Chrome / Edge 最新版（雷达点云需要 WebGL）
- 其他电脑访问时，需放通演示机 3001 端口（或自定义端口）

## 启动

Windows（临时演示）：解压后双击 `start-demo.cmd`，服务就绪后会自动打开浏览器；命令行窗口需保持开启，关闭窗口服务即停止。长期演示请使用下方“后台运行 + 开机自启”。
首次运行若弹出 Windows 防火墙提示，请勾选“允许访问”（仅本机演示可直接取消）。

> 注意：必须通过 `http://127.0.0.1:3001` 访问，不能直接双击 `out\index.html`（地址栏显示 `E:/...` 的文件路径会一直停在“加载中”）。

Linux / macOS：

```bash
tar -xzf ruihai-demo-*.tar.gz
cd ruihai-demo-*
sh start-demo.sh
```

浏览器访问 `http://<服务器IP>:3001`，登录账号 `admin / admin123`。

修改端口：Windows 执行 `set PORT=8088 && start-demo.cmd`；Linux 执行 `PORT=8088 sh start-demo.sh`。

## Windows 后台运行 + 开机自启（推荐长期演示）

| 脚本 | 作用 |
| --- | --- |
| `install-autostart.cmd` | 注册开机自启并立即在后台启动，放通防火墙 3001 端口，完成后自动打开浏览器 |
| `demo-control.cmd` | 手动启动 / 停止 / 查看状态（双击后按菜单选择） |
| `uninstall-autostart.cmd` | 停止服务，并移除开机自启和防火墙规则 |

- 双击后会弹出管理员权限确认，选“是”。
- 安装后服务以系统账户在后台运行：没有命令行窗口，服务器开机即启动（无需登录），进程意外退出 1 分钟内自动重启。
- 运行日志：`logs\demo.log`。
- 更新演示包：先运行 `uninstall-autostart.cmd`，覆盖文件后再运行 `install-autostart.cmd`。
- 演示包目录移动位置后，需要重新运行 `install-autostart.cmd`。
- 使用其他端口：在命令行执行 `set PORT=8088 && install-autostart.cmd`。
- 安装了开机自启后不要再同时双击 `start-demo.cmd`，否则会提示端口已被占用。

## Linux 后台常驻（可选）

```bash
nohup sh start-demo.sh > demo.log 2>&1 &
```

或使用 pm2：`pm2 start scripts/serve-demo.mjs --name ruihai-demo`。

## 使用 nginx 托管（可选，不需要 Node）

`out/` 是纯静态目录，可直接交给 nginx：

```nginx
server {
    listen 3001;
    root /opt/ruihai-demo/out;
    location / {
        try_files $uri $uri.html $uri/ /index.html;
    }
    location /_next/static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    types { application/octet-stream pcd; }
}
```

## 说明

- 雷达渣线页首次打开会加载约 89MB 的演示点云文件，内网首次约数秒，之后由浏览器缓存。
- 演示期间新增 / 修改 / 处理的数据只保存在当前浏览器页面中，刷新后恢复初始演示数据。
- 本包与现场正式版界面一致，请勿与正式环境混用同一地址。
