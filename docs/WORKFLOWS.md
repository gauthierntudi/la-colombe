# Flux métier — GES Boutique (RDC)

## 1. Mise en place initiale (Admin)

1. Créer le compte administrateur
2. Configurer l'organisation (nom, devise **CDF**, TVA par défaut 16 %)
3. Créer les **points de vente** (`STORE`) et **dépôts** (`DEPOT`)
4. Créer les catégories de produits
5. Importer ou créer les produits (prix en CDF entiers)
6. Initialiser le stock par site (dépôt central, puis transferts vers magasins)
7. Créer les comptes utilisateurs et les **assigner aux sites**
8. Configurer **Flexpaie** (clés API organisation) et imprimante **Yoco POS** par point de vente

---

## 2. Réapprovisionnement dépôt → magasin

```
Admin → Inventaire → "Transfert"
  → Source : Dépôt central (DEPOT)
  → Destination : Magasin Kinshasa (STORE)
  → Lignes : produits + quantités
  → Validation
  → TRANSFER_OUT sur le dépôt
  → TRANSFER_IN sur le magasin
```

**Règles** :
- Impossible de transférer plus que le stock disponible au dépôt
- Traçabilité complète via `StockTransfer` + mouvements

---

## 3. Vente classique (Facturation → Caisse)

### Étape A — Établir la facture (App Facturation)

```
Vendeur ouvre l'app
  → Se connecte
  → Sélectionne le point de vente actif (ex: Kinshasa Centre)
  → "Nouvelle facture"
  → Ajoute produits (stock du site actif uniquement)
  → Applique remise si besoin
  → Saisit client : nom et/ou téléphone (optionnels)
  → "Valider la facture"
  → Facture #KIN-FAC-0042 → statut PENDING_PAYMENT
  → Stock réservé sur le point de vente Kinshasa
```

**Règles** :
- Impossible de valider si stock insuffisant **sur ce point de vente**
- Numéro de facture généré par site (`{prefix}-{num}`)
- La facture validée n'est plus modifiable (annulation uniquement via admin)
- Client entièrement optionnel (facture anonyme autorisée)

### Étape B — Encaisser (App Caisse — Android)

```
Caissier ouvre l'app (Android)
  → Sélectionne le même point de vente
  → Ouvre sa session de caisse
  → Recherche facture #KIN-FAC-0042 (même site uniquement)
  → Vérifie le montant TTC en CDF
  → Choisit mode de paiement
     → Espèces : saisie montant reçu, calcul rendu → encaissement immédiat
     → Mobile Money : saisie téléphone + opérateur → API Flexpaie
        → Client confirme sur son téléphone (USSD/push)
        → Webhook Flexpaie confirme → facture PAID
     → Mixte : espèces + Mobile Money
  → Paiement confirmé
  → Facture → PAID
  → Stock déduit sur le point de vente
  → Impression bon de sortie via Yoco POS
```

**Règles** :
- Une facture ne peut être encaissée que sur **son point de vente d'origine**
- Impression Yoco uniquement si `yocoPrintEnabled` sur le site
- Yoco sert **uniquement à imprimer** — jamais à encaisser

---

## 4. Session de caisse

### Ouverture
- Caissier se connecte et sélectionne son point de vente
- Ouvre une session (fond de caisse espèces en CDF, optionnel)
- Une seule session ouverte par caissier **et par site** à la fois

### Pendant la session
- Tous les encaissements sont rattachés à la session et au site
- Suivi espèces vs Mobile Money en temps réel

### Clôture
- Caissier clôture la session
- Saisie du montant espèces compté (CDF)
- Écart calculé automatiquement (théorique vs réel)
- Rapport de session généré par point de vente

---

## 5. Gestion inventaire (Admin)

### Réception stock (dépôt)
```
Admin → Inventaire → "Entrée stock"
  → Sélection point de vente / dépôt
  → Sélection produit
  → Quantité + motif (achat fournisseur...)
  → Mouvement PURCHASE_IN enregistré sur ce site
```

### Ajustement inventaire
```
Admin → Inventaire → "Ajustement"
  → Site + produit + nouvelle quantité ou delta
  → Motif obligatoire (casse, inventaire physique, erreur...)
  → Mouvement ADJUSTMENT sur ce site
```

### Alerte seuil
- Seuil `minStockLevel` évalué **par site**
- Dashboard admin : produits sous seuil, filtrable par point de vente

---

## 6. Annulation de facture

| Statut actuel | Qui peut annuler | Effet stock |
|---------------|------------------|-------------|
| DRAFT | Facturant (propriétaire) | Aucun |
| PENDING_PAYMENT | Admin, Manager | Libère réservation sur le site |
| PAID | Admin uniquement | Retour stock (RETURN) sur le site + avoir |

---

## 7. Bon de sortie (impression Caisse)

Contenu du ticket :
```
══════════════════════════════
        [NOM BOUTIQUE]
   Kinshasa Centre — RDC
══════════════════════════════
BON DE SORTIE
N° : KIN-FAC-0042
Date : 29/06/2026 14:32
Caissier : Marie D.
Client : Jean Dupont
Tél. : +243 812 345 678
──────────────────────────────
Produit A          x2   50 000
Produit B          x1   30 000
──────────────────────────────
Sous-total HT            68 966
TVA 16%                  11 034
TOTAL TTC                80 000 FC
──────────────────────────────
Payé : Espèces              30 000
Payé : Mobile Money         50 000
Ref Flexpaie : FP-abc123
Opérateur : Orange Money
══════════════════════════════
   Merci de votre visite !
   (imprimé via Yoco POS)
══════════════════════════════
```

---

## 8. Cas limites

| Cas | Comportement |
|-----|--------------|
| Facture expirée (24h sans paiement) | Cron libère réservation sur le site, statut EXPIRED |
| Paiement Flexpaie échoué / expiré | Payment → FAILED, facture reste PENDING_PAYMENT, retry possible |
| Paiement Flexpaie en attente | App poll le statut, timeout après X min |
| Double scan même facture | Idempotence : 2e paiement rejeté si déjà PAID |
| Encaissement sur mauvais site | Rejet `POINT_OF_SALE_MISMATCH` |
| Produit désactivé après facturation | Encaissement autorisé (prix figé sur la ligne) |
| Hors connexion (Facturation) | Brouillon local, sync à la reconnexion |
| Hors connexion (Caisse) | Bloqué — paiement et sync requis |
| Transfert dépôt → magasin partiel | Transaction atomique, rollback si stock insuffisant |
