# Shopify CRM + Analytics System — Contexte du Projet

## Description
Système CRM + Analytics pour les businesses COD (Cash on Delivery) en Mauritanie.
Connecté à Shopify via webhooks et API keys.
Projet étudiant DSI — première collaboration avec un vrai client.

## Stack Technique
- **Frontend + Backend** : Next.js (Fullstack — App Router)
- **Base de données** : PostgreSQL
- **ORM** : Prisma (2 migrations déjà faites)
- **UI** : Tailwind CSS + shadcn/ui
- **Auth** : JWT custom (lib/auth/jwt.ts + hash.ts)

## Structure du Projet
```
crm-dashboard/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── employees/page.tsx
│   │   ├── orders/page.tsx
│   │   ├── products/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── dashboard/route.ts  ✅ fait
│   │   └── export/route.ts     ✅ fait
│   └── layout.tsx
├── lib/
│   ├── auth/
│   │   ├── hash.ts
│   │   └── jwt.ts
│   └── db/prisma.ts
├── services/
├── store/
├── types/
├── constants/
├── hooks/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       ├── 20260520083410_...
│       └── 20260520104240_...
├── .env
└── tsconfig.json  ⚠️ 1 erreur à corriger
```

## Paramètres Globaux
- **Devise** : MRU (Ouguiya Mauritanien)
- **Langues** : Arabe (défaut) + Français
- **Police Arabe** : IBM Plex Sans Arabic
- **Police Français** : Montserrat

## Rôles Utilisateurs
1. **Admin** — accès total, seul à pouvoir supprimer
2. **Supervisor** — lecture complète, modification avec/sans approbation admin, pas de suppression
3. **Agent** — ses commandes uniquement + ses stats personnelles, pas de suppression

## Fonctionnalités par Page

