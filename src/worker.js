import { unzipSync, strFromU8 } from 'fflate';

const MANIFEST = {
  id: 'org.sal.forcedsub.it',
  version: '1.0.0',
  name: 'Forced Sub (IT)',
  description: 'Legenda forced em italiano - so os trechos em outro idioma dentro do audio italiano (ex: dothraki em Game of Thrones). Feito para funcionar na Samsung TV Tizen.',
  resources: ['subtitles'],
  types: ['movie', 'series'],
  catalogs: [],
  idPrefixes: ['tt']
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function searchSubdlRaw(env, imdbId, season, episode) {
  const params = new URLSearchParams({
    api_key: env.SUBDL_API_KEY || '',
    imdb_id: imdbId,
    languages: 'IT',
    subs_per_page: '30'
  });
  if (season && episode) {
    params.set('type', 'tv');
    params.set('season_number', season);
    params.set('episode_number', episode);
  } else {
    params.set('type', 'movie');
  }
  const requestUrl = `https://api.subdl.com/api/v1/subtitles?${params.toString()}`;
  const res = await fetch(requestUrl);
  const data = await res.json();
  return { httpStatus: res.status, data, requestUrl: requestUrl.replace(/api_key=[^&]+/, 'api_key=HIDDEN') };
}

async function searchSubdl(env, imdbId, season, episode) {
  const { data } = await searchSubdlRaw(env, imdbId, season, episode);
  if (!data.status) return [];
  return data.subtitles || [];
}

function pickForced(subs) {
  return subs.filter((s) => {
    const text = `${s.release_name || ''} ${s.name || ''}`.toLowerCase();
    return text.includes('forced');
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/' || path === '') {
      return new Response('Stremio Forced Sub (IT) addon. Use /manifest.json no Stremio.', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    if (path === '/manifest.json') {
      return jsonResponse(MANIFEST);
    }

    // Endpoint temporario de diagnostico: /debug?imdb=tt0944947&season=1&episode=1
    if (path === '/debug') {
      const imdbId = url.searchParams.get('imdb');
      const season = url.searchParams.get('season');
      const episode = url.searchParams.get('episode');
      if (!imdbId) return jsonResponse({ error: 'passe ?imdb=tt...' }, 400);
      const hasKey = Boolean(env.SUBDL_API_KEY);
      const raw = await searchSubdlRaw(env, imdbId, season, episode);
      const subs = (raw.data.subtitles || []).map((s) => ({
        release_name: s.release_name,
        name: s.name,
        url: s.url
      }));
      return jsonResponse({ hasKey, ...raw, subsCount: subs.length, subs });
    }

    // /subtitles/movie/tt1234567.json
    // /subtitles/series/tt1234567:1:2.json
    const subMatch = path.match(/^\/subtitles\/(movie|series)\/([^/]+)\.json$/);
    if (subMatch) {
      const [, type, rawId] = subMatch;
      let imdbId = rawId;
      let season;
      let episode;
      if (type === 'series') {
        const parts = rawId.split(':');
        imdbId = parts[0];
        season = parts[1];
        episode = parts[2];
      }
      try {
        const subs = await searchSubdl(env, imdbId, season, episode);
        const forced = pickForced(subs);
        const subtitles = forced.slice(0, 5).map((s, i) => {
          const zipUrl = `https://dl.subdl.com${s.url}`;
          const proxyUrl = `${url.origin}/sub.srt?src=${encodeURIComponent(zipUrl)}`;
          return {
            id: `forcedsub-it-${i}`,
            url: proxyUrl,
            lang: 'ita'
          };
        });
        return jsonResponse({ subtitles });
      } catch (e) {
        return jsonResponse({ subtitles: [] });
      }
    }

    // Proxy: baixa o zip do SubDL, extrai o .srt e devolve como texto puro
    if (path === '/sub.srt') {
      const src = url.searchParams.get('src');
      if (!src) return new Response('missing src', { status: 400 });
      try {
        const zipRes = await fetch(src);
        const buf = new Uint8Array(await zipRes.arrayBuffer());
        const files = unzipSync(buf);
        const srtName = Object.keys(files).find((n) => n.toLowerCase().endsWith('.srt'));
        if (!srtName) return new Response('no srt found in zip', { status: 404 });
        const text = strFromU8(files[srtName]);
        return new Response(text, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (e) {
        return new Response('error unzipping: ' + e.message, { status: 500 });
      }
    }

    return jsonResponse({ error: 'not found' }, 404);
  }
};
