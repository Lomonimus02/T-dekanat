function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Не задана переменная окружения ${name} (см. .env.example)`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4520),
  host: process.env.HOST ?? '127.0.0.1',
  basePath: (process.env.BASE_PATH ?? '/dekanat').replace(/\/$/, ''),
  databaseUrl: req('DATABASE_URL'),
  sessionSecret: req('SESSION_SECRET'),
  dataKey: req('DATA_KEY'),
  trustProxy: process.env.TRUST_PROXY === '1',
  cookieSecure: process.env.COOKIE_SECURE === '1',
  sessionDays: 7,
};

process.env.TZ = process.env.TZ ?? 'Europe/Moscow';
