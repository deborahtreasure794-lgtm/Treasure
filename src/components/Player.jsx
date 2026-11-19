import { useEffect, useRef, useState } from 'react';
import { formatClock } from '../storage.js';

/**
 * HTML5 player over the Archive's direct video URL. Reports playback position so
 * the home page can offer "Continue watching".
 */
export default function Player({ movie, startAt = 0, onProgress }) {
  const videoRef = useRef(null);
  const lastReported = useRef(0);
  const [error, setError] = useState('');
  const [resumeFrom, setResumeFrom] = useState(startAt > 20 ? startAt : 0);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setError('');
    setNotice('');
    lastReported.current = 0;
    setResumeFrom(startAt > 20 ? startAt : 0);
  }, [movie?.streamUrl, startAt]);

  const applyResume = () => {
    const video = videoRef.current;
    if (!video || !resumeFrom) return;
    const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
    if (resumeFrom < duration * 0.97) {
      video.currentTime = resumeFrom;
      setNotice(`Resumed at ${formatClock(resumeFrom)}`);
    }
  };

  const reportProgress = () => {
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - lastReported.current) < 5) return;
    lastReported.current = video.currentTime;
    onProgress?.(video.currentTime, video.duration);
  };

  if (!movie?.streamUrl) {
    return (
      <div className="player player-message">
        <p>This title has no playable source yet.</p>
      </div>
    );
  }

  return (
    <div className="player-wrap">
      <div className="player">
        <video
          ref={videoRef}
          className="player-video"
          src={movie.streamUrl}
          poster={movie.poster || undefined}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={applyResume}
          onTimeUpdate={reportProgress}
          onPause={reportProgress}
          onEnded={() => onProgress?.(movie.runtimeMinutes ? movie.runtimeMinutes * 60 : 1, movie.runtimeMinutes ? movie.runtimeMinutes * 60 : 1)}
          onError={() =>
            setError(
              'The video source did not respond. The Internet Archive may be briefly unavailable — reload the page or open the original item.',
            )
          }
        >
          <track kind="captions" />
        </video>
      </div>
      {error ? (
        <p className="player-alert">
          {error}{' '}
          {movie.archivePage ? (
            <a href={movie.archivePage} target="_blank" rel="noreferrer">
              Open on archive.org
            </a>
          ) : null}
        </p>
      ) : (
        <p className="player-note">
          {notice ? `${notice} · ` : ''}
          Streaming directly from {movie.source || 'the Internet Archive'}.
          {resumeFrom ? (
            <button type="button" className="link-button" onClick={() => setResumeFrom(0)}>
              Start over
            </button>
          ) : null}
        </p>
      )}
    </div>
  );
}
