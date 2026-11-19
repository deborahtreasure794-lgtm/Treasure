import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { runtimeLabel } from '../api.js';
import { formatClock } from '../storage.js';

function initials(title = '') {
  return title
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export function Poster({ movie, eager = false }) {
  return (
    <div className="poster">
      <span className="poster-fallback" aria-hidden="true">
        {initials(movie.title)}
      </span>
      {movie.poster ? (
        <img
          src={movie.poster}
          alt={`${movie.title} poster`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
    </div>
  );
}

export default function MovieCard({ movie, progress, onRemove, wide = false }) {
  const ratio = progress && progress.duration ? Math.min(progress.position / progress.duration, 1) : 0;

  return (
    <article className={`card${wide ? ' card-wide' : ''}`}>
      <Link className="card-link" to={`/movie/${encodeURIComponent(movie.id)}`}>
        <Poster movie={movie} />
        <span className="card-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
          </svg>
        </span>
        {ratio > 0 ? (
          <span className="card-progress" aria-hidden="true">
            <span style={{ width: `${Math.round(ratio * 100)}%` }} />
          </span>
        ) : null}
        <div className="card-body">
          <h3 className="card-title">{movie.title}</h3>
          <p className="card-sub">
            {[movie.year, runtimeLabel(movie.runtimeMinutes)].filter(Boolean).join(' · ')}
            {ratio > 0 ? ` · ${formatClock(progress.position)} watched` : ''}
          </p>
        </div>
      </Link>
      {onRemove ? (
        <button
          type="button"
          className="card-remove"
          onClick={() => onRemove(movie.id)}
          aria-label={`Remove ${movie.title}`}
          title="Remove"
        >
          ×
        </button>
      ) : null}
    </article>
  );
}

export function Row({ title, items, progressFor, onRemove, seeAllHref, seeAllLabel = 'See all' }) {
  const trackRef = useRef(null);
  if (!items?.length) return null;

  const nudge = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.max(track.clientWidth * 0.8, 240), behavior: 'smooth' });
  };

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        <div className="section-tools">
          {seeAllHref ? (
            <Link className="section-link" to={seeAllHref}>
              {seeAllLabel}
            </Link>
          ) : null}
          <button type="button" className="row-nav" onClick={() => nudge(-1)} aria-label={`Scroll ${title} left`}>
            ‹
          </button>
          <button type="button" className="row-nav" onClick={() => nudge(1)} aria-label={`Scroll ${title} right`}>
            ›
          </button>
        </div>
      </div>
      <div className="row-scroller" ref={trackRef}>
        {items.map((movie) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            progress={progressFor ? progressFor(movie.id) : undefined}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
}

export function CardGrid({ items, progressFor, onRemove }) {
  return (
    <div className="grid-cards">
      {items.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          progress={progressFor ? progressFor(movie.id) : undefined}
          onRemove={onRemove}
          wide
        />
      ))}
    </div>
  );
}

export function CardSkeletons({ count = 6 }) {
  return (
    <div className="grid-cards" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="card skeleton-card" key={index}>
          <div className="skeleton skeleton-poster" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  );
}
