import React, { useState, useEffect } from 'react';
import { Loader2, ShieldCheck, Lock } from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';
import { Button, Input } from '../../components/ui/brand';

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
      <div className="min-h-screen bg-gradient-to-br from-[#3B5BFF] to-[#4F2FE6] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3B5BFF] to-[#4F2FE6] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#EAF1FF] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-[#3B5BFF]" />
          </div>
          <h1 className="text-xl font-semibold text-[#0F2A36] mb-1">Visadel Agency</h1>
          <p className="text-[#0F2A36]/60 text-sm">Вход в панель управления</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[#0F2A36] mb-2 font-medium">
              <Lock className="w-3.5 h-3.5 inline mr-1" />
              Пароль
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              autoComplete="current-password"
              required
              error={error || undefined}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={!password.trim()}
          >
            {loading ? 'Проверяем...' : 'Войти'}
          </Button>
        </form>
      </div>
    </div>
  );
};
