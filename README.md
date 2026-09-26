# stremio-forced-sub

Addon Stremio que serve so a legenda **forced** em italiano (o trecho de um idioma
diferente dentro do audio italiano, tipo o dothraki em Game of Thrones).
Feito porque os outros addons de legenda nao funcionam direito na Samsung TV (Tizen).

Fonte: OpenSubtitles REST API, filtrando pelo campo `foreign_parts_only` (que e
exatamente a marcacao oficial de "forced sub").

## Rotas

- `/manifest.json` - manifesto do addon
- `/subtitles/movie/{imdbId}.json`
- `/subtitles/series/{imdbId}:{season}:{episode}.json`
- `/debug?imdb=tt...&season=&episode=` - mostra o que a OpenSubtitles retornou (diagnostico)

## Deploy no Cloudflare

1. Secret necessaria: `OPENSUBTITLES_API_KEY` (gerada em opensubtitles.com/en/consumers,
   com "Allow anonymous downloads" marcado, pra nao precisar guardar usuario/senha).
2. Repositorio conectado ao Cloudflare Workers (build automatico a cada push).
