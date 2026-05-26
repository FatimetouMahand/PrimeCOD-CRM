# PrimeCOD — CRM & Analytics

> Systeme CRM + Analytics complet pour les businesses **COD (Cash on Delivery)** en Mauritanie. Integration native avec **Shopify** via webhooks, distribution automatique des commandes aux agents, et tableau de bord temps reel.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Table des matieres

- [Apercu](#apercu)
- [Fonctionnalites](#fonctionnalites)
- [Stack technique](#stack-technique)
- [Demarrage rapide](#demarrage-rapide)
- [Variables d'environnement](#variables-denvironnement)
- [Comptes de test](#comptes-de-test)
- [Structure du projet](#structure-du-projet)
- [Roles et permissions](#roles-et-permissions)
- [API Endpoints](#api-endpoints)
- [Integration Shopify](#integration-shopify)
- [Deploiement sur Vercel](#deploiement-sur-vercel)
- [Scripts disponibles](#scripts-disponibles)
- [Licence](#licence)

---

## Apercu

PrimeCOD est une plateforme tout-en-un pour gerer les commandes **Cash on Delivery** en Mauritanie. Elle remplace les feuilles Excel et les groupes WhatsApp par un systeme centralise qui :

- Recoit les commandes automatiquement depuis Shopify
- Les distribue a l'agent le plus disponible (load balancing)
- Suit chaque commande de la creation a la livraison
- Fournit des analytics en temps reel pour la prise de decision

**Devise** : Ouguiya Mauritanien (MRU)
**Langues** : Francais + Arabe (IBM Plex Sans Arabic + Hanken Grotesk)

---

## Fonctionnalites

### Tableau de bord
- Statistiques temps reel : commandes, revenus, taux de confirmation, commandes en attente
- Indicateurs de croissance vs hier (`+12%`, `-5%`)
- Filtres par date (aujourd'hui / semaine / mois) et multi-produits
- Graphiques : meilleurs agents, meilleurs produits, evolution des revenus
- Vue specifique par role (Admin voit tout, Agent voit ses propres stats)

### Gestion des commandes
- Tableau avec **infinite scroll** (cursor-based, pas de pagination)
- Colonnes personnalisables (afficher / masquer)
- Filtres : recherche, statut, produit, date
- Actions groupees (bulk delete avec confirmation)
- Reassignation manuelle d'agent
- Fenetre de rappels basee sur `alertAfterHours`
- Modification de statut en un clic

### Gestion des employes
- Ajout / modification / suspension d'agents
- Changement de mot de passe a distance
- **Statut de connexion temps reel** (heartbeat toutes les 60s)
- Filtres : actifs / suspendus
- Statut compte (Actif / Suspendu) distinct du statut connexion (En ligne / Hors ligne)

### Gestion des produits
- Code produit auto-genere (`NOM-1234`)
- 2 modes de distribution :
  - **Libre** : tous les agents disponibles
  - **Specifique** : seulement les agents assignes
- Detection automatique des produits non enregistres (depuis webhook Shopify)

### Gestion des statuts
- Creation de statuts avec couleur personnalisee
- Alertes de suivi apres X heures (rappel automatique)
- Statut **final** (commande terminee, pas de redistribution)
- **Soft delete** : les anciennes commandes gardent leur etiquette

### Distribution automatique
- Toutes les **5 minutes** : redistribution des commandes des agents hors ligne
- Algorithme : selection de l'agent avec le moins de commandes actives
- Equilibrage de charge entre agents en ligne

### Securite
- Auth JWT (cookie httpOnly, 30 jours)
- Mots de passe hashes avec bcrypt (cost 10)
- Verification HMAC-SHA256 des webhooks Shopify
- Filtrage role-based au niveau API + UI

### Responsive
- 100% mobile-friendly (PC, tablette, telephone)
- Sidebar overlay sur mobile avec backdrop
- Tables scrollables horizontalement
- Inputs `font-size: 16px` (anti-zoom iOS)

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) |
| Langage | **TypeScript** (strict mode) |
| Base de donnees | **PostgreSQL** |
| ORM | **Prisma 6** |
| Auth | **JWT** custom (jsonwebtoken + bcryptjs) |
| Charts | **Recharts** |
| Icons | **Lucide React** |
| Styling | CSS-in-JS (inline styles) + globals.css |
| Fonts | Hanken Grotesk, Montserrat, IBM Plex Sans Arabic |

---

## Demarrage rapide

### Prerequis

- **Node.js** 20 ou superieur
- **PostgreSQL** 14 ou superieur (local ou cloud)
- **npm** ou **pnpm**

### Installation

```bash
# 1. Cloner le repo
git clone https://github.com/VOTRE-USER/primecod-crm.git
cd primecod-crm

# 2. Installer les dependances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Puis editer .env avec vos valeurs (voir section suivante)

# 4. Creer la base de donnees et appliquer les migrations
npx prisma migrate deploy
npx prisma generate

# 5. Creer le compte Admin initial
npx tsx scripts/create-admin.ts

# 6. (Optionnel) Creer des donnees de test
npx tsx scripts/seed-test.ts

# 7. Lancer le serveur de developpement
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

---

## Variables d'environnement

Creez un fichier `.env` a la racine du projet :

```env
# Base de donnees PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/primecod"

# Secret JWT (generer avec: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
JWT_SECRET="votre_secret_de_96_caracteres_hexadecimaux"

# Environnement
NODE_ENV="development"

# (Production) URL publique de l'app (pour les webhooks Shopify)
NEXT_PUBLIC_APP_URL="https://votre-domaine.com"
```

> **Important** : Ne commitez **jamais** le fichier `.env`. Il est deja dans `.gitignore`.

---

## Comptes de test

Apres avoir execute `scripts/create-admin.ts` et `scripts/seed-test.ts` :

| Role | Telephone | Mot de passe |
|---|---|---|
| **Admin** | `+22200000000` | `Admin@123` |
| **Agent 1** (Ahmed) | `+22241000001` | `Agent@123` |
| **Agent 2** (Fatima) | `+22241000002` | `Agent@456` |

---

## Structure du projet

```
primecod-crm/
├── app/
│   ├── (dashboard)/            # Routes protegees (sidebar layout)
│   │   ├── dashboard/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── employees/page.tsx
│   │   ├── products/page.tsx
│   │   ├── statuses/page.tsx
│   │   ├── settings/page.tsx
│   │   └── layout.tsx
│   ├── api/                    # Routes API
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── me/route.ts
│   │   ├── dashboard/route.ts
│   │   ├── orders/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   ├── distribute/route.ts
│   │   │   └── rebalance/route.ts
│   │   ├── employees/
│   │   ├── products/
│   │   ├── statuses/
│   │   ├── settings/
│   │   ├── agents/route.ts
│   │   ├── heartbeat/route.ts
│   │   ├── system/stats/route.ts
│   │   ├── shopify/stores/
│   │   └── webhooks/shopify/route.ts
│   ├── login/page.tsx          # Page de connexion (publique)
│   ├── globals.css             # Styles globaux + responsive
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Redirection vers /dashboard
├── components/
│   ├── DashboardShell.tsx      # Sidebar + navbar + responsive logic
│   ├── SessionBar.tsx          # Avatar + logout (avec heartbeat)
│   └── RebalanceWatcher.tsx    # Trigger rebalance toutes les 5min
├── contexts/
│   └── UserContext.tsx         # Provider user partage (evite double-fetch)
├── lib/
│   ├── auth/
│   │   ├── hash.ts             # bcrypt wrapper
│   │   └── jwt.ts              # JWT sign/verify (30 jours)
│   └── db/
│       └── prisma.ts           # Prisma singleton
├── prisma/
│   ├── schema.prisma           # Schema BDD
│   └── migrations/             # Migrations versionnees
├── scripts/
│   ├── create-admin.ts         # Cree le compte Admin
│   └── seed-test.ts            # Donnees de test
├── proxy.ts                    # Middleware Next.js 16 (auth)
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env                        # Variables d'environnement (gitignore)
```

---

## Roles et permissions

Le systeme a **2 roles** :

### Admin
- Acces complet a toutes les pages
- Creation / modification / suppression de tout
- Voit toutes les commandes (y compris celles avec numeros incomplets)
- Seul a pouvoir supprimer des employes / commandes / produits
- Configure les statuts, integrations Shopify, seuil de distribution

### Agent
- Voit uniquement **ses propres** commandes
- Ne voit pas les commandes avec numeros de telephone incomplets
- Voit uniquement son propre tableau de bord (ses stats personnelles)
- Pages accessibles : `Dashboard`, `Commandes` (renommees `Mon Dashboard`, `Mes Commandes`)
- Ne peut pas supprimer, ni reassigner des commandes
- Peut changer le statut d'une commande qui lui est assignee

L'acces est verifie sur **3 couches** :
1. `proxy.ts` (middleware) : verifie la presence du token JWT
2. Routes API : filtrage des donnees selon le role
3. `DashboardShell.tsx` : navigation et redirection UI

---

## API Endpoints

### Authentification
| Methode | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Connexion (body: phone, password) |
| `POST` | `/api/auth/logout` | Deconnexion + set isOnline=false |
| `GET` | `/api/auth/me` | Infos de l'utilisateur courant |

### Commandes
| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/orders` | Liste paginee (cursor-based) avec filtres |
| `DELETE` | `/api/orders` | Suppression groupee (Admin only) |
| `PATCH` | `/api/orders/:id` | Modifier statut / agent |
| `POST` | `/api/orders/distribute` | Assigner a un agent automatiquement |
| `POST` | `/api/orders/rebalance` | Redistribuer (cron toutes les 5min) |

### Employes
| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/employees?filter=all\|active\|suspended` | Liste |
| `POST` | `/api/employees` | Creer (Admin only) |
| `DELETE` | `/api/employees` | Suppression groupee (Admin only) |
| `PATCH` | `/api/employees/:id` | Modifier / suspendre / changer mot de passe |

### Produits
| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | Liste avec agents assignes |
| `POST` | `/api/products` | Creer (code auto-genere) |
| `DELETE` | `/api/products` | Suppression groupee |
| `PATCH` | `/api/products/:id` | Modifier |

### Statuts
| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/statuses` | Liste |
| `POST` | `/api/statuses` | Creer |
| `PATCH` | `/api/statuses/:id` | Modifier |
| `DELETE` | `/api/statuses/:id` | Soft delete (isActive=false) |

### Systeme
| Methode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard?filter=Today\|This+Week\|This+Month` | Stats agregees |
| `POST` | `/api/heartbeat` | Ping toutes les 60s (online status) |
| `GET` | `/api/system/stats` | Taille BDD, total commandes |
| `GET/POST` | `/api/settings` | Key-value settings |

### Shopify
| Methode | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/shopify/stores` | Liste / creer boutique |
| `PATCH/DELETE` | `/api/shopify/stores/:id` | Modifier / supprimer |
| `POST` | `/api/webhooks/shopify` | Webhook Shopify (HMAC verifie) |

---

## Integration Shopify

### 1. Recuperer les credentials

Dans votre Shopify Admin :

1. **Settings > Apps and sales channels > Develop apps**
2. Creer une nouvelle app privee
3. **Configuration > Admin API > Configure**
4. Activer les scopes : `read_orders`, `write_orders`, `read_customers`
5. **Install app** puis copier l'**Admin API access token**

### 2. Configurer le webhook

1. **Settings > Notifications > Webhooks > Create webhook**
2. Event : `Order creation`
3. Format : `JSON`
4. URL : `https://votre-domaine.com/api/webhooks/shopify`
5. Copier le **Webhook signing secret**

### 3. Ajouter la boutique dans PrimeCOD

1. Se connecter en tant qu'Admin
2. **Parametres > Shopify > Ajouter une boutique**
3. Remplir :
   - Nom de la boutique
   - Domaine (`exemple.myshopify.com`)
   - Access token
   - Webhook secret
4. Les commandes seront automatiquement recues et distribuees

### Multi-boutiques

Vous pouvez connecter plusieurs boutiques Shopify simultanement. Chaque webhook entrant est identifie par le header `x-shopify-shop-domain`.

---

## Deploiement sur Vercel

### Etape 1 : Pousser sur GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/VOTRE-USER/primecod-crm.git
git push -u origin main
```

### Etape 2 : Creer la base de donnees

Choisir un fournisseur PostgreSQL gratuit :

- **[Neon](https://neon.tech)** (recommande, 0.5 GB gratuit)
- **[Supabase](https://supabase.com)** (500 MB gratuit + dashboard)
- **[Vercel Postgres](https://vercel.com/storage/postgres)** (integre)

Copier l'URL de connexion (format : `postgresql://user:pass@host/db?sslmode=require`).

### Etape 3 : Deployer sur Vercel

1. Aller sur [vercel.com/new](https://vercel.com/new)
2. Importer le repo GitHub
3. **Environment Variables** : ajouter
   - `DATABASE_URL` = (URL de la BDD cloud)
   - `JWT_SECRET` = (96 caracteres hex, generer un nouveau)
   - `NODE_ENV` = `production`
4. **Build Command** : `npx prisma generate && npx prisma migrate deploy && next build`
5. Cliquer **Deploy**

### Etape 4 : Creer l'Admin initial

Apres le premier deploiement, depuis votre terminal local :

```bash
# Pointer temporairement vers la BDD production
DATABASE_URL="postgresql://..." npx tsx scripts/create-admin.ts
```

Votre app est en ligne sur `https://votre-projet.vercel.app`

---

## Scripts disponibles

```bash
npm run dev          # Serveur de developpement (Turbopack)
npm run build        # Build production
npm start            # Lancer le build de production
npm run lint         # ESLint

npx prisma studio    # GUI pour explorer la BDD
npx prisma migrate dev --name nom_migration  # Creer une migration
npx prisma generate  # Regenerer le client Prisma

npx tsx scripts/create-admin.ts  # Creer le compte Admin
npx tsx scripts/seed-test.ts     # Inserer donnees de test
```

---

## Securite — Bonnes pratiques

- **JWT_SECRET** : generer avec `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` pour avoir 96 caracteres. Ne jamais utiliser une valeur faible comme `"secret"`.
- **Cookie** : en production, `secure: true` est force (HTTPS uniquement).
- **Webhooks Shopify** : la verification HMAC-SHA256 est obligatoire. Sans le bon `webhookSecret`, le webhook est rejete (401).
- **Mots de passe** : bcrypt avec cost 10. Modifiable dans `lib/auth/hash.ts`.
- **CORS** : par defaut, le middleware refuse les requetes API sans cookie. Les webhooks Shopify sont la seule exception (route `/api/webhooks/shopify`).

---

## Roadmap

- [ ] Notifications push (Web Push API)
- [ ] Application mobile (React Native)
- [ ] Export comptable (Excel + PDF avec facturation)
- [ ] Rapports periodiques par email
- [ ] Integration WooCommerce
- [ ] Mode hors-ligne (PWA)
- [ ] Multi-langue runtime (i18n)

---

## Licence

Ce projet est sous licence **MIT** — voir [LICENSE](LICENSE) pour plus de details.

---

## Contact

**Developpe pour le marche Mauritanien** — pour toute question ou contribution, ouvrez une [issue](https://github.com/VOTRE-USER/primecod-crm/issues).

---

<p align="center">
  Made with care for COD businesses in Mauritania
</p>
