# Admin Web Dashboard

Next.js 15 — API REST + interface d'administration.

## Modules (roadmap)

| Module | Route | Statut |
|--------|-------|--------|
| Dashboard | `/` | Placeholder |
| Produits | `/products` | À faire |
| Inventaire | `/inventory` | À faire |
| Factures | `/invoices` | À faire |
| Rapports | `/reports` | À faire |
| Utilisateurs | `/users` | À faire |
| Paramètres | `/settings` | À faire |

## API

Les Route Handlers Next.js exposent l'API sous `/api/v1/*`.
Les apps Flutter consomment les mêmes endpoints.

## Structure

```
src/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── invoices/
│   │   └── reports/
│   └── api/v1/
│       ├── auth/
│       ├── products/
│       ├── invoices/
│       ├── payments/
│       └── ...
└── lib/
    ├── auth.ts
    ├── api-utils.ts
    └── services/
```

## Démarrage

```bash
cp .env.example .env.local
pnpm dev
```
