import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, runtimeLabel } from '../api.js';
import { Row, CardSkeletons } from '../components/MovieCard.jsx';
import { useProgress } from '../storage.js';

function Hero({ movie }) {
  if (!movie) return null;
  return (
    <section className="hero">
      <div className="hero-backdrop" style={{ backgroundImage: `url(${movie.poster})` }} aria-hidden="true" />
      <div className="hero-scrim" aria-hidden="true" />
      <div className="hero-content">
        <p className="eyebrow">Featured film · {movie.year}</p>
        <h1 className="hero-title">{movie.title}</h1>
        <p className="hero-tagline">{movie.tagline || movie.synopsis}</p>
        <p className="hero-meta">
          {movie.genres.slice(0, 3).join(' · ')}
          {movie.runtimeMinutes ? ` · ${runtimeLabel(movie.runtimeMinutes)}` : ''}
          {' · Free to stream'}
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to={`/movie/${encodeURIComponent(movie.id)}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
            </svg>
            Play now
          </Link>
          <Link className="btn btn-ghost" to={`/movie/${encodeURIComponent(movie.id)}#about`}>
            More info
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [data, setData] = useState(null);
  const [archive, setArchive] = useState([]);
  const [error, setError] = useState('');
  const { entries, continueWatching, clear } = useProgress();

  useEffect(() => {
    const controller = new AbortController();
    api
      .home({ signal: controller.signal })
      .then(setData)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
    api
      .archiveSearch({ collection: 'feature_films', limit: 18 }, { signal: controller.signal })
      .then((res) => setArchive((res.results ?? []).map((item) => ({ ...item, id: `archive:${item.identifier}` }))))
      .catch(() => setArchive([]));
    return () => controller.abort();
  }, []);

  const progressFor = (id) => entries[id];

  return (
    <div className="page">
      {error ? (
        <div className="notice notice-error">
          <strong>The library could not load.</strong> {error}
        </div>
      ) : null}

      <Hero movie={data?.hero} />

      {continueWatching.length > 0 ? (
        <Row
          title="Continue watching"
          items={continueWatching}
          progressFor={progressFor}
          onRemove={clear}
        />
      ) : null}

      {!data && !error ? (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Loading the library…</h2>
          </div>
          <CardSkeletons count={6} />
        </section>
      ) : null}

      {data?.rows?.map((row) => (
        <Row key={row.title} title={row.title} items={row.items} progressFor={progressFor} seeAllHref="/browse" />
      ))}

      {archive.length > 0 ? (
        <Row
          title="More free films from the Internet Archive"
          items={archive}
          seeAllHref="/search?q=public%20domain%20films"
          seeAllLabel="Search the archive"
        />
      ) : null}

      <section className="archive-note">
        <h2>Thousands more, searchable</h2>
        <p>
          OpenReel plays anything the Internet Archive hosts openly. Search for a title, a director or a year and
          we resolve a playable copy on the spot — no account, no ads, no paywall.
        </p>
        <Link className="btn btn-secondary" to="/browse">
          Browse the full library
        </Link>
      </section>
    </div>
  );
}
