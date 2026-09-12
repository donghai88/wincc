/**
 * 用内联登录页覆盖 out/login.html，避免静态部署时 Next chunk 加载失败导致无法登录。
 * 登录成功后写入与 AuthContext 相同的 localStorage key，再跳转首页。
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'out');
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>监控集成平台 | 登录</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #000; color: #e5e7eb; padding: 20px;
    }
    .card {
      width: 100%; max-width: 400px; background: #111827; border: 1px solid #1f2937;
      border-radius: 16px; overflow: hidden;
    }
    .head { padding: 40px 40px 32px; text-align: center; border-bottom: 1px solid #1f2937; }
    .logo {
      width: 56px; height: 56px; margin: 0 auto 20px; border-radius: 14px;
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      box-shadow: 0 8px 24px rgba(245, 158, 11, 0.25);
    }
    h1 { margin: 0; font-size: 22px; font-weight: 600; }
    p { margin: 8px 0 0; font-size: 13px; color: #9ca3af; }
    form { padding: 32px 40px 40px; }
    label { display: block; font-size: 12px; color: #d1d5db; margin-bottom: 8px; }
    input {
      width: 100%; height: 44px; margin-bottom: 16px; padding: 0 14px; border-radius: 8px;
      border: 1px solid #374151; background: #1f2937; color: #f9fafb; font-size: 14px; outline: none;
    }
    input:focus { border-color: #f59e0b; }
    button {
      width: 100%; height: 44px; margin-top: 8px; border: none; border-radius: 8px; cursor: pointer;
      color: #fff; font-size: 14px; font-weight: 500;
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }
    button:disabled { background: #6b7280; box-shadow: none; cursor: not-allowed; }
    .msg { display: none; margin-bottom: 16px; padding: 12px 14px; border-radius: 8px; font-size: 13px; }
    .msg.error { display: block; background: rgba(255,69,58,.1); color: #ff453a; }
    .msg.ok { display: block; background: rgba(52,199,89,.1); color: #34c759; }
  </style>
</head>
<body>
  <div class="card">
    <div class="head">
      <div class="logo"></div>
      <h1>监控集成平台</h1>
      <p>钢铁冶金监控系统</p>
    </div>
    <form id="loginForm" action="javascript:void(0)">
      <div id="msg" class="msg"></div>
      <label for="username">用户名</label>
      <input id="username" autocomplete="username" placeholder="请输入用户名" required />
      <label for="password">密码</label>
      <input id="password" type="password" autocomplete="current-password" placeholder="请输入密码" required />
      <button id="submitBtn" type="button">登 录</button>
    </form>
  </div>
  <script>
    (function () {
      var users = {
        admin: { password: 'admin123', name: '管理员', role: 'admin' },
        operator: { password: 'op123', name: '操作员', role: 'operator' },
        viewer: { password: 'view123', name: '观察员', role: 'viewer' }
      };
      var msg = document.getElementById('msg');
      var btn = document.getElementById('submitBtn');

      function show(type, text) {
        msg.className = 'msg ' + type;
        msg.textContent = text;
      }

      function doLogin() {
        var username = document.getElementById('username').value.trim();
        var password = document.getElementById('password').value;
        var user = users[username];
        if (!user || user.password !== password) {
          show('error', '用户名或密码错误');
          return;
        }
        btn.disabled = true;
        show('ok', '欢迎回来，' + user.name + '！正在跳转...');
        var payload = {
          username: username,
          name: user.name,
          role: user.role,
          loginTime: new Date().toISOString()
        };
        try {
          localStorage.setItem('wincc_user', JSON.stringify(payload));
        } catch (e) {}
        setTimeout(function () {
          window.location.replace('/');
        }, 400);
      }

      btn.addEventListener('click', doLogin);
      document.getElementById('password').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doLogin();
      });
      document.getElementById('username').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doLogin();
      });

      if (/[?&]logout=success/.test(window.location.search)) {
        show('ok', '您已安全退出登录');
        history.replaceState({}, '', '/login');
      }
    })();
  </script>
</body>
</html>
`;

if (!existsSync(outDir)) {
  console.error(`out 不存在: ${outDir}`);
  process.exit(1);
}

writeFileSync(resolve(outDir, 'login.html'), html, 'utf8');
const loginDir = resolve(outDir, 'login');
mkdirSync(loginDir, { recursive: true });
writeFileSync(resolve(loginDir, 'index.html'), html, 'utf8');
console.log('已写入独立登录页: out/login.html');
