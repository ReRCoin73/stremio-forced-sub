const MANIFEST = {
  id: 'org.sal.forcedsub.it',
  version: '1.1.0',
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

// Converte "tt0944947" -> 944947 (formato que a OpenSubtitles espera)
function toOsImdbId(imdbId) {
  return parseInt(String(imdbId).replace(/^tt0*/, ''), 10);
}

async function osFetch(env, path, { method = 'GET', params, body } = {}) {
  let url = `https://api.opensubtitles.com/api/v1${path}`;
  if (params) {
    const qs = new URLSearchParams(params);
    url += `?${qs.toString()}`;
  }
  const headers = {
    'Api-Key': env.OPENSUBTITLES_API_KEY || '',
    'User-Agent': 'stremio-forced-sub v1.1.0',
    Accept: 'application/json'
  };
  const init = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    data = { parseError: String(e) };
  }
  return { status: res.status, data };
}

async function searchForcedItalian(env, imdbId, season, episode) {
  const params = {
    imdb_id: String(toOsImdbId(imdbId)),
    languages: 'it',
    ai_translated: 'exclude'
  };
  if (season && episode) {
    params.season_number = season;
    params.episode_number = episode;
  }
  const { status, data } = await osFetch(env, '/subtitles', { params });
  const items = (data && data.data) || [];
  const forced = items.filter((it) => it.attributes && it.attributes.foreign_parts_only === true);
  return { status, allCount: items.length, forced };
}

async function getDownloadLink(env, fileId) {
  const { status, data } = await osFetch(env, '/download', {
    method: 'POST',
    body: { file_id: fileId, sub_format: 'srt' }
  });
  return { status, link: data && data.link, raw: data };
}

function parseSubtitlesPath(path) {
  const m = path.match(/^\/subtitles\/(movie|series)\/([^/]+)\.json$/);
  if (!m) return null;
  const [, type, rawId] = m;
  if (type === 'series') {
    const [imdbId, season, episode] = rawId.split(':');
    return { type, imdbId, season, episode };
  }
  return { type, imdbId: rawId };
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

    // Diagnostico: /debug?imdb=tt0944947&season=1&episode=1
    if (path === '/debug') {
      const imdbId = url.searchParams.get('imdb');
      const season = url.searchParams.get('season');
      const episode = url.searchParams.get('episode');
      if (!imdbId) return jsonResponse({ error: 'passe ?imdb=tt...' }, 400);
      const hasKey = Boolean(env.OPENSUBTITLES_API_KEY);
      const result = await searchForcedItalian(env, imdbId, season, episode);
      return jsonResponse({
        hasKey,
        searchStatus: result.status,
        totalItalianSubs: result.allCount,
        forcedCount: result.forced.length,
        forced: result.forced.map((f) => ({
          release: f.attributes.release,
          foreign_parts_only: f.attributes.foreign_parts_only,
          hearing_impaired: f.attributes.hearing_impaired,
          file_id: f.attributes.files && f.attributes.files[0] && f.attributes.files[0].file_id
        }))
      });
    }

    const parsed = parseSubtitlesPath(path);
    if (parsed) {
      try {
        const { forced } = await searchForcedItalian(env, parsed.imdbId, parsed.season, parsed.episode);
        const subtitles = [];
        for (let i = 0; i < Math.min(forced.length, 3); i++) {
          const files = forced[i].attributes.files || [];
          if (!files.length) continue;
          const { link } = await getDownloadLink(env, files[0].file_id);
          if (link) {
            subtitles.push({ id: `forced-it-${i}`, url: link, lang: 'ita' });
          }
        }
        return jsonResponse({ subtitles });
      } catch (e) {
        return jsonResponse({ subtitles: [], error: String(e) });
      }
    }

    return jsonResponse({ error: 'not found' }, 404);
  }
};
