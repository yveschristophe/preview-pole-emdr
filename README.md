# Preview Pôle EMDR Toulouse

Preview commerciale non officielle pour SABAN CORP. La page reprend la direction visuelle des deux captures Figma Make fournies et utilise les trois images WebP transmises avec le brief.

## Développement

```sh
npm ci
npm run dev
```

Contrôles : `npm run lint`, `npm run typecheck`, `npm run build`. Le site est statique, sans backend. `vite.config.ts` fixe la base `/preview-pole-emdr/` pour GitHub Pages.

Le workflow `.github/workflows/deploy.yml` déploie `dist/` depuis `main` avec GitHub Actions. Dans les paramètres du dépôt, GitHub Pages doit utiliser **GitHub Actions** comme source.

## Sources et limites

- Les deux PNG de la maquette ont servi de référence pour la structure desktop et mobile ; le ZIP ne contenait pas de code exporté.
- Les coordonnées et informations professionnelles affichées proviennent de la maquette fournie. Le site officiel `https://pole-emdr.fr/` répondait 403 depuis l'environnement de production de cette preview : ces informations restent à recouper avant un usage client.
- Les images sont des illustrations générées et ne montrent pas nécessairement les locaux réels.
- La preview contient `noindex, nofollow` et la mention « Concept SABAN CORP — Site non officiel ».
