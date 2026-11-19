/**
 * OpenReel server: JSON API + static client on 0.0.0.0:$PORT.
 */
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { catalogMeta, getMovie, homeRows, listGenres, listMovies } from './catalog.js';
import { resolveArchiveItem, searchArchive } from './archive.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'dist');
const indexHtml = resolve(dist, 'index.html');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, catalog: catalogMeta, uptimeSeconds: Math.round(process.uptime()) });
});

app.get('/api/home', (req, res) => {
  res.json(homeRows());
});

app.get('/api/genres', (req, res) => {
  res.json({ genres: listGenres() });
});

app.get('/api/movies', (req, res) => {
  const { q = '', genre = '', decade = '', sort = 'featured', limit = '60' } = req.query;
  const movies = listMovies({ q, genre, decade, sort, limit });
  res.json({ count: movies.length, movies });
});

app.get('/api/movies/:id', (req, res) => {
  const movie = getMovie(req.params.id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });
  const related = listMovies({ genre: movie.genres[0], limit: 7 }).filter((item) => item.id !== movie.id).slice(0, 6);
  return res.json({ movie, related });
});

app.get(
  '/api/archive/search',
  wrap(async (req, res) => {
    const q = String(req.query.q ?? '').slice(0, 120);
    const collection = req.query.collection ? String(req.query.collection).slice(0, 60) : '';
    if (!q && !collection) {
      return res.status(400).json({ error: 'Provide ?q= or ?collection=' });
    }
    try {
      const results = await searchArchive({ query: q, collection, rows: Number(req.query.limit) || 24 });
      return res.json({ count: results.length, results });
    } catch (err) {
      return res.status(503).json({ error: 'The Internet Archive search is unavailable right now', detail: err.message });
    }
  }),
);

app.get(
  '/api/archive/movie/:identifier',
  wrap(async (req, res) => {
    try {
      const movie = await resolveArchiveItem(req.params.identifier);
      return res.json({ movie });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  }),
);

app.use(
  express.static(dist, {
    index: false,
    setHeaders(res, path) {
      if (/\.(js|css|woff2?|svg|png|jpg|webp)$/.test(path)) {
        res.setHeader('cache-control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

// Client-side routing fallback (Express 5: no bare "*" path patterns).
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/')) return next();
  if (!existsSync(indexHtml)) {
    return res.status(503).type('text/plain').send('Client build missing — run `npm run build` first.');
  }
  return res.sendFile(indexHtml);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('[server]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`OpenReel listening on http://0.0.0.0:${port} (${catalogMeta.total} films in catalog)`);
});
