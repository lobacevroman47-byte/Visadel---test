import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getAppSettings, getAdditionalServices,
  type AppSettings, type AdditionalService,
} from '../lib/db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Контекст глобального каталога: app_settings + additional_services.
// Данные стянуты ОДИН раз при mount root-провайдера, кешируются на время
// сессии. Многие места раньше дублировали эти fetch'и (Home, ApplicationForm,
// BookingsMenu, Step2AdditionalDocs, Step7Payment, формы броней) — суммарно
// 6+ независимых запросов на одну загрузку. Теперь — один.
//
// `revalidate()` дёргает источники заново — для админки после save'ов.

interface AppCatalogValue {
  settings: AppSettings | null;
  services: AdditionalService[];
  loading: boolean;
  revalidate: () => Promise<void>;
}

const noop = async () => { /* no-op */ };

export const AppCatalogContext = createContext<AppCatalogValue>({
  settings: null,
  services: [],
  loading: true,
  revalidate: noop,
});

export const AppCatalogProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [services, setServices] = useState<AdditionalService[]>([]);
  const [loading, setLoading] = useState(true);

  const revalidate = async () => {
    try {
      const [s, srv] = await Promise.all([getAppSettings(), getAdditionalServices()]);
      setSettings(s);
      setServices(srv);
    } catch (e) {
      console.warn('[AppCatalog] revalidate error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void revalidate(); }, []);

  // Real-time подписка на изменения каталога. Когда админ в одном
  // окне меняет цену услуги или поля app_settings — клиенты во всех
  // других открытых мини-аппах через 1-2 сек видят новую цену без
  // ручного refresh. Требует включённую Realtime на таблицах в
  // Supabase Dashboard → Replication → Set up Realtime.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const channel = supabase
      .channel('catalog-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'additional_services' },
        () => { void revalidate(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' },
        () => { void revalidate(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visa_products' },
        () => { void revalidate(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  return (
    <AppCatalogContext.Provider value={{ settings, services, loading, revalidate }}>
      {children}
    </AppCatalogContext.Provider>
  );
};

export const useAppCatalog = (): AppCatalogValue => useContext(AppCatalogContext);

// Узкие селекторы — удобнее чем тащить весь объект.
export function useAdditionalService(id: string): AdditionalService | null {
  const { services } = useAppCatalog();
  return services.find(s => s.id === id) ?? null;
}
