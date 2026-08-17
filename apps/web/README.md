# Srelok web

Astro 7 static site for [Srelok](https://github.com/sneldao/srelok). Production:
[srelok.netlify.app](https://srelok.netlify.app), API
`https://api.srelok.trustfall.xyz` (`PUBLIC_API_URL` in `netlify.toml`).

```sh
npm install --legacy-peer-deps
npm run dev      # localhost:4321
npm run build
```

Set `PUBLIC_API_URL` when talking to a local daemon (`http://localhost:3200`).
