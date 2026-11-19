const BASE = '/api';

async function request(path, { signal } = {}) {
  const res = await fetch(`${BASE}${path}`, { signal, headers: { accept: 'application/json' } });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const error = new Error(payload?.error || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return payload;
}

const qs = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const api = {
  home: (opts) => request('/home', opts),
  genres: (opts) => request('/genres', opts),
  movies: (params = {}, opts) => request(`/movies${qs(params)}`, opts),
  movie: (id, opts) => request(`/movies/${encodeURIComponent(id)}`, opts),
  archiveMovie: (identifier, opts) => request(`/archive/movie/${encodeURIComponent(identifier)}`, opts),
  archiveSearch: (params = {}, opts) => request(`/archive/search${qs(params)}`, opts),
  health: (opts) => request('/health', opts),
};

export function isArchiveId(id) {
  return typeof id === 'string' && id.startsWith('archive:');
}

/** Loads a movie from the curated catalog or straight from the Archive. */
export async function loadMovie(id, opts) {
  if (isArchiveId(id)) {
    const { movie } = await api.archiveMovie(id.slice('archive:'.length), opts);
    return { movie, related: [] };
  }
  return api.movie(id, opts);
}

export function posterFor(movie) {
  return movie?.poster || movie?.thumbnail || '';
}

export function runtimeLabel(minutes) {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return `${hours}h ${String(rest).padStart(2, '0')}m`;
}
