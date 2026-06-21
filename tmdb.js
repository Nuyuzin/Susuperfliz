const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const cache = new Map();

/**
 * Converte um IMDB ID (ex: tt0137523) para um TMDB ID.
 * Usa a TMDB Find API com external_source=imdb_id.
 */
async function imdbToTmdb(imdbId, type) {
  const cacheKey = `${imdbId}:${type}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  if (!TMDB_API_KEY) {
    throw new Error(
      'TMDB_API_KEY não configurada. Adicione ao arquivo .env ou variável de ambiente.'
    );
  }

  try {
    const res = await axios.get(`${TMDB_BASE}/find/${imdbId}`, {
      params: { api_key: TMDB_API_KEY, external_source: 'imdb_id' },
      timeout: 8000,
    });

    const data = res.data;
    let tmdbId = null;

    if (type === 'movie' && data.movie_results && data.movie_results.length > 0) {
      tmdbId = data.movie_results[0].id;
    } else if (
      type === 'series' &&
      data.tv_results &&
      data.tv_results.length > 0
    ) {
      tmdbId = data.tv_results[0].id;
    }

    if (!tmdbId) {
      throw new Error(`TMDB ID não encontrado para ${imdbId} (type: ${type})`);
    }

    cache.set(cacheKey, tmdbId);
    return tmdbId;
  } catch (err) {
    if (err.response) {
      throw new Error(`Erro TMDB API: ${err.response.status} — ${err.message}`);
    }
    throw err;
  }
}

module.exports = { imdbToTmdb };
