import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { allMovies, catalogMeta, getMovie, homeRows, listGenres, listMovies } from '../server/catalog.js';
import { buildStreamUrl, clip, pickVideoFile, stripHtml } from '../server/archive.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('catalog is populated with playable, well-formed records', () => {
  const movies = allMovies();
  assert.ok(movies.length >= 20, `expected a real catalog, got ${movies.length}`);
  assert.equal(catalogMeta.total, movies.length);

  for (const movie of movies) {
    assert.ok(movie.id, 'movie needs an id');
    assert.ok(movie.title && movie.title.length > 1, `title missing for ${movie.id}`);
    assert.ok(Number.isInteger(movie.year) && movie.year > 1880, `bad year for ${movie.id}`);
    assert.match(movie.streamUrl, /^https:\/\/archive\.org\/download\//, `stream url for ${movie.id}`);
    assert.ok(Array.isArray(movie.genres) && movie.genres.length > 0, `genres missing for ${movie.id}`);
    // A few curated titles are famous early shorts (e.g. A Trip to the Moon, 1902),
    // so only reject clearly broken durations.
    if (movie.runtimeMinutes != null) {
      assert.ok(movie.runtimeMinutes >= 5, `runtime looks broken for ${movie.id}`);
    }
  }

  const ids = new Set(movies.map((movie) => movie.id));
  assert.equal(ids.size, movies.length, 'movie ids must be unique');
});

test('committed catalog data matches the served catalog', () => {
  const raw = JSON.parse(readFileSync(resolve(root, 'server/data/movies.json'), 'utf8'));
  assert.equal(raw.movies.length, allMovies().length);
  assert.ok(raw.generatedAt, 'catalog should record when it was generated');
});

test('listMovies filters by genre, decade and query', () => {
  const horror = listMovies({ genre: 'Horror', limit: 100 });
  assert.ok(horror.length > 0, 'expected horror titles');
  assert.ok(horror.every((movie) => movie.genres.some((genre) => genre.toLowerCase() === 'horror')));

  const sixties = listMovies({ decade: '1960', limit: 100 });
  assert.ok(sixties.length > 0, 'expected 1960s titles');
  assert.ok(sixties.every((movie) => movie.year >= 1960 && movie.year < 1970));

  const searched = listMovies({ q: 'nosferatu', limit: 10 });
  assert.ok(searched.length > 0, 'search should find Nosferatu');
  assert.match(searched[0].title.toLowerCase(), /nosferatu/);

  assert.deepEqual(listMovies({ q: 'zzzz-no-such-film' }), []);
});

test('listMovies sorts and caps results', () => {
  const newest = listMovies({ sort: 'year-desc', limit: 5 });
  assert.equal(newest.length, 5);
  for (let index = 1; index < newest.length; index += 1) {
    assert.ok(newest[index - 1].year >= newest[index].year, 'year-desc must be non-increasing');
  }

  const oldest = listMovies({ sort: 'year-asc', limit: 3 });
  assert.ok(oldest[0].year <= oldest[oldest.length - 1].year);

  assert.equal(listMovies({ limit: 500 }).length <= 200, true, 'limit is capped');
});

test('getMovie resolves curated ids and rejects unknown ones', () => {
  const sample = allMovies()[0];
  const found = getMovie(sample.id);
  assert.ok(found);
  assert.equal(found.id, sample.id);
  assert.equal(getMovie('does-not-exist'), null);
});

test('home rows and genres expose watchable content', () => {
  const home = homeRows();
  assert.ok(home.hero, 'home page needs a featured film');
  assert.match(home.hero.streamUrl, /^https:\/\//);
  assert.ok(home.rows.length >= 3, 'expected several browse rows');
  for (const row of home.rows) {
    assert.ok(row.title);
    assert.ok(row.items.length > 0, `${row.title} should not be empty`);
    assert.ok(row.items.every((movie) => Boolean(movie.streamUrl)));
  }

  const genres = listGenres();
  assert.ok(genres.length >= 3);
  assert.ok(genres.every((genre) => genre.name && genre.count > 0));
});

test('archive helpers pick the largest real video file', () => {
  const files = [
    { name: 'movie.mp4', format: 'h.264', size: '120000000' },
    { name: 'trailer.mp4', format: 'h.264', size: '4000000' },
    { name: 'movie.ogv', format: 'Ogg Video', size: '90000000' },
    { name: 'poster.jpg', format: 'JPEG', size: '90000' },
    { name: 'notes.txt', format: 'Text', size: '20' },
  ];
  const picked = pickVideoFile(files);
  assert.equal(picked.name, 'movie.mp4');

  const featureOnly = pickVideoFile(files, { minSizeBytes: 200 * 1024 * 1024 });
  assert.equal(featureOnly, null, 'files under the feature threshold must be rejected');
  assert.equal(pickVideoFile(files, { minSizeBytes: 100 * 1024 * 1024 }).name, 'movie.mp4');
});

test('archive helpers build safe stream urls and clean metadata', () => {
  assert.equal(
    buildStreamUrl('night_of_the_living_dead', 'Night of the Living Dead.mp4'),
    'https://archive.org/download/night_of_the_living_dead/Night%20of%20the%20Living%20Dead.mp4',
  );
  assert.match(buildStreamUrl('abc', 'sub/dir/film.mp4'), /\/abc\/sub\/dir\/film\.mp4$/);

  assert.equal(stripHtml('<p>Hello &amp; <b>welcome</b></p>'), 'Hello & welcome');
  assert.equal(stripHtml(['one', 'two']), 'one two');
  assert.equal(stripHtml(undefined), '');

  const long = 'a '.repeat(300);
  const shortened = clip(long, 50);
  assert.ok(shortened.length <= 51, 'clip must shorten long text');
  assert.ok(shortened.endsWith('…'));
});
