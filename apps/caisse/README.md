# GES Boutique (Flutter Android)

Application mobile unique pour la boutique : **facturation** et **caisse**, avec accès selon le rôle utilisateur.

| Rôle | Modules |
|------|---------|
| `FACTURANT` | Création et validation de factures |
| `CAISSIER` | Encaissement, sessions caisse, impression bon de sortie |
| `ADMIN` / `MANAGER` | Facturation + caisse |

## Prérequis

- Flutter SDK 3.12+
- API admin : `pnpm dev` (port 3000)

## Lancement

```bash
cd apps/caisse
flutter pub get
flutter run
```

### URL API

| Plateforme        | URL API                          |
|-------------------|----------------------------------|
| Android émulateur | `http://10.0.2.2:3000/api/v1`    |
| iOS / macOS       | `http://localhost:3000/api/v1`   |

Appareil physique :

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3000/api/v1
```

## Comptes démo

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Facturant | `facturant@ges.local` | `facturant123` |
| Caissier | `caissier@ges.local` | `caissier123` |
| Admin | `admin@ges.local` | `admin123` |

Session caisse démo ouverte sur KIN-01 (fond 50 000 FC) après seed.

## Fonctionnalités

### Facturation (`FACTURANT`, `ADMIN`, `MANAGER`)
- Recherche produits (stock du site actif)
- Création et validation de facture → `PENDING_PAYMENT`

### Caisse (`CAISSIER`, `ADMIN`, `MANAGER`)
- Ouverture / clôture session caisse (obligatoire pour `CAISSIER`)
- Recherche factures `PENDING_PAYMENT`
- Encaissement **espèces**, **Mobile Money** (Flexpaie) et **mixte**
- Mode démo MM : bouton « Confirmer » (Flexpaie mock)
- **Impression bon de sortie** : Yoco POS (canal natif) ou PDF système en repli

### Impression Yoco

1. Admin → **Paramètres** → section **Yoco POS** : coller le [secret d'intégration SDK](https://developer.yoco.com/sdks/payment-sdk/android/configuration)
2. Admin → **Points de vente** : activer **Yoco** sur le magasin
3. Sur tablette Android Yoco : l'app configure le SDK au démarrage et imprime via le service d'impression système

Variable serveur optionnelle : `YOCO_INTEGRATION_SECRET` ou `YOCO_ENVIRONMENT=SANDBOX`

## Flux

```
Facturant : créer facture → valider → PENDING_PAYMENT
Caissier  : ouvrir session → encaisser → PAID → bon de sortie
            clôturer session → comptage caisse + écart
```
