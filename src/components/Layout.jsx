import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useWatchlist } from '../storage.js';

function Logo() {
  return (
    <Link className="brand" to="/" aria-label="OpenReel home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="22" height="22">
          <rect width="32" height="32" rx="9" fill="currentColor" />
          <path d="M13 10.5v11l9-5.5z" fill="#0b0c10" />
        </svg>
      </span>
      <span className="brand-text">
        Open<span>Reel</span>
      </span>
    </Link>
  );
}

export default function Layout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const inputRef = useRef(null);
  const { count } = useWatchlist();

  useEffect(() => {
    if (location.pathname === '/search') setTerm(params.get('q') ?? '');
  }, [location.pathname, params]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = document.activeElement?.tagName;
      if (event.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const submit = (event) => {
    event.preventDefault();
    const query = term.trim();
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/browse');
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <nav className="nav-links" aria-label="Primary">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/browse">Browse</NavLink>
            <NavLink to="/watchlist">
              Watchlist
              {count > 0 && <span className="nav-badge">{count}</span>}
            </NavLink>
          </nav>
          <form className="search-form" onSubmit={submit} role="search">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M10.5 3a7.5 7.5 0 1 0 4.6 13.4l4.2 4.2 1.4-1.4-4.2-4.2A7.5 7.5 0 0 0 10.5 3Zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"
                fill="currentColor"
              />
            </svg>
            <input
              ref={inputRef}
              className="search-input"
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search movies, actors, genres…"
              aria-label="Search movies"
            />
            <kbd className="search-kbd">/</kbd>
          </form>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <p>
            <strong>OpenReel</strong> streams films that are free to watch — public domain classics and titles
            the Internet Archive hosts openly. No account, no subscription, no tracking.
          </p>
          <p className="footer-note">
            Video is served directly by the{' '}
            <a href="https://archive.org/details/movies" target="_blank" rel="noreferrer">
              Internet Archive
            </a>
            . If a film is still in copyright in your country, please watch it somewhere that licenses it.
          </p>
        </div>
      </footer>
    </div>
  );
}
