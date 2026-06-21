require('dotenv').config();

const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { imdbToTmdb } = require('./lib/tmdb');
const { fetchStreamsFromTmdb } = require('./lib/superflix');

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

const manifest = {
  id: 'community.superflix.addon',
  version: '1.0.0',
  name: 'SuperFlix',
  description:
    'Streams de filmes, séries e animes em português via SuperFlixAPI. ' +
    'Suporta filmes (IMDB), séries e animes com seleção de temporada/episódio.',
  logo: 'https://superflixapi.cyou/favicon.ico',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [],
  behaviorHints: {
    adult: false,
    p2p: false,
  },
};

// ---------------------------------------------------------------------------
// Addon Builder
// ---------------------------------------------------------------------------

const builder = new addonBuilder(manifest);

/**
 * Handler de streams.
 *
 * Para filmes: id = "tt1234567"
 * Para séries: id = "tt1234567:season:episode"
 */
builder.defineStreamHandler(async ({ type, id }) => {
  console.log(`\n[Addon] Stream solicitado — type: ${type} | id: ${id}`);

  try {
    let imdbId = id;
    let season = null;
    let episode = null;

    // Para séries, o id vem no formato "tt1234567:S:E"
    if (type === 'series') {
      const parts = id.split(':');
      imdbId = parts[0];
      season = parts[1] || '1';
      episode = parts[2] || '1';
    }

    // Converte IMDB ID → TMDB ID
    const tmdbId = await imdbToTmdb(imdbId, type);
    console.log(`[Addon] IMDB ${imdbId} → TMDB ${tmdbId}`);

    // Busca streams na SuperFlix
    const streams = await fetchStreamsFromTmdb(tmdbId, type, season, episode);

    if (streams.length === 0) {
      console.log(`[Addon] Nenhum stream encontrado.`);
      return { streams: [] };
    }

    console.log(`[Addon] ${streams.length} stream(s) encontrado(s).`);
    return { streams };
  } catch (err) {
    console.error(`[Addon] Erro no handler de streams: ${err.message}`);
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
console.log(
  `🔗 URL de instalação no Stremio: stremio://localhost:${PORT}/manifest.json\n`
);
