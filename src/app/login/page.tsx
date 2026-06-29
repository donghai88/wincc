'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Flame, User, Lock, Eye, EyeOff, AlertCircle, CheckCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// 模拟用户数据
const mockUsers = [
  { username: 'admin', password: 'admin123', name: '管理员', role: 'admin' as const },
  { username: 'operator', password: 'op123', name: '操作员', role: 'operator' as const },
  { username: 'viewer', password: 'view123', name: '观察员', role: 'viewer' as const },
];

export default function LoginPage() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logoutMessage, setLogoutMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 检查是否是登出后跳转
  useEffect(() => {
    if (searchParams.get('logout') === 'success') {
      setLogoutMessage('您已安全退出登录');
      // 清除 URL 参数
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLogoutMessage('');
    setIsLoading(true);

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 800));

    const user = mockUsers.find(
      u => u.username === username && u.password === password
    );

    if (user) {
      // 显示成功提示
      setSuccess(`欢迎回来，${user.name}！正在跳转...`);

      // 延迟后跳转
      setTimeout(() => {
        login({
          username: user.username,
          name: user.name,
          role: user.role,
          loginTime: new Date().toISOString(),
        });
      }, 800);
    } else {
      setError('用户名或密码错误');
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--background)',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--surface)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '40px 40px 32px',
            textAlign: 'center',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 8px 24px rgba(245, 158, 11, 0.25)',
            }}
          >
            <Flame size={28} color="#fff" />
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            监控集成平台
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-tertiary)',
              margin: '8px 0 0',
            }}
          >
            钢铁冶金监控系统
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '32px 40px 40px' }}>
          {/* Logout Message */}
          {logoutMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 14px',
                background: 'rgba(99, 102, 241, 0.1)',
                borderRadius: 8,
                marginBottom: 20,
              }}
            >
              <LogOut size={16} color="#6366f1" />
              <span style={{ fontSize: 13, color: '#6366f1' }}>
                {logoutMessage}
              </span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 14px',
                background: 'rgba(255, 69, 58, 0.1)',
                borderRadius: 8,
                marginBottom: 20,
              }}
            >
              <AlertCircle size={16} color="var(--status-error)" />
              <span style={{ fontSize: 13, color: 'var(--status-error)' }}>
                {error}
              </span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 14px',
                background: 'rgba(48, 209, 88, 0.1)',
                borderRadius: 8,
                marginBottom: 20,
              }}
            >
              <CheckCircle size={16} color="var(--status-online)" />
              <span style={{ fontSize: 13, color: 'var(--status-online)' }}>
                {success}
              </span>
            </div>
          )}

          {/* Username */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 8,
              }}
            >
              用户名
            </label>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <User
                size={16}
                style={{
                  position: 'absolute',
                  left: 14,
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                required
                style={{
                  width: '100%',
                  height: 44,
                  padding: '0 14px 0 42px',
                  fontSize: 14,
                  color: 'var(--text-primary)',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  outline: 'none',
                  transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 8,
              }}
            >
              密码
            </label>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: 14,
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                style={{
                  width: '100%',
                  height: 44,
                  padding: '0 42px',
                  fontSize: 14,
                  color: 'var(--text-primary)',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  outline: 'none',
                  transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 14,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              height: 44,
              background: isLoading
                ? 'var(--text-muted)'
                : 'linear-gradient(135deg, #f59e0b, #ef4444)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              borderRadius: 8,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
              boxShadow: isLoading ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.3)',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = isLoading ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.3)';
            }}
          >
            {isLoading ? '登录中...' : '登 录'}
          </button>

          {/* Demo Accounts */}
          <div
            style={{
              marginTop: 24,
              padding: '16px',
              background: 'var(--surface-raised)',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                marginBottom: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              演示账号
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div>管理员: admin / admin123</div>
              <div>操作员: operator / op123</div>
              <div>观察员: viewer / view123</div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
