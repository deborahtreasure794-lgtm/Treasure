/**
 * Catalog over the curated OpenReel library (server/data/movies.json).
 * Every record was verified to have a real, playable video file.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const DATA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'data/movies.json');

let catalog = { generatedAt: null, movies: [] };
try {
  catalog = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
} catch {
  console.warn('[catalog] no catalog data found — run `npm run catalog` to build it');
}

const movies = (catalog.movies ?? []).map((movie) => ({ ...movie, id: movie.id ?? movie.archiveIdentifier }));
const byId = new Map(movies.map((movie) => [movie.id, movie]));

const GENRE_ORDER = [
  'Horror',
  'Noir',
  'Sci-Fi',
  'Comedy',
  'Thriller',
  'Drama',
  'Silent',
  'Mystery',
  'Crime',
  'Romance',
  'Fantasy',
  'Animation',
  'Family',
  'Action',
  'Adventure',
  'History',
  'Cult',
  'Short',
];

export const catalogMeta = {
  generatedAt: catalog.generatedAt ?? null,
  source: catalog.source ?? 'Internet Archive',
  total: movies.length,
};

function haystack(movie) {
  return `${movie.title} ${movie.year} ${movie.genres.join(' ')} ${movie.tagline} ${movie.synopsis} ${
    movie.director ?? ''
  } ${movie.cast ?? ''}`.toLowerCase();
}

const searchIndex = new Map(movies.map((movie) => [movie.id, haystack(movie)]));

function score(movie, terms) {
  const index = searchIndex.get(movie.id) ?? '';
  const title = movie.title.toLowerCase();
  let total = 0;
  for (const term of terms) {
    if (title.startsWith(term)) total += 12;
    else if (title.includes(term)) total += 8;
    else if (index.includes(term)) total += 3;
    else return -1;
  }
  return total + (movie.featured ? 1 : 0);
}

export function listMovies({ q = '', genre = '', decade = '', sort = 'featured', limit = 60 } = {}) {
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  let result = movies.slice();

  if (genre) {
    result = result.filter((movie) => movie.genres.some((g) => g.toLowerCase() === String(genre).toLowerCase()));
  }
  if (decade) {
    const start = Number(String(decade).replace(/s$/, ''));
    if (Number.isFinite(start)) {
      result = result.filter((movie) => movie.year >= start && movie.year < start + 10);
    }
  }
  if (terms.length) {
    result = result
      .map((movie) => ({ movie, rank: score(movie, terms) }))
      .filter((entry) => entry.rank >= 0)
      .sort((a, b) => b.rank - a.rank || a.movie.title.localeCompare(b.movie.title))
      .map((entry) => entry.movie);
  } else {
    result.sort((a, b) => {
      if (sort === 'year-desc') return b.year - a.year;
      if (sort === 'year-asc') return a.year - b.year;
      if (sort === 'title') return a.title.localeCompare(b.title);
      return Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title);
    });
  }

  const max = Math.min(Math.max(Number(limit) || 60, 1), 200);
  return result.slice(0, max);
}

export function getMovie(id) {
  return byId.get(id) ?? null;
}

export function listGenres() {
  const counts = new Map();
  for (const movie of movies) {
    for (const genre of movie.genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (GENRE_ORDER.indexOf(a.name) + 1 || 99) - (GENRE_ORDER.indexOf(b.name) + 1 || 99) || b.count - a.count);
}

export function homeRows() {
  const row = (title, items) => ({ title, items });
  const featured = movies.filter((movie) => movie.featured).slice(0, 5);
  return {
    hero: featured[0] ?? movies[0] ?? null,
    rows: [
      row('Essential viewing', listMovies({ sort: 'featured', limit: 18 })),
      row('Horror after dark', listMovies({ genre: 'Horror', limit: 18 })),
      row('Film noir', listMovies({ genre: 'Noir', limit: 18 })),
      row('Science fiction', listMovies({ genre: 'Sci-Fi', limit: 18 })),
      row('Comedy', listMovies({ genre: 'Comedy', limit: 18 })),
      row('Silent era', listMovies({ genre: 'Silent', limit: 18 })),
      row('Newest additions', listMovies({ sort: 'year-desc', limit: 18 })),
    ].filter((entry) => entry.items.length > 0),
  };
}

export function allMovies() {
  return movies;
}
