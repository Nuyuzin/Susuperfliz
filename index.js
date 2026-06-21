require('dotenv').config();

const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const SUPERFLIX_BASE = 'https://superflixapi.cyou';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: SUPERFLIX_BASE,
};

// Cache simples em memória (IMDB → TMDB)
const tmdbCache = new Map();

// ---------------------------------------------------------------------------
// TMDB: converte IMDB ID → TMDB ID
// ---------------------------------------------------------------------------

async function imdbToTmdb(imdbId, type) {
  const key = `${imdbId}:${type}`;
  if (tmdbCache.has(key)) return tmdbCache.get(key);

  if (!TMDB_API_KEY) {
    throw new Error(
      'TMDB_API_KEY não configurada. Adicione a variável de ambiente no Render/Railway.'
    );
  }

  const res = await axios.get('https://api.themoviedb.org/3/find/' + imdbId, {
    params: { api_key: TMDB_API_KEY, external_source: 'imdb_id' },
    timeout: 8000,
  });

  const data = res.data;
  let tmdbId = null;

  if (type === 'movie' && data.movie_results && data.movie_results.length > 0) {
    tmdbId = data.movie_results[0].id;
  } else if (type === 'series' && data.tv_results && data.tv_results.length > 0) {
    tmdbId = data.tv_results[0].id;
  }

  if (!tmdbId) throw new Error(`TMDB ID não encontrado para ${imdbId}`);

  tmdbCache.set(key, tmdbId);
  return tmdbId;
}

// ---------------------------------------------------------------------------
// SuperFlix: extrai URLs de vídeo de uma página embed
// ---------------------------------------------------------------------------

async function fetchPageAndExtractUrls(url) {
  const res = await axios.get(url, {
    headers: HEADERS,
    timeout: 15000,
    maxRedirects: 10,
  });

  const html = res.data;
  const urls = [];

  for (const m of html.matchAll(/["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)/g)) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }
  for (const m of html.matchAll(/["'`](https?:\/\/[^"'`\s]+\.mp4[^"'`\s]*)/g)) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }

  const $ = cheerio.load(html);
  $('source[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && src.startsWith('http') && !urls.includes(src)) urls.push(src);
  });

  const iframes = [];
  $('iframe[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && src.startsWith('http')) iframes.push(src);
  });

  return { urls, iframes };
}

async function resolveStreams(embedUrl, depth = 0) {
  if (depth > 3) return [];

  let result;
  try {
    result = await fetchPageAndExtractUrls(embedUrl);
  } catch (err) {
    console.error(`[SuperFlix] Erro ao buscar ${embedUrl}: ${err.message}`);
    return [];
  }

  const { urls, iframes } = result;
  if (urls.length > 0) return urls;

  const followed = [];
  for (const iframe of iframes) {
    const sub = await resolveStreams(iframe, depth + 1);
    followed.push(...sub);
  }
  return followed;
}

// ---------------------------------------------------------------------------
// Monta URL do embed SuperFlix
// ---------------------------------------------------------------------------

function buildEmbedUrl(tmdbId, type, season, episode) {
  if (type === 'movie') return `${SUPERFLIX_BASE}/filme/${tmdbId}`;
  if (season && episode) return `${SUPERFLIX_BASE}/serie/${tmdbId}/${season}/${episode}`;
  if (season) return `${SUPERFLIX_BASE}/serie/${tmdbId}/${season}`;
  return `${SUPERFLIX_BASE}/serie/${tmdbId}`;
}

async function fetchStreamsFromTmdb(tmdbId, type, season, episode) {
  const embedUrl = buildEmbedUrl(tmdbId, type, season, episode);
  console.log(`[SuperFlix] Buscando embed: ${embedUrl}`);

  const videoUrls = await resolveStreams(embedUrl);
  if (!videoUrls || videoUrls.length === 0) return [];

  return videoUrls.map((url, idx) => ({
    title: `SuperFlix ${url.includes('.m3u8') ? 'HLS' : 'MP4'}${idx > 0 ? ` (${idx + 1})` : ''}`,
    url,
    behaviorHints: {
      notWebReady: false,
      proxyHeaders: {
        request: {
          Referer: SUPERFLIX_BASE,
          Origin: SUPERFLIX_BASE,
          'User-Agent': HEADERS['User-Agent'],
        },
      },
    },
  }));
}

// ---------------------------------------------------------------------------
// Manifest do Addon
// ---------------------------------------------------------------------------

const manifest = {
  id: 'community.superflix.addon',
  version: '1.0.0',
  name: 'SuperFlix',
  description:
    'Streams de filmes, séries e animes em português via SuperFlixAPI.',
  logo: 'https://superflixapi.cyou/favicon.ico',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [],
  behaviorHints: { adult: false, p2p: false },
};

// ---------------------------------------------------------------------------
// Addon Builder
// ---------------------------------------------------------------------------

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
  console.log(`\n[Addon] Solicitado — type: ${type} | id: ${id}`);

  try {
    let imdbId = id;
    let season = null;
    let episode = null;

    if (type === 'series') {
      const parts = id.split(':');
      imdbId = parts[0];
      season = parts[1] || '1';
      episode = parts[2] || '1';
    }

    const tmdbId = await imdbToTmdb(imdbId, type);
    console.log(`[Addon] IMDB ${imdbId} → TMDB ${tmdbId}`);

    const streams = await fetchStreamsFromTmdb(tmdbId, type, season, episode);
    console.log(`[Addon] ${streams.length} stream(s) encontrado(s).`);
    return { streams };
  } catch (err) {
    console.error(`[Addon] Erro: ${err.message}`);
    return { streams: [] };
  }
});

// ---------------------------------------------------------------------------
// Servidor HTTP
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), { port: PORT });

console.log(`\n🎬 SuperFlix Stremio Addon rodando!`);
console.log(`📡 Manifest: http://localhost:${PORT}/manifest.json`);
console.log(`🔗 Stremio: stremio://localhost:${PORT}/manifest.json\n`);
