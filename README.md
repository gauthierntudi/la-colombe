# La Colombe — GES Boutique

Système de gestion boutique pour la **RDC** : administration web et application mobile Android (facturation + caisse selon le rôle).

**Dépôt GitHub** : [gauthierntudi/la-colombe](https://github.com/gauthierntudi/la-colombe) · **Admin (prod)** : [la-colombe-admin-nine.vercel.app](https://la-colombe-admin-nine.vercel.app/login) · **Déploiement** : [docs/DEPLOY.md](docs/DEPLOY.md)

**Devise** : CDF · **Mobile Money** : Flexpaie API · **Impression** : Yoco POS (Android)

## Applications

| Application | Stack | Rôle |
|-------------|-------|------|
| **Admin** | Next.js, React, Prisma | Dashboard web — produits, inventaire, rapports, opérations admin |
| **GES Boutique** | Flutter (Android) | App mobile — facturation (`FACTURANT`) et caisse (`CAISSIER`) selon le rôle |

## Stack technique

- **Base de données** : PostgreSQL (Neon)
- **ORM** : Prisma
- **API & Admin** : Next.js 15 (App Router) + React
- **Mobile** : Flutter (Android — `apps/caisse`)

## Structure du monorepo

```
GES-PRODUCT/
├── apps/
│   ├── admin/              # Dashboard Next.js + API REST
│   └── caisse/             # App Flutter Android — GES Boutique (facturation + caisse)
├── packages/
│   └── database/           # Schéma Prisma partagé
└── docs/
    ├── ARCHITECTURE.md     # Architecture détaillée
    ├── API.md              # Spécification API
    └── WORKFLOWS.md        # Flux métier
```

## Démarrage rapide

```bash
# Installer les dépendances
pnpm install

# Générer le client Prisma
pnpm db:generate

# Configurer Neon — copier et renseigner DATABASE_URL + JWT
cp apps/admin/.env.example apps/admin/.env.local
cp packages/database/.env.example packages/database/.env
# Même DATABASE_URL dans les deux fichiers

# Pousser le schéma et seed
pnpm db:push
pnpm db:seed

# Lancer l'admin (http://localhost:3000)
pnpm dev
```

**Comptes démo** (après seed) :
- Admin : `admin@ges.local` / `admin123`
- Facturant : `facturant@ges.local` / `facturant123`
- Caissier : `caissier@ges.local` / `caissier123`

## Déploiement (Vercel + mobile)

1. Pousser sur GitHub : `git push -u origin main`
2. Importer le projet sur Vercel — **Root Directory** : `apps/admin`
3. Configurer les variables d’environnement (voir [docs/DEPLOY.md](docs/DEPLOY.md))
4. Tester l’app mobile :

```bash
cd apps/caisse
flutter run --dart-define=API_BASE_URL=https://la-colombe-admin-nine.vercel.app/api/v1
```

## Documentation

- [Déploiement Vercel + mobile](docs/DEPLOY.md)
- [Décisions produit (RDC)](docs/DECISIONS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API REST](docs/API.md)
- [Flux métier](docs/WORKFLOWS.md)
