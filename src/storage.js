import { useCallback, useEffect, useMemo, useState } from 'react';

const WATCHLIST_KEY = 'openreel.watchlist.v1';
const PROGRESS_KEY = 'openreel.progress.v1';
const EVENT = 'openreel:storage';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled — the app still works without persistence */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { key } }));
}

function snapshot(movie) {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year,
    poster: movie.poster,
    genres: movie.genres ?? [],
    runtimeMinutes: movie.runtimeMinutes ?? null,
    tagline: movie.tagline ?? '',
  };
}

function usePersistentState(key, fallback) {
  const [value, setValue] = useState(() => read(key, fallback));

  useEffect(() => {
    const sync = (event) => {
      if (event.type === 'storage' || event.detail?.key === key) setValue(read(key, fallback));
    };
    window.addEventListener('storage', sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(EVENT, sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next) => {
      setValue((current) => {
        const resolved = typeof next === 'function' ? next(current) : next;
        write(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update];
}

export function useWatchlist() {
  const [items, setItems] = usePersistentState(WATCHLIST_KEY, []);
  const ids = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  const toggle = useCallback(
    (movie) => {
      setItems((current) => {
        if (current.some((item) => item.id === movie.id)) {
          return current.filter((item) => item.id !== movie.id);
        }
        return [snapshot(movie), ...current];
      });
    },
    [setItems],
  );

  const remove = useCallback(
    (id) => setItems((current) => current.filter((item) => item.id !== id)),
    [setItems],
  );

  return { items, has: (id) => ids.has(id), toggle, remove, count: items.length };
}

export function useProgress() {
  const [entries, setEntries] = usePersistentState(PROGRESS_KEY, {});

  const save = useCallback(
    (movie, position, duration) => {
      if (!movie?.id || !Number.isFinite(position) || !Number.isFinite(duration) || duration < 30) return;
      const ratio = position / duration;
      setEntries((current) => {
        const next = { ...current };
        if (ratio > 0.97 || position < 20) {
          delete next[movie.id];
          return next;
        }
        next[movie.id] = {
          ...snapshot(movie),
          position: Math.round(position),
          duration: Math.round(duration),
          updatedAt: Date.now(),
        };
        return next;
      });
    },
    [setEntries],
  );

  const clear = useCallback(
    (id) => setEntries((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    }),
    [setEntries],
  );

  const continueWatching = useMemo(
    () => Object.values(entries).sort((a, b) => b.updatedAt - a.updatedAt),
    [entries],
  );

  return { entries, save, clear, continueWatching, positionFor: (id) => entries[id]?.position ?? 0 };
}

export function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
