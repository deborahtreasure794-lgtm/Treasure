#!/usr/bin/env node
/**
 * Builds server/data/movies.json from the Internet Archive.
 *
 * For every curated title we search the Archive, pick an item that exposes a
 * real, publicly downloadable video derivative, verify the URL responds with a
 * video payload, then store the resolved stream URL plus metadata.
 *
 * Usage: npm run catalog
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'server/data/movies.json');
const CONCURRENCY = 6;
const UA = 'OpenReelCatalog/1.0 (+https://appjet.dev)';

/** Curated public-domain / freely available titles. */
const CURATED = [
  { slug: 'nosferatu', title: 'Nosferatu', year: 1922, genres: ['Horror', 'Silent', 'Fantasy'], tagline: 'The vampire film that still casts a shadow over every horror movie since.' },
  { slug: 'metropolis', title: 'Metropolis', year: 1927, genres: ['Sci-Fi', 'Silent', 'Drama'], tagline: 'A future city of towers and machines, and the uprising that shakes it.', featured: true },
  { slug: 'the-cabinet-of-dr-caligari', title: 'The Cabinet of Dr. Caligari', year: 1920, genres: ['Horror', 'Silent', 'Mystery'], tagline: 'Painted shadows, a sleepwalking killer, and the birth of psychological horror.' },
  { slug: 'night-of-the-living-dead', title: 'Night of the Living Dead', year: 1968, genres: ['Horror', 'Thriller'], tagline: 'Seven strangers barricade themselves in a farmhouse. The dead do not stay down.', featured: true },
  { slug: 'plan-9-from-outer-space', title: 'Plan 9 from Outer Space', year: 1959, genres: ['Sci-Fi', 'Cult'], tagline: 'Aliens resurrect the dead with a plan so audacious it became legend.' },
  { slug: 'his-girl-friday', title: 'His Girl Friday', year: 1940, genres: ['Comedy', 'Romance'], tagline: 'The fastest talking newspaper comedy ever printed.' },
  { slug: 'charade', title: 'Charade', year: 1963, genres: ['Thriller', 'Romance', 'Comedy'], tagline: 'Everyone in Paris wants the money, and nobody is who they claim.', featured: true },
  { slug: 'the-general', title: 'The General', year: 1926, genres: ['Comedy', 'Silent', 'Action'], tagline: 'One engineer, one locomotive, and the most precise stunt work of the silent era.' },
  { slug: 'sherlock-jr', title: 'Sherlock Jr.', year: 1924, genres: ['Comedy', 'Silent'], tagline: 'A projectionist walks into the movie he is showing.' },
  { slug: 'carnival-of-souls', title: 'Carnival of Souls', year: 1962, genres: ['Horror', 'Mystery'], tagline: 'An abandoned pavilion, an organ, and a woman who may not have survived.' },
  { slug: 'detour', title: 'Detour', year: 1945, genres: ['Noir', 'Crime', 'Drama'], tagline: 'Hitchhiking to Los Angeles was the worst decision he ever made.' },
  { slug: 'd-o-a', title: 'D.O.A.', year: 1949, genres: ['Noir', 'Crime', 'Mystery'], tagline: 'He has hours to live and one question: who poisoned him?' },
  { slug: 'the-stranger', title: 'The Stranger', year: 1946, genres: ['Noir', 'Thriller'], tagline: 'A quiet professor in a small town, and the war crime he buried.' },
  { slug: 'meet-john-doe', title: 'Meet John Doe', year: 1941, genres: ['Drama', 'Romance'], tagline: 'A columnist invents a everyman, and the country believes in him.' },
  { slug: 'its-a-wonderful-life', title: "It's a Wonderful Life", year: 1946, genres: ['Drama', 'Family', 'Fantasy'], tagline: 'A man at the end of his rope gets to see the town that never knew him.' },
  { slug: 'a-trip-to-the-moon', title: 'A Trip to the Moon', year: 1902, genres: ['Sci-Fi', 'Silent', 'Short'], tagline: 'Fifteen minutes that invented the science fiction film.' },
  { slug: 'the-phantom-of-the-opera', title: 'The Phantom of the Opera', year: 1925, genres: ['Horror', 'Silent', 'Drama'], tagline: 'A masked figure beneath the opera house, and the soprano he adores.' },
  { slug: 'the-little-shop-of-horrors', title: 'The Little Shop of Horrors', year: 1960, genres: ['Comedy', 'Horror'], tagline: 'A florist, a talking plant, and a diet that is not vegetarian.' },
  { slug: 'santa-claus-conquers-the-martians', title: 'Santa Claus Conquers the Martians', year: 1964, genres: ['Sci-Fi', 'Family', 'Cult'], tagline: 'Mars needs Santa. Earth objects, politely.' },
  { slug: 'reefer-madness', title: 'Reefer Madness', year: 1936, genres: ['Drama', 'Cult'], tagline: 'The cautionary film that became the most quoted cult oddity of its era.' },
  { slug: 'battleship-potemkin', title: 'Battleship Potemkin', year: 1925, genres: ['Drama', 'Silent', 'History'], tagline: 'A rebellion on a warship, and the staircase that defined montage.' },
  { slug: 'scarlet-street', title: 'Scarlet Street', year: 1945, genres: ['Noir', 'Drama'], tagline: 'A cashier, a painter, and a lie that eats them all.' },
  { slug: 'the-hitch-hiker', title: 'The Hitch-Hiker', year: 1953, genres: ['Noir', 'Thriller'], tagline: 'Two friends on a fishing trip pick up the wrong passenger.' },
  { slug: 'kansas-city-confidential', title: 'Kansas City Confidential', year: 1952, genres: ['Noir', 'Crime'], tagline: 'A masked heist, four strangers, and one innocent man taking the fall.' },
  { slug: 'gullivers-travels', title: "Gulliver's Travels", year: 1939, genres: ['Animation', 'Family', 'Fantasy'], tagline: 'The Max Fleischer feature that carried hand-drawn animation into wonder.' },
  { slug: 'the-last-man-on-earth', title: 'The Last Man on Earth', year: 1964, genres: ['Sci-Fi', 'Horror'], tagline: 'By day he hunts the infected. By night they wait outside his door.' },
  { slug: 'house-on-haunted-hill', title: 'House on Haunted Hill', year: 1959, genres: ['Horror', 'Mystery'], tagline: 'Ten thousand dollars to spend one night in a house that wants them gone.' },
  { slug: 'the-terror', title: 'The Terror', year: 1963, genres: ['Horror', 'Thriller'], tagline: 'A lost officer follows a ghost to a castle on a Baltic cliff.' },
  { slug: 'the-39-steps', title: 'The 39 Steps', year: 1935, genres: ['Thriller', 'Mystery'], tagline: 'A stranger in a raincoat, a murdered woman, and a chase across Britain.' },
  { slug: 'suddenly', title: 'Suddenly', year: 1954, genres: ['Noir', 'Thriller'], tagline: 'Three gunmen take a family hostage in a house overlooking the railroad.' },
  { slug: 'beat-the-devil', title: 'Beat the Devil', year: 1953, genres: ['Comedy', 'Adventure'], tagline: 'Swindlers chase uranium in Africa and outtalk each other completely.' },
  { slug: 'dementia-13', title: 'Dementia 13', year: 1963, genres: ['Horror', 'Thriller'], tagline: 'A family castle, an axe, and an inheritance worth killing for.' },
  { slug: 'things-to-come', title: 'Things to Come', year: 1936, genres: ['Sci-Fi', 'Drama'], tagline: 'H.G. Wells imagines the war, the collapse, and what comes after.' },
  { slug: 'the-brain-that-wouldnt-die', title: "The Brain That Wouldn't Die", year: 1962, genres: ['Sci-Fi', 'Horror'], tagline: 'A surgeon keeps his fiancée alive as a head, and she is not grateful.' },
  { slug: 'the-amazing-mr-x', title: 'The Amazing Mr. X', year: 1948, genres: ['Noir', 'Mystery'], tagline: 'A phony spiritualist finds a widow whose ghosts may be real.' },
];

