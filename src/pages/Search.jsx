import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { CardGrid, CardSkeletons } from '../components/MovieCard.jsx';

const SUGGESTIONS = ['Nosferatu', 'noir', 'Chaplin', '1920s', 'horror', 'Metropolis', 'comedy'];

export default function Search() {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();

  const [library, setLibrary] = useState({ loading: true, movies: [] });
  const [archive, setArchive] = useState({ loading: true, results: [], error: '' });

  useEffect(() => {
    if (!q) {
      setLibrary({ loading: false, movies: [] });
      setArchive({ loading: false, results: [], error: '' });
      return undefined;
    }
    const controller = new AbortController();
    let active = true;

    setLibrary({ loading: true, movies: [] });
    setArchive({ loading: true, results: [], error: '' });

    api
      .movies({ q, limit: 60 }, { signal: controller.signal })
      .then((res) => {
        if (active) setLibrary({ loading: false, movies: res.movies ?? [] });
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError') setLibrary({ loading: false, movies: [] });
      });

    api
      .archiveSearch({ q, limit: 24 }, { signal: controller.signal })
      .then((res) => {
        if (!active) return;
        setArchive({
          loading: false,
          results: (res.results ?? []).map((item) => ({ ...item, id: `archive:${item.identifier}` })),
          error: '',
        });
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return;
        setArchive({ loading: false, results: [], error: err.message });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [q]);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Search</p>
        <h1>{q ? `Results for “${q}”` : 'Find something to watch'}</h1>
        <p className="page-sub">
          We search the OpenReel library first, then everything the Internet Archive hosts openly.
        </p>
      </header>

      {!q ? (
        <div className="chips">
          {SUGGESTIONS.map((suggestion) => (
            <Link key={suggestion} className="chip" to={`/search?q=${encodeURIComponent(suggestion)}`}>
              {suggestion}
            </Link>
          ))}
        </div>
      ) : null}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">In the OpenReel library</h2>
        </div>
        {library.loading ? (
          <CardSkeletons count={6} />
        ) : library.movies.length ? (
          <CardGrid items={library.movies} />
        ) : (
          <p className="result-count">No curated matches. The archive results below may still have it.</p>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Across the Internet Archive</h2>
        </div>
        {archive.loading ? (
          <CardSkeletons count={6} />
        ) : archive.error ? (
          <div className="notice notice-error">
            <strong>Archive search is unavailable.</strong> {archive.error}
          </div>
        ) : archive.results.length ? (
          <CardGrid items={archive.results} />
        ) : (
          <p className="result-count">Nothing matched in the archive either. Try a shorter title.</p>
        )}
      </section>
    </div>
  );
}
