import React, { useState, useEffect } from 'react';
import { Loader2, ShieldCheck, Lock } from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';

export const AdminLogin: React.FC = () => {
  const { login, loginWithTelegram } = useAdmin();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tgChecked, setTgChecked] = useState(false);

  // Try Telegram auto-login on mount
  useEffect(() => {
    loginWithTelegram().then(success => {
      if (!success) setTgChecked(true);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setError('');
    setLoading(true);
    const result = await login(password);
    if (!result.success) {
      setError(result.error ?? 'Неверный пароль');
    }
    setLoading(false);
  };

  if (!tgChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2196F3] to-[#1565C0] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2196F3] to-[#1565C0] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-[#2196F3]" />
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-1">Visadel Agency</h1>
          <p className="text-gray-500 text-sm">Вход в панель управления</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-2 font-medium">
              <Lock className="w-3.5 h-3.5 inline mr-1" />
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2196F3] focus:border-transparent"
              placeholder="Введите пароль"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full bg-[#2196F3] hover:bg-[#1E88E5] disabled:opacity-60 text-white py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Проверяем...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
};