### Dashboard ✅ (en cours)
- Stats : total commandes, revenus, taux confirmation, commandes en attente
- Indicateurs de croissance vs hier (+2%, -1%...)
- Filtre par date / plage de dates (défaut = aujourd'hui)
- Sélection multi-produits
- Charts : meilleurs agents, meilleurs produits, revenus, taux confirmation vs temps d'appel
- Sidebar masquable (dashboard s'élargit automatiquement)

### Orders ❌ (à faire)
- Tableau avec infinite scroll (pas de pagination)
- Colonnes : numéro, date, produit, prix, client, téléphone, agent, statut, temps traitement, délai suivi, rappel, tentatives, notes
- Bulk actions : suppression groupée avec confirmation
- Fenêtre rappels extensible en haut
- Stats rapides on/off
- Réaffectation manuelle d'un agent
- Colonnes personnalisables (afficher/masquer/réordonner)

### Employees ❌ (à faire)
- Ajouter employé : nom, rôle, téléphone (= identifiant), date début, mot de passe
- Admin peut changer mot de passe / déconnecter à distance
- Cycle de paie configurable
- Gestion des rôles avec permissions granulaires
- Suspendre compte sans supprimer
- Méthode de réception : produits spécifiques OU distribution aléatoire

### Products ❌ (à faire)
- Ajouter produit (nom requis, code auto-généré)
- Détection automatique des produits non enregistrés
- Distribution : spécifique (agents sélectionnés) ou libre (aléatoire)
- Bulk actions

### Status Management ❌ (à faire)
- Créer statut avec couleur et section
- Alertes de suivi après X heures
- Désactiver/supprimer (les anciennes commandes gardent le label)
- Modification rétroactive optionnelle

### Settings ❌ (à faire)
- Changer langue (AR ↔ FR)
- Lier à Shopify via API Key + Webhook
- Multi-boutiques
- Lier à un domaine
- Seuil de distribution des commandes
- Afficher taille de la base de données

## Intégration Shopify
Flux : Client → Shopify Store → EasySell App (COD Form) → Shopify Orders → Notre API → Dashboard/CRM

Nécessite :
- Shopify Partner Account
- API Keys
- Webhooks
- Store Access Token

## État Actuel
- ✅ Dashboard API route (avec fallback à 0 en cas d'erreur)
- ✅ Export API route
- ✅ Base de données + 2 migrations Prisma
- ⚠️ tsconfig.json a 1 erreur à corriger
- ❌ Pages orders, employees, products, settings à construire
- ❌ Auth (login/session) à implémenter
- ❌ Shopify webhooks à implémenter

## Priorité de Travail
1. Corriger l'erreur tsconfig.json
2. Vérifier/corriger dashboard/route.ts
3. Page Orders
4. Page Employees
5. Page Products
6. Auth (login)
7. Shopify integration


Partie 1 : Points Généraux et Tableau de Bord (Dashboard) 
Points à appliquer sur l'ensemble du système : 
• Langues : La langue par défaut du système doit être l'Arabe, ainsi que le Français. 
• Polices (Fonts) : 
• Police pour l'Arabe : IBM Plex Sans Arabic. 
• Police pour le Français : Montserrat (Google Fonts). 
• Devise : La devise du système est l'Ouguiya Mauritanien (MRU). 
• Filtrage des commandes : Les commandes dont les numéros de téléphone sont incomplets ne 
doivent pas apparaître chez les livreurs/agents ; elles s'affichent uniquement pour 
l'administrateur. 
1. Tableau de Bord (Dashboard) : 
• Sélection de produits : Capacité de sélectionner plusieurs produits simultanément pour afficher 
leurs résultats groupés. 
• Filtre de date : * Un filtre permettant de sélectionner une date précise pour afficher les 
statistiques correspondantes. 
• Possibilité de définir une plage de dates (période). 
• Par défaut, le dashboard affiche uniquement les données de la "journée en cours". 
• Statistiques principales : 
• Total des commandes (Leads) avec le revenu correspondant en dessous. 
• Nombre de commandes traitées par les agentes, avec le revenu correspondant. 
• Nombre de commandes en attente (non traitées), avec le revenu correspondant. 
• Nombre de commandes dans la liste d'attente (à rappeler). 
• Détail par statut : En bas, une section affichant chaque statut avec le nombre de commandes 
associées, leur pourcentage, et le revenu correspondant (Exemple : "Confirmée 25 commandes 
(15%, 35.000 MRU)"). 
• Indicateurs de croissance : Affichage d'un pourcentage à côté de chaque chiffre statistique 
représentant l'évolution (hausse ou baisse) par rapport à la veille (Exemple : Taux de 
confirmation 25% [+2%]). 
• Graphiques (Charts) : 
• Graphique des meilleurs agents selon le taux de confirmation, le nombre de leads reçus, 
confirmés, et le temps moyen de traitement dès réception du lead. (Possibilité de sélectionner 
un agent pour voir son détail quotidien et comparer plusieurs agents). 
• Graphique des meilleurs produits selon le taux de confirmation et le nombre de pièces 
vendues. (Possibilité d'analyser un produit par jour et comparer plusieurs produits). 
 
• Graphique des Revenus. 
• Graphique montrant la relation entre le taux de confirmation et le temps d'appel (Exemple : 
quel est le taux de confirmation pour les clients appelés après 5 minutes vs 30 minutes). 
 
• Interface utilisateur : Lorsque le menu latéral est masqué, le dashboard doit automatiquement 
s'élargir pour occuper tout l'espace disponible 
 
 
Partie 2 : Les Commandes et leur Interface 
2. Gestion des commandes : 
• Filtre de date : Un filtre de date doit être présent en haut de la section pour afficher toutes les 
commandes d'une journée spécifique. 
• Fenêtre de rappels et statistiques rapides : 
• Une fenêtre extensible en haut de la liste affichant le nombre de commandes à rappeler. Une 
fois développée, elle permet de traiter ces commandes directement avant de la réduire. 
• Affichage de statistiques simples (activables/désactivables via un bouton On/Off) : (Total des 
commandes, Revenu total, Taux de confirmation, Temps moyen de traitement). 
• Liste des commandes (Tableau) : 
Le tableau doit être composé des sections suivantes, chacune étant filtrable : 
• Case de sélection (Bulk select). 
• Numéro de commande. 
• Date de la commande. 
• Nom du produit. 
• Prix du produit. 
• Nom du client. 
• Téléphone du client. 
• Agent (Mandoub). 
• Statut (État). 
• Temps écoulé entre la réception et la mise à jour (ex: 8 minutes). 
• Délai de suivi (ex: "Après 1 jour et 16 heures"). 
• Rappel (icône d'alerte pour l'appel). 
• Nombre de tentatives d'appel. 
• Notes / Commentaires. 
• Fonctionnalités de contrôle : 
• Suppression : Possibilité de supprimer plusieurs commandes après sélection, avec une 
demande de confirmation. 
• Modification manuelle : En tant que propriétaire, avoir la possibilité de changer le statut de 
n'importe quelle commande. 
• Réaffectation : Possibilité de réattribuer manuellement une commande à n'importe quel agent, 
même si le système l'avait déjà attribuée automatiquement à quelqu'un d'autre. 
• Personnalisation : Capacité de choisir les colonnes à afficher ou masquer, et de réorganiser 
leur ordre selon les préférences de l'utilisateur. 
• Affichage : La liste des commandes doit utiliser le défilement continu (Infinite Scroll) au lieu de 
la pagination classique (1, 2, 3...). 
Partie 3 : Employés et Rôles (Superviseurs, Agents...) 
3. Gestion des employés : 
• Ajouter un employé : Un bouton "Ajouter un employé" en haut de l'interface permettant de : 
• Saisir le nom de l'agent. 
• Définir son rôle (selon les rôles configurés précédemment). 
• Ajouter son numéro de téléphone (identifiant de connexion). 
• Ajouter la date de début officiel de son travail. 
• Définir un mot de passe pour son accès. 
• Contrôle administratif : 
• Possibilité de changer le mot de passe d'un employé ou de le déconnecter du système à 
distance. 
• Définir le cycle de paie (nombre de jours) pour suivre le compte à rebours avant le prochain 
versement du salaire. 
• Gestion des "Rôles" : Possibilité de créer un rôle, le nommer, et lui attribuer des permissions : 
• Permission de lecture pour des sections spécifiques. 
• Permission de modification (avec ou sans approbation préalable de l'administrateur). 
• Note : La suppression de tout élément reste une exclusivité du propriétaire du système. 
• Spécifications des rôles : 
• Rôle "Agent" : Accès limité à la gestion des commandes et à ses propres statistiques 
personnelles sur son dashboard. Aucune permission de suppression. 
• Rôle "Superviseur" : Accès complet en lecture (Dashboard, Commandes, Produits, Statuts). 
Modification possible (avec option d'approbation par l'administrateur), mais la suppression lui 
est strictement interdite. 
• Actions groupées et Filtres : 
• Suppression groupée d'employés (avec message de confirmation). 
• Modifier les informations, changer de rôle, ou "geler" (suspendre) un compte sans le 
supprimer. 
• Filtrer la liste pour afficher uniquement les comptes actifs ou suspendus. 
• Un compte suspendu ne peut plus se connecter. 
• Méthode de réception des commandes : Choisir comment l'agent reçoit les commandes (soit 
par attribution de produits spécifiques, soit par distribution aléatoire via le système). 
Partie 4 : Les Statuts (États) 
4. Gestion des statuts : 
• Ajouter un statut : Bouton permettant de créer un nouveau statut, définir sa couleur, et 
l'affecter à une section (ex: section "Commandes"). 
• Alertes de suivi : Possibilité d'activer une alerte après un nombre d'heures défini pour signaler 
qu'il faut rappeler le client (ex: statuts "Ne répond pas" ou "En attente de paiement"). 
• Désactivation et Suppression : 
• Possibilité de désactiver ou supprimer un statut (avec confirmation). 
• En cas de suppression d'un statut, il n'apparaîtra plus pour les nouveaux choix, mais les 
anciennes commandes conserveront l'étiquette de ce statut. 
• Modification : Lors de la modification d'un nom ou d'une couleur, le système demande si le 
changement doit s'appliquer rétroactivement à toutes les anciennes commandes ou uniquement 
aux futures. 
Partie 5 : Produits (Products) 
5. Gestion des produits : 
• Ajouter un produit : Bouton pour ajouter un produit permettant de définir ses détails (Nom, 
Quantité, Prix d'achat...). 
• Note : Actuellement, seul le nom est requis, le système doit générer automatiquement un code 
unique pour ce produit afin de le distinguer. 
• Détection automatique : Lorsque le système reçoit une commande pour un produit non 
enregistré, il doit le suggérer dans la section Produits pour l'ajouter officiellement. 
• Mécanisme de distribution : Capacité de définir comment les commandes de ce produit sont 
distribuées : 
• Distribution spécifique : Sélectionner manuellement le ou les agents autorisés à recevoir les 
commandes de ce produit. 
• Distribution libre : Le système distribue les commandes de manière aléatoire (automatique) 
vers l'agent le plus disponible, en prenant en compte le seuil minimum de commandes. 
• Actions groupées : Capacité de modifier les détails, supprimer des produits, ou appliquer une 
modification à plusieurs produits sélectionnés simultanément. 
Partie 6 : Paramètres (Settings) 
6. Paramètres du système : 
• Langues : Possibilité de changer la langue de l'Arabe vers le Français et inversement. 
• Intégrations techniques : 
• Lier le système à Shopify via API. 
• Lier le système à un nom de domaine (Domain) spécifique. 
• Lier le système à un serveur spécifique. 
• Capacité de connecter le système à plusieurs boutiques simultanément. 
• Paramètres de distribution des commandes : 
• Définir le seuil minimum de commandes avant de rediriger le flux vers un autre agent actif 
(non suspendu). 
• Exemple : À partir de combien de commandes non traitées (4, 8, etc.) le système doit-il 
commencer à envoyer les nouvelles commandes à quelqu'un d'autre ? 
• Base de données : Afficher la taille des données consommées par le système. 
Partie 7 : Apprentissage et Livraison 
7. Éléments à apprendre (Formation) : 
• M'apprendre comment lier le système à n'importe quel serveur et comment le déconnecter. 
• M'apprendre comment lier le système à n'importe quelle boutique Shopify. 
• M'apprendre comment lier le système à un nouveau nom de domaine. 
• Me fournir le code source du système.