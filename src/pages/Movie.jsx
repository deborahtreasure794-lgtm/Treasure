import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { isArchiveId, loadMovie, runtimeLabel } from '../api.js';
import { Row } from '../components/MovieCard.jsx';
import Player from '../components/Player.jsx';
import { useProgress, useWatchlist } from '../storage.js';

export default function MoviePage() {
  const { id } = useParams();
  const [state, setState] = useState({ movie: null, related: [], loading: true, error: '' });
  const { has, toggle } = useWatchlist();
  const { entries, save, positionFor, clear } = useProgress();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState((current) => ({ ...current, loading: true, error: '' }));
    loadMovie(id, { signal: controller.signal })
      .then((payload) => {
        if (!active) return;
        setState({ movie: payload.movie, related: payload.related ?? [], loading: false, error: '' });
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return;
        setState({ movie: null, related: [], loading: false, error: err.message });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id]);

  const { movie, related, loading, error } = state;

  if (loading) {
    return (
      <div className="page">
        <div className="player player-loading">
          <div className="spinner" aria-label="Loading film" />
        </div>
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="page">
        <div className="empty-state">
          <p className="eyebrow">Not available</p>
          <h1>We could not open this film</h1>
          <p>{error || 'The title may have been removed from the archive.'}</p>
          <Link className="btn btn-primary" to="/browse">
            Back to the library
          </Link>
        </div>
      </div>
    );
  }

  const saved = has(movie.id);
  const startAt = positionFor(movie.id);

  return (
    <div className="page page-movie">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link to="/browse">Library</Link>
        <span aria-hidden="true">/</span>
        <span>{movie.title}</span>
      </nav>

      <Player movie={movie} startAt={startAt} onProgress={(position, duration) => save(movie, position, duration)} />

      <section className="detail" id="about">
        <div className="detail-poster">
          {movie.poster ? <img src={movie.poster} alt={`${movie.title} poster`} loading="lazy" /> : null}
        </div>
        <div className="detail-info">
          <h1 className="detail-title">{movie.title}</h1>
          <p className="detail-meta">
            {[movie.year, runtimeLabel(movie.runtimeMinutes), movie.rating ? `★ ${movie.rating.toFixed(1)}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {movie.tagline ? <p className="detail-tagline">{movie.tagline}</p> : null}
          <div className="detail-actions">
            <button type="button" className={`btn ${saved ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggle(movie)}>
              {saved ? '✓ In your watchlist' : '+ Add to watchlist'}
            </button>
            {startAt > 0 ? (
              <button type="button" className="btn btn-ghost" onClick={() => clear(movie.id)}>
                Clear progress
              </button>
            ) : null}
            {movie.archivePage ? (
              <a className="btn btn-ghost" href={movie.archivePage} target="_blank" rel="noreferrer">
                Source file
              </a>
            ) : null}
          </div>

          <div className="tags">
            {movie.genres.map((genre) => (
              <Link key={genre} className="tag" to={`/browse?genre=${encodeURIComponent(genre)}`}>
                {genre}
              </Link>
            ))}
            {isArchiveId(movie.id) ? <span className="tag tag-muted">From the archive</span> : null}
          </div>

          <p className="synopsis">{movie.synopsis || movie.tagline || 'No synopsis available for this film yet.'}</p>

          <dl className="meta-list">
            {movie.director ? (
              <>
                <dt>Director</dt>
                <dd>{movie.director}</dd>
              </>
            ) : null}
            {movie.cast ? (
              <>
                <dt>Credits</dt>
                <dd>{movie.cast}</dd>
              </>
            ) : null}
            <dt>Source</dt>
            <dd>{movie.source || 'Internet Archive'}</dd>
          </dl>
        </div>
      </section>

      {related.length ? (
        <Row title="More like this" items={related} progressFor={(movieId) => entries[movieId]} />
      ) : null}
    </div>
  );
}
