import './config.js';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { csrfGuard, loadUser } from './auth.js';
import { pub } from './routes/public.js';
import { student } from './routes/student.js';
import { staff } from './routes/staff.js';
import { migrate } from './migrate.js';
import { q } from './db.js';

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"], connectSrc: ["'self'"], frameAncestors: ["'none'"], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: config.cookieSecure ? { maxAge: 15552000 } : false,
}));

const base = config.basePath;
const api = express.Router();
api.use(express.json({ limit: '32kb' }));
api.use(cookieParser());
api.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
api.use(loadUser);
api.use(csrfGuard);
api.use(pub);
api.use((req, res, next) => (req.path.startsWith('/staff/') ? staff(req, res, next) : student(req, res, next)));
api.use((_req, res) => res.status(404).json({ error: 'Не найдено' }));
api.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.status === 404) return res.status(404).json({ error: 'Не найдено' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Неверный формат запроса' });
  console.error(err);
  res.status(500).json({ error: 'Что-то пошло не так. Мы уже разбираемся.' });
});
app.use(`${base}/api`, api);

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = [path.join(here, 'client'), path.join(here, '../dist/client')].find((p) => fs.existsSync(path.join(p, 'index.html')));
if (clientDir) {
  app.use(base || '/', express.static(clientDir, { index: false, maxAge: '30d', immutable: true, setHeaders: (res, p) => { if (p.endsWith('.html') || p.endsWith('sw.js') || p.endsWith('.webmanifest')) res.setHeader('Cache-Control', 'no-cache'); } }));
  const cached = fs.readFileSync(path.join(clientDir, 'index.html'), 'utf8');
  const html = () => (config.env === 'production' ? cached : fs.readFileSync(path.join(clientDir, 'index.html'), 'utf8'));
  app.get(`${base}/assets/{*rest}`, (_req, res) => res.status(404).type('text').send('Not found'));
  app.get(`${base}{/*rest}`, (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.type('html').send(html()); });
}
if (base) app.get('/', (_req, res) => res.redirect(base + '/'));

setInterval(() => { q(`DELETE FROM sessions WHERE expires_at < now()`).catch(() => {}); q(`DELETE FROM login_attempts WHERE at < now() - interval '1 day'`).catch(() => {}); }, 3_600_000).unref();

migrate().then(() => {
  app.listen(config.port, config.host, () => console.log(`Stellar Деканат: http://${config.host}:${config.port}${base}/`));
}).catch((e) => { console.error('migration failed', e); process.exit(1); });