const VIDEO_FORMATS = /^(h\.264|h\.264 ia|mpeg4|512kb mpeg4|mpeg2|ogg video|matroska|windows media|divx|quicktime)$/i;

function stripHtml(input) {
  if (!input) return '';
  const text = Array.isArray(input) ? input.join(' ') : String(input);
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '));
  return `${cut.slice(0, stop > max * 0.6 ? stop : max).trim()}…`;
}

async function getJson(url, timeoutMs = 20000) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function searchArchive(title, year) {
  const params = new URLSearchParams();
  params.set('q', `title:("${title}") AND mediatype:movies AND year:[${year - 1} TO ${year + 1}]`);
  params.append('fl[]', 'identifier');
  params.append('fl[]', 'title');
  params.append('fl[]', 'year');
  params.append('fl[]', 'downloads');
  params.append('sort[]', 'downloads desc');
  params.set('rows', '10');
  params.set('output', 'json');
  const data = await getJson(`https://archive.org/advancedsearch.php?${params}`);
  return data?.response?.docs ?? [];
}

function pickVideo(files) {
  const candidates = (files || [])
    .filter((f) => f && typeof f.name === 'string')
    .filter((f) => /\.(mp4|m4v|ogv|webm)$/i.test(f.name))
    .filter((f) => VIDEO_FORMATS.test(String(f.format || '').trim()) || /\.(mp4|m4v|webm)$/i.test(f.name))
    .filter((f) => Number(f.size || 0) > 8 * 1024 * 1024)
    .sort((a, b) => Number(b.size || 0) - Number(a.size || 0));
  return candidates[0] ?? null;
}

