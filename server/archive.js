/**
 * Thin, cached client for the Internet Archive.
 *
 * The Archive hosts tens of thousands of freely available films. We only ever
 * surface items that expose a real, downloadable video derivative, and we hand
 * the browser a direct stream URL so playback is range-request friendly.
 */
const UA = 'OpenReel/1.0 (+https://appjet.dev)';
const VIDEO_FORMATS =
  /^(h\.264|h\.264 ia|mpeg4|512kb mpeg4|mpeg2|ogg video|matroska|windows media|divx|quicktime|webm)$/i;
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

export function stripHtml(input) {
  if (!input) return '';
  const text = Array.isArray(input) ? input.join(' ') : String(input);
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function clip(text, max) {
  if (!text || text.length <= max) return text || '';
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '));
  return `${cut.slice(0, stop > max * 0.6 ? stop : max).trim()}…`;
}

export function pickVideoFile(files) {
  return (
    (files || [])
      .filter((file) => file && typeof file.name === 'string')
      .filter((file) => /\.(mp4|m4v|webm|ogv)$/i.test(file.name))
      .filter(
        (file) =>
          VIDEO_FORMATS.test(String(file.format || '').trim()) || /\.(mp4|m4v|webm)$/i.test(file.name),
      )
      .filter((file) => Number(file.size || 0) > 8 * 1024 * 1024)
      .sort((a, b) => Number(b.size || 0) - Number(a.size || 0))[0] ?? null
  );
}

export function buildStreamUrl(identifier, fileName) {
  const encoded = String(fileName)
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encoded}`;
}

async function getJson(url, timeoutMs = 15000) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`archive responded ${res.status}`);
  return res.json();
}

function remember(key, value) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  if (cache.size > 500) {
    for (const [entryKey, entry] of cache) {
      if (entry.expires < Date.now()) cache.delete(entryKey);
    }
  }
  return value;
}

function recall(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

/** Full-text search restricted to movies. Returns lightweight result cards. */
export async function searchArchive({ query, collection, sort = 'downloads desc', rows = 24 }) {
  const trimmed = String(query || '').trim();
  const clauses = ['mediatype:movies'];
  if (trimmed) {
    const safe = trimmed.replace(/["\\]/g, ' ').slice(0, 120);
    clauses.push(`(title:("${safe}") OR description:("${safe}"))`);
  }
  if (collection) clauses.push(`collection:(${collection})`);

  const key = `search:${clauses.join('|')}:${sort}:${rows}`;
  const cached = recall(key);
  if (cached) return cached;

  const params = new URLSearchParams();
  params.set('q', clauses.join(' AND '));
  for (const field of ['identifier', 'title', 'year', 'description', 'downloads', 'avg_rating']) {
    params.append('fl[]', field);
  }
  params.append('sort[]', sort);
  params.set('rows', String(Math.min(Math.max(rows, 1), 48)));
  params.set('page', '1');
  params.set('output', 'json');

  const data = await getJson(`https://archive.org/advancedsearch.php?${params}`, 12000);
  const docs = data?.response?.docs ?? [];
  return remember(
    key,
    docs
      .filter((doc) => doc?.identifier)
      .map((doc) => ({
        identifier: doc.identifier,
        title: stripHtml(doc.title) || doc.identifier,
        year: Number(doc.year) || null,
        synopsis: clip(stripHtml(doc.description), 220),
        poster: `https://archive.org/services/img/${doc.identifier}`,
        downloads: Number(doc.downloads) || 0,
        rating: Number(doc.avg_rating) || null,
        source: 'Internet Archive',
      })),
  );
}

/** Resolve one Archive identifier into a playable movie record. */
export async function resolveArchiveItem(identifier) {
  const key = `item:${identifier}`;
  const cached = recall(key);
  if (cached) return cached;

  const meta = await getJson(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, 15000);
  if (!meta || meta.is_dark) throw new Error('This item is not publicly available');

  const video = pickVideoFile(meta.files);
  if (!video) throw new Error('No playable video file for this item');

  const metadata = meta.metadata ?? {};
  const runtimeSeconds = Number(video.length || 0) || null;
  const record = {
    id: `archive:${identifier}`,
    identifier,
    title: stripHtml(metadata.title) || identifier,
    year: Number(metadata.year) || null,
    tagline: '',
    synopsis: clip(stripHtml(metadata.description), 900),
    director: stripHtml(metadata.director) || null,
    cast: stripHtml(metadata.creator) || null,
    runtimeMinutes: runtimeSeconds ? Math.round(runtimeSeconds / 60) : null,
    poster: `https://archive.org/services/img/${identifier}`,
    streamUrl: buildStreamUrl(identifier, video.name),
    archivePage: `https://archive.org/details/${identifier}`,
    source: 'Internet Archive',
    sizeBytes: Number(video.size) || null,
    genres: ['Archive'],
    featured: false,
  };
  return remember(key, record);
}
