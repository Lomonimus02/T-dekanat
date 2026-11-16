export const BASE = '/dekanat';

export class ApiError extends Error {
  constructor(public status: number, message: string, public field?: string) { super(message); }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method: opts.method ?? 'GET',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'stellar', ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Нет связи с сервером. Проверьте интернет.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new CustomEvent('auth:lost'));
    throw new ApiError(res.status, data?.error ?? 'Ошибка запроса', data?.field);
  }
  return data as T;
}
