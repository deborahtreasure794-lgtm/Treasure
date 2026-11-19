import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { CardGrid, CardSkeletons } from '../components/MovieCard.jsx';
import { useProgress } from '../storage.js';

const DECADES = [
  { value: '1900', label: '1900s' },
  { value: '1910', label: '1910s' },
  { value: '1920', label: '1920s' },
  { value: '1930', label: '1930s' },
  { value: '1940', label: '1940s' },
  { value: '1950', label: '1950s' },
  { value: '1960', label: '1960s' },
];

const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'year-desc', label: 'Newest first' },
  { value: 'year-asc', label: 'Oldest first' },
  { value: 'title', label: 'A → Z' },
];

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const genre = params.get('genre') ?? '';
  const decade = params.get('decade') ?? '';
  const sort = params.get('sort') ?? 'featured';

  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [term, setTerm] = useState(q);
  const { entries } = useProgress();

  useEffect(() => {
    api
      .genres()
      .then((res) => setGenres(res.genres ?? []))
      .catch(() => setGenres([]));
  }, []);

  useEffect(() => {
    setTerm(q);
  }, [q]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    api
      .movies({ q, genre, decade, sort, limit: 120 }, { signal: controller.signal })
      .then((res) => {
        if (!active) return;
        setMovies(res.movies ?? []);
        setError('');
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [q, genre, decade, sort]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">The library</p>
        <h1>Browse free films</h1>
        <p className="page-sub">
          Every title below is free to watch right now, streamed straight from the Internet Archive.
        </p>
      </header>

      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: term.trim() });
        }}
      >
        <input
          className="search-input filter-search"
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Filter by title, director or year"
          aria-label="Filter the library"
        />
        <select className="select" value={decade} onChange={(event) => update({ decade: event.target.value })} aria-label="Decade">
          <option value="">Any decade</option>
          {DECADES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select className="select" value={sort} onChange={(event) => update({ sort: event.target.value })} aria-label="Sort by">
          {SORTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" type="submit">
          Apply
        </button>
      </form>

      <div className="chips" role="group" aria-label="Filter by genre">
        <button
          type="button"
          className={`chip${genre ? '' : ' is-active'}`}
          onClick={() => update({ genre: '' })}
        >
          All genres
        </button>
        {genres.map((item) => (
          <button
            key={item.name}
            type="button"
            className={`chip${genre.toLowerCase() === item.name.toLowerCase() ? ' is-active' : ''}`}
            onClick={() => update({ genre: item.name })}
          >
            {item.name}
            <span className="chip-count">{item.count}</span>
          </button>
        ))}
      </div>

      <p className="result-count" role="status">
        {loading ? 'Loading…' : `${movies.length} film${movies.length === 1 ? '' : 's'}`}
        {q ? ` matching “${q}”` : ''}
        {genre ? ` in ${genre}` : ''}
      </p>

      {error ? (
        <div className="notice notice-error">
          <strong>Could not load films.</strong> {error}
        </div>
      ) : null}

      {loading ? (
        <CardSkeletons count={12} />
      ) : movies.length ? (
        <CardGrid items={movies} progressFor={(id) => entries[id]} />
      ) : (
        <div className="empty-state">
          <h2>No films match those filters</h2>
          <p>Try another genre, decade, or search the Internet Archive directly.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
