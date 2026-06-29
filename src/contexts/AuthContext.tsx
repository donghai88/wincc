'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

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
    // 路由保护逻辑
    if (!isLoading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/');
      }
    }
  }, [user, isLoading, pathname, router]);

  const login = (userData: User) => {
    localStorage.setItem('wincc_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('wincc_user');
    setUser(null);
    router.push('/login?logout=success');
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
