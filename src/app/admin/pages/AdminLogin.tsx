import React, { useState } from 'react';
import { useAdmin } from '../contexts/AdminContext';

export const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAdmin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const success = login(email, password);
    if (!success) {
      setError('Неверный логин или пароль');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2196F3] to-[#1565C0] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-[#2196F3] mb-2">Visadel Agency</h1>
          <p className="text-gray-600">Вход в админ-панель</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3] focus:border-transparent"
              placeholder="admin@visadel.agency"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-gray-700 mb-2">
              Пароль
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2196F3] focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-[#2196F3] hover:bg-[#1E88E5] text-white py-3 rounded-lg transition-colors"
          >
            Войти
          </button>
        </form>

        {/* Demo credentials hint */}
        <div className="mt-6 p-4 bg-[#F5F7FA] rounded-lg">
          <p className="text-xs text-gray-600 mb-2">Демо-доступы:</p>
          <div className="space-y-1 text-xs text-gray-700">
            <p>Owner: owner@visadel.agency / owner123</p>
            <p>Admin: admin@visadel.agency / admin123</p>
            <p>Manager: manager@visadel.agency / manager123</p>
          </div>
        </div>
      </div>
    </div>
  );
};
