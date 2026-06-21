const axios = require('axios');
const cheerio = require('cheerio');

const SUPERFLIX_BASE = 'https://superflixapi.cyou';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: SUPERFLIX_BASE,
};

/**
 * Busca o HTML de uma URL de embed do SuperFlix e extrai URLs de vídeo.
 */
async function fetchPageAndExtractUrls(url) {
  const res = await axios.get(url, {
    headers: HEADERS,
    timeout: 15000,
    maxRedirects: 10,
  });

  const html = res.data;
  const urls = [];

  // Captura URLs de .m3u8
  const m3u8Matches = html.matchAll(/["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)/g);
  for (const m of m3u8Matches) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }

  // Captura URLs de .mp4
  const mp4Matches = html.matchAll(/["'`](https?:\/\/[^"'`\s]+\.mp4[^"'`\s]*)/g);
  for (const m of mp4Matches) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }

  // Captura fontes em tags <source src="...">
  const $ = cheerio.load(html);
  $('source[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && src.startsWith('http') && !urls.includes(src)) {
      urls.push(src);
    }
  });

  // Captura iframes embutidos para seguir recursivamente
  const iframes = [];
  $('iframe[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && src.startsWith('http')) iframes.push(src);
  });

  return { urls, iframes };
}

/**
 * Resolve recursivamente iframes até encontrar URLs de vídeo.
 * Máximo de 3 níveis para evitar loops infinitos.
 */
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

  // Se já encontrou URLs diretas, retorna
  if (urls.length > 0) return urls;

  // Caso contrário, segue os iframes (excluindo o próprio domínio SuperFlix para evitar loop)
  const followed = [];
  for (const iframe of iframes) {
    if (iframe.includes('superflixapi.cyou') && depth === 0) {
      // Primeiro nível: seguir iframes do próprio site
      const sub = await resolveStreams(iframe, depth + 1);
      followed.push(...sub);
    } else if (!iframe.includes('superflixapi.cyou')) {
      // Seguir players externos (ex: mix_player, outros)
      const sub = await resolveStreams(iframe, depth + 1);
      followed.push(...sub);
    }
  }

  return followed;
}

/**
 * Constrói a URL do embed SuperFlix baseada no tipo e IDs.
 */
function buildEmbedUrl(tmdbId, type, season, episode) {
  if (type === 'movie') {
    return `${SUPERFLIX_BASE}/filme/${tmdbId}`;
  }
  // series/anime/dorama
  if (season && episode) {
    return `${SUPERFLIX_BASE}/serie/${tmdbId}/${season}/${episode}`;
  }
  if (season) {
    return `${SUPERFLIX_BASE}/serie/${tmdbId}/${season}`;
  }
  return `${SUPERFLIX_BASE}/serie/${tmdbId}`;
}

/**
 * Retorna os streams do Stremio a partir de um TMDB ID.
 */
async function fetchStreamsFromTmdb(tmdbId, type, season, episode) {
  const embedUrl = buildEmbedUrl(tmdbId, type, season, episode);
  console.log(`[SuperFlix] Buscando embed: ${embedUrl}`);

  const videoUrls = await resolveStreams(embedUrl);

  if (!videoUrls || videoUrls.length === 0) {
    console.log(`[SuperFlix] Nenhuma URL de vídeo encontrada para ${embedUrl}`);
    return [];
  }

  return videoUrls.map((url, idx) => {
    const isHls = url.includes('.m3u8');
    return {
      title: `SuperFlix ${isHls ? 'HLS' : 'MP4'} ${idx > 0 ? `(${idx + 1})` : ''}`.trim(),
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
    };
  });
}

module.exports = { fetchStreamsFromTmdb };
