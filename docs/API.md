# Spécification API REST — v1

Base URL : `https://{domain}/api/v1`

## Authentification

Toutes les routes (sauf `/auth/*`) requièrent :
```
Authorization: Bearer <access_token>
```

### POST /auth/login
```json
// Request
{ "email": "user@boutique.com", "password": "..." }

// Response 200
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "...",
    "name": "...",
    "role": "FACTURANT",
    "pointOfSales": [
      { "id": "...", "code": "KIN-01", "name": "Kinshasa Centre", "type": "STORE" }
    ]
  }
}
```

### POST /auth/refresh
```json
{ "refreshToken": "eyJ..." }
```

---

## Points de vente & dépôts

### GET /points-of-sale
Query : `?type=STORE|DEPOT&active=true`

### POST /points-of-sale `[ADMIN]`
```json
{
  "code": "KIN-01",
  "name": "Kinshasa Centre",
  "type": "STORE",
  "address": "Avenue ...",
  "phone": "+243...",
  "invoicePrefix": "KIN-FAC",
  "yocoPrintEnabled": true,
  "yocoDeviceId": "..."
}
```

### GET /points-of-sale/:id
### PUT /points-of-sale/:id `[ADMIN]`
### POST /points-of-sale/:id/users `[ADMIN]` — assigner un utilisateur
```json
{ "userId": "uuid" }
```

---

## Produits

### GET /products
Query : `?search=&categoryId=&page=1&limit=20&active=true`

### POST /products `[ADMIN, MANAGER]`
```json
{
  "name": "Produit A",
  "sku": "PRD-001",
  "barcode": "3760123456789",
  "categoryId": "uuid",
  "unitPrice": 25000,
  "taxRate": 16.0,
  "minStockLevel": 5
}
```

### GET /products/:id
### PUT /products/:id `[ADMIN, MANAGER]`
### DELETE /products/:id `[ADMIN]` (soft delete)

---

## Catégories

### GET /categories
### POST /categories `[ADMIN]`
### PUT /categories/:id `[ADMIN]`
### DELETE /categories/:id `[ADMIN]`

---

## Inventaire

> Toutes les opérations stock requièrent un `pointOfSaleId`.

### GET /inventory
Query : `?pointOfSaleId=uuid&search=&belowMinStock=true`

Retourne produits avec `physicalStock`, `reservedStock`, `availableStock` **pour le site demandé**.

### GET /inventory/movements
Query : `?pointOfSaleId=&productId=&type=&from=&to=&page=1`

### POST /inventory/adjust `[ADMIN, MANAGER]`
```json
{
  "pointOfSaleId": "uuid",
  "productId": "uuid",
  "quantity": 10,
  "type": "ADJUSTMENT",
  "reason": "Inventaire physique juin 2026"
}
```

### POST /inventory/receive `[ADMIN, MANAGER]`
```json
{
  "pointOfSaleId": "uuid",
  "productId": "uuid",
  "quantity": 50,
  "reason": "Réception commande fournisseur #123"
}
```

### POST /inventory/transfer `[ADMIN, MANAGER]`
Transfert entre dépôt et magasin (ou entre sites).
```json
{
  "fromId": "uuid-depot",
  "toId": "uuid-store",
  "lines": [
    { "productId": "uuid", "quantity": 20 }
  ],
  "notes": "Réappro Kinshasa"
}
```

---

## Factures

### GET /invoices
Query : `?pointOfSaleId=&status=PENDING_PAYMENT&from=&to=&createdBy=&page=1`

### POST /invoices `[FACTURANT, ADMIN, MANAGER]`
```json
{
  "pointOfSaleId": "uuid",
  "customerName": "Jean Dupont",
  "customerPhone": "+243812345678",
  "lines": [
    {
      "productId": "uuid",
      "quantity": 2,
      "unitPrice": 25000,
      "discountPercent": 0
    }
  ],
  "notes": "Livraison prévue demain"
}
```
→ Crée une facture en statut `DRAFT`. `customerName` et `customerPhone` sont optionnels.

