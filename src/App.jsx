import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Browse from './pages/Browse.jsx';
import MoviePage from './pages/Movie.jsx';
import Search from './pages/Search.jsx';
import Watchlist from './pages/Watchlist.jsx';

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname, search]);
  return null;
}

function NotFound() {
  return (
    <section className="empty-state">
      <p className="eyebrow">404</p>
      <h1>This reel is missing</h1>
      <p>The page you asked for does not exist. The library is still open though.</p>
      <Link className="btn btn-primary" to="/browse">
        Browse the library
      </Link>
    </section>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/search" element={<Search />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/movie/:id" element={<MoviePage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
