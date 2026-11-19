import { Link } from 'react-router-dom';
import { CardGrid } from '../components/MovieCard.jsx';
import { useProgress, useWatchlist } from '../storage.js';

export default function Watchlist() {
  const { items, remove, count } = useWatchlist();
  const { entries } = useProgress();

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Saved</p>
        <h1>Your watchlist</h1>
        <p className="page-sub">
          {count ? `${count} film${count === 1 ? '' : 's'} saved on this device.` : 'Films you save appear here, stored on this device only.'}
        </p>
      </header>

      {count ? (
        <CardGrid items={items} progressFor={(id) => entries[id]} onRemove={remove} />
      ) : (
        <div className="empty-state">
          <h2>Nothing saved yet</h2>
          <p>Tap “Add to watchlist” on any film and it will wait here for you.</p>
          <Link className="btn btn-primary" to="/browse">
            Find something to watch
          </Link>
        </div>
      )}
    </div>
  );
}