### GET /invoices/:id
### PATCH /invoices/:id `[FACTURANT]` (DRAFT uniquement)
### POST /invoices/:id/validate `[FACTURANT]`
Valide la facture → `PENDING_PAYMENT`, réserve le stock **du point de vente émetteur**.

### POST /invoices/:id/cancel
Permissions selon statut (voir WORKFLOWS.md).

---

## Paiements

### POST /payments `[CAISSIER, ADMIN, MANAGER]` — Espèces

Encaissement immédiat en espèces. Met la facture à `PAID` si le total est couvert.

```json
{
  "invoiceId": "uuid",
  "cashSessionId": "uuid",
  "payments": [
    { "method": "CASH", "amount": 80000 }
  ]
}
```

Paiement mixte espèces + Mobile Money :
```json
{
  "invoiceId": "uuid",
  "cashSessionId": "uuid",
  "payments": [
    { "method": "CASH", "amount": 30000 },
    { "method": "MOBILE_MONEY", "amount": 50000, "paymentId": "uuid-pending-flexpaie" }
  ]
}
```

> La partie Mobile Money doit d'abord être initiée via `/payments/mobile-money/initiate` et confirmée (webhook Flexpaie) avant de finaliser le mixte.

### POST /payments/mobile-money/initiate `[CAISSIER]`

Initie un paiement Mobile Money via **Flexpaie** (côté serveur).

```json
{
  "invoiceId": "uuid",
  "cashSessionId": "uuid",
  "amount": 50000,
  "phone": "+243812345678",
  "provider": "ORANGE"
}
```

```json
// Response 202
{
  "paymentId": "uuid",
  "status": "PENDING",
  "flexpaieReference": "FP-abc123",
  "message": "Demande envoyée au client. En attente de confirmation."
}
```

L'app poll `GET /payments/:id` jusqu'à `status: COMPLETED` ou `FAILED`.

### POST /webhooks/flexpaie

Callback Flexpaie (non authentifié JWT — signature webhook vérifiée).

```json
{
  "transactionId": "...",
  "reference": "FP-abc123",
  "status": "SUCCESS",
  "amount": 50000
}
```

→ Met à jour `Payment` → `COMPLETED`, facture → `PAID` si total couvert, déduit le stock.

### GET /payments/:id

Retourne le statut du paiement (`PENDING` | `COMPLETED` | `FAILED`) et les références Flexpaie le cas échéant.

---

## Sessions caisse

### GET /cash-sessions
### POST /cash-sessions/open `[CAISSIER]`
```json
{
  "pointOfSaleId": "uuid",
  "openingCash": 50000
}
```

### POST /cash-sessions/:id/close `[CAISSIER]`
```json
{ "closingCash": 450000, "notes": "..." }
```

### GET /cash-sessions/:id/summary

---

## Clients (optionnel)

Recherche par nom ou téléphone. Les deux champs sont optionnels.

### GET /customers?search=
### POST /customers
```json
{ "name": "Jean Dupont", "phone": "+243812345678" }
```
### GET /customers/:id

---

## Rapports `[ADMIN, MANAGER]`

### GET /reports/sales
Query : `?pointOfSaleId=&from=2026-06-01&to=2026-06-30&groupBy=day`

### GET /reports/top-products
### GET /reports/cash-sessions
### GET /reports/inventory-valuation

---

## Codes d'erreur

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Token invalide ou expiré |
| `FORBIDDEN` | 403 | Rôle insuffisant |
| `NOT_FOUND` | 404 | Ressource introuvable |
| `INSUFFICIENT_STOCK` | 409 | Stock insuffisant sur ce point de vente |
| `POINT_OF_SALE_MISMATCH` | 409 | Facture / session sur un autre site |
| `INVALID_STATUS` | 409 | Transition de statut invalide |
| `ALREADY_PAID` | 409 | Facture déjà encaissée |
| `PAYMENT_PENDING` | 409 | Paiement Flexpaie encore en attente |
| `FLEXPAIE_ERROR` | 502 | Erreur API Flexpaie |
| `VALIDATION_ERROR` | 422 | Données invalides |

Format erreur :
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Stock insuffisant pour Produit A (disponible: 1, demandé: 3)",
    "details": { "productId": "...", "available": 1, "requested": 3 }
  }
}
```