async function headOk(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'user-agent': UA, range: 'bytes=0-1023' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    const type = res.headers.get('content-type') || '';
    res.body?.cancel?.();
    return res.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}

async function resolveTitle(entry) {
  const docs = await searchArchive(entry.title, entry.year);
  for (const doc of docs) {
    try {
      const meta = await getJson(`https://archive.org/metadata/${doc.identifier}`);
      if (!meta || meta.is_dark) continue;
      const video = pickVideo(meta.files);
      if (!video) continue;
      const streamUrl = `https://archive.org/download/${doc.identifier}/${video.name
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;
      if (!(await headOk(streamUrl))) continue;

      const runtimeSeconds = Number(video.length || 0) || null;
      const description = stripHtml(meta.metadata?.description);
      return {
        id: entry.slug,
        title: stripHtml(meta.metadata?.title) || entry.title,
        year: Number(meta.metadata?.year || entry.year) || entry.year,
        genres: entry.genres,
        tagline: entry.tagline,
        synopsis: clip(description, 700) || entry.tagline,
        director: stripHtml(meta.metadata?.director) || null,
        cast: stripHtml(meta.metadata?.creator) || null,
        rating: Number(meta.metadata?.avg_rating || 0) || null,
        runtimeMinutes: runtimeSeconds ? Math.round(runtimeSeconds / 60) : null,
        poster: `https://archive.org/services/img/${doc.identifier}`,
        streamUrl,
        source: 'Internet Archive',
        archiveIdentifier: doc.identifier,
        archivePage: `https://archive.org/details/${doc.identifier}`,
        sizeBytes: Number(video.size || 0) || null,
        featured: Boolean(entry.featured),
      };
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main() {
  console.log(`Resolving ${CURATED.length} titles from archive.org …`);
  const resolved = await mapLimit(CURATED, CONCURRENCY, async (entry) => {
    try {
      const movie = await resolveTitle(entry);
      if (movie) {
        console.log(`  ok    ${entry.title} (${entry.year}) -> ${movie.archiveIdentifier} [${Math.round((movie.sizeBytes || 0) / 1048576)}MB]`);
      } else {
        console.warn(`  MISS  ${entry.title} (${entry.year})`);
      }
      return movie;
    } catch (err) {
      console.warn(`  FAIL  ${entry.title}: ${err.message}`);
      return null;
    }
  });

  const movies = resolved.filter(Boolean);
  if (movies.length < 8) throw new Error(`Only ${movies.length} titles resolved, refusing to overwrite catalog`);

  movies.sort((a, b) => a.title.localeCompare(b.title));
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Internet Archive', movies }, null, 2)}\n`,
  );
  console.log(`\nWrote ${movies.length}/${CURATED.length} movies to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
