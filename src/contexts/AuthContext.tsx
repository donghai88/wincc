'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  username: string;
  name: string;
  role: 'admin' | 'operator' | 'viewer';
  loginTime: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function currentPathname() {
  const path = window.location.pathname.replace(/\/$/, '');
  return path || '/';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 检查本地存储中的用户信息
    const storedUser = localStorage.getItem('wincc_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('wincc_user');
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // 静态导出场景下用硬跳转，避免 App Router soft nav 卡住「加载中」
    if (isLoading) return;
    const pathname = currentPathname();
    const onLogin = pathname === '/login';
    if (!user && !onLogin) {
      window.location.replace('/login');
    } else if (user && onLogin) {
      window.location.replace('/');
    }
  }, [user, isLoading]);

  const login = (userData: User) => {
    localStorage.setItem('wincc_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('wincc_user');
    setUser(null);
    window.location.replace('/login?logout=success');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
