// Обёртка над fetch для своих API эндпоинтов: автоматически прикладывает
// Authorization: tma <initData> чтобы серверный verifyInitData() мог
// удостоверить пользователя без того, чтобы клиент слал telegram_id в body.
//
// Все запросы к /api/* должны идти через это.

interface TelegramWebApp {
  initData?: string;
}

function getTelegramInitData(): string | null {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
    return tg?.initData && tg.initData.length > 0 ? tg.initData : null;
  } catch { return null; }
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const initData = getTelegramInitData();
  const headers = new Headers(init?.headers);
  if (initData) {
    headers.set('Authorization', `tma ${initData}`);
    // Дублируем в кастомный заголовок: некоторые WebView-прокси могут резать Authorization
    headers.set('X-Telegram-Init-Data', initData);
  }
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers });
}

// JSON-обёртка с типизированным телом и парсингом ответа
export async function apiPost<TReq, TRes = unknown>(url: string, body: TReq): Promise<TRes> {
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string }).error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as TRes;
}
