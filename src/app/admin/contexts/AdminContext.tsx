import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'owner' | 'admin' | 'manager';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  telegram: string;
  role: UserRole;
}

interface AdminContextType {
  currentUser: AdminUser | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
  onBackToApp?: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

// Mock users for demonstration
const MOCK_USERS: Array<AdminUser & { password: string }> = [
  {
    id: '1',
    name: 'Владелец',
    email: 'owner@visadel.agency',
    telegram: '@owner',
    role: 'owner',
    password: 'owner123'
  },
  {
    id: '2',
    name: 'Администратор',
    email: 'admin@visadel.agency',
    telegram: '@admin',
    role: 'admin',
    password: 'admin123'
  },
  {
    id: '3',
    name: 'Менеджер',
    email: 'manager@visadel.agency',
    telegram: '@manager',
    role: 'manager',
    password: 'manager123'
  }
];

const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 3,
  admin: 2,
  manager: 1
};

export const AdminProvider: React.FC<{ children: ReactNode; onBackToApp?: () => void }> = ({ children, onBackToApp }) => {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    const saved = localStorage.getItem('adminUser');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (email: string, password: string): boolean => {
    const user = MOCK_USERS.find(u => u.email === email && u.password === password);
    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      setCurrentUser(userWithoutPassword);
      localStorage.setItem('adminUser', JSON.stringify(userWithoutPassword));
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('adminUser');
    if (onBackToApp) {
      onBackToApp();
    }
  };

  const hasPermission = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!currentUser) return false;
    
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const userLevel = ROLE_HIERARCHY[currentUser.role];
    
    return requiredRoles.some(role => userLevel >= ROLE_HIERARCHY[role]);
  };

  return (
    <AdminContext.Provider value={{ currentUser, login, logout, hasPermission, onBackToApp }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};