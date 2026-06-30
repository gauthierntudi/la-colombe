# Déploiement — La Colombe

Dashboard Next.js + API REST sur [Vercel](https://vercel.com), base PostgreSQL sur [Neon](https://neon.tech).

**Dépôt** : [github.com/gauthierntudi/la-colombe](https://github.com/gauthierntudi/la-colombe)

**Production** : [https://la-colombe-admin-nine.vercel.app](https://la-colombe-admin-nine.vercel.app/login)

| URL | Lien |
|-----|------|
| Dashboard | https://la-colombe-admin-nine.vercel.app/login |
| API | https://la-colombe-admin-nine.vercel.app/api/v1 |
| Health | https://la-colombe-admin-nine.vercel.app/api/v1/health |

## 1. Vercel — créer le projet

1. Importer le dépôt `gauthierntudi/la-colombe` sur Vercel.
2. **Root Directory** : `apps/admin`
3. **Framework** : Next.js (détecté automatiquement)
4. Cocher **Include source files outside of the Root Directory** (monorepo pnpm).
5. Les commandes install/build sont définies dans `apps/admin/vercel.json`.

## 2. Variables d'environnement (Vercel)

Copier depuis `apps/admin/.env.example` :

| Variable | Requis | Description |
|----------|--------|-------------|
| `DATABASE_URL` | Oui | Connection string Neon (pooled) |
| `JWT_SECRET` | Oui | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | Oui | `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | Oui | `https://la-colombe-admin-nine.vercel.app` |
| `S3_BUCKET` | Oui* | Images produits / avatars |
| `S3_REGION` | Oui* | Région AWS |
| `S3_ACCESS_KEY_ID` | Oui* | Clé IAM |
| `S3_SECRET_ACCESS_KEY` | Oui* | Secret IAM |
| `FLEXPAIE_API_KEY` | Non | Mobile Money (phase ultérieure) |
| `FLEXPAIE_MERCHANT_ID` | Non | |
| `FLEXPAIE_WEBHOOK_SECRET` | Non | |
| `CRON_SECRET` | Non | Expiration factures (cron Vercel) |

\* Requis pour upload d’images en production.

## 3. Base de données (Neon)

Après le premier déploiement, appliquer le schéma et le seed **en local** (avec la même `DATABASE_URL` que Vercel) :

```bash
pnpm db:push
pnpm db:seed
```

Comptes démo après seed : voir [README](../README.md).

## 4. App mobile (Flutter)

L’API est servie sous `/api/v1`. CORS est activé pour les clients mobiles.

Une fois le dashboard déployé, lancer l’app avec l’URL de production :

```bash
cd apps/caisse
flutter run --dart-define=API_BASE_URL=https://la-colombe-admin-nine.vercel.app/api/v1
```

Sur un appareil physique, remplacer par l’URL Vercel (HTTPS).

## 5. Vérifications post-déploiement

- [x] `GET https://la-colombe-admin-nine.vercel.app/api/v1/health` → `{"status":"ok",...}`
- [ ] Connexion admin : `admin@ges.local` / `admin123`
- [ ] Login mobile avec `API_BASE_URL=https://la-colombe-admin-nine.vercel.app/api/v1`
- [ ] Upload image produit (S3 configuré)

## 6. Développement local

```bash
pnpm install
cp apps/admin/.env.example apps/admin/.env.local
cp packages/database/.env.example packages/database/.env
pnpm db:push && pnpm db:seed
pnpm dev
```
