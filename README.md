# stremio-forced-sub

Addon Stremio que serve so a legenda **forced** em italiano (o trecho de um idioma
diferente dentro do audio italiano, tipo o dothraki em Game of Thrones).
Feito porque os outros addons de legenda nao funcionam direito na Samsung TV (Tizen).

## Como funciona

- `/manifest.json` - manifesto do addon
- `/subtitles/movie/{imdbId}.json` - legenda forced de um filme
- `/subtitles/series/{imdbId}:{season}:{episode}.json` - legenda forced de um episodio
- `/sub.srt?src=...` - proxy interno: baixa o .zip do SubDL, extrai o .srt e devolve
  como texto puro (pro player conseguir ler direto, sem precisar abrir zip)

Fonte das legendas: [SubDL](https://subdl.com/api-doc). Como a SubDL nao tem um campo
"forced" dedicado, o filtro procura a palavra "forced" no nome do release/arquivo.

## Deploy no Cloudflare

1. Configurar a variavel secreta no Cloudflare (nao commitar a key):
   `wrangler secret put SUBDL_API_KEY`
2. Conectar este repositorio a um Cloudflare Worker (via dashboard ou `wrangler deploy`).
3. Adicionar a URL do worker + `/manifest.json` no Stremio como addon.
