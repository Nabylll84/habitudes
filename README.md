# ⚡ HabitFlow

Un traqueur d'habitudes social, moderne et **temps réel** : suis tes routines, garde tes **streaks 🔥**, ajoute tes **amis** et comparez vos progressions.

Stack : **React + Vite + TypeScript** (front) · **Supabase** (Postgres, Auth Google, RLS, Realtime) · **Netlify** (hébergement).

---

## 🚀 Déploiement en 6 étapes (~20 min)

### 1. Prérequis
- [Node.js](https://nodejs.org) ≥ 18
- Un compte [Supabase](https://supabase.com) (gratuit)
- Un compte [Netlify](https://netlify.com) (gratuit)
- Un compte Google (pour le bouton de connexion)

### 2. Créer le projet Supabase
1. [Console Supabase](https://supabase.com/dashboard) → **New project** (nom = `habitflow`, mot de passe Base de données, région proche de toi).
2. Une fois créé : **SQL Editor** → colle tout le contenu de [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) → **Run**.
   > Cela crée les tables `profiles`, `habits`, `completions`, `friendships`, `friend_requests`, les politiques de sécurité (RLS), les fonctions et le Realtime.

### 3. Configurer Google OAuth
1. [Google Cloud Console](https://console.cloud.google.com/) → crée un projet → **APIs & services → Consentement** :
   - *User type* : **Externe**, renseigne les données de contact obligatoires.
2. **APIs & services → Identifiants → Créer des identifiants → ID client OAuth** :
   - Type : **Application Web**
   - *URI de redirection autorisés* : ajoute :
     ```
     https://[ref-de-ton-projet].supabase.co/auth/v1/callback
     ```
     (le ref apparaît dans l'URL de ton projet Supabase)
   - Copie le **Client ID** et le **Client secret**.
3. Retour dans **Supabase → Authentication → Providers → Google** :
   - Active **Enable Sign in with Google**,
   - Colle le Client ID et le Secret, **Save**.

### 4. Récupérer les clés Supabase
**Supabase → Settings → API** :
- `Project URL`
- `anon` `public` key

### 5. Configurer le projet en local (optionnel)
```bash
npm install
cp .env.example .env      # remplis les 2 valeurs
npm run dev               # → http://localhost:5173
```

### 6. Déployer sur Netlify
**Option A — interface Netlify (recommandé)**
1. Dans Netlify : **Add new site → Import from Git** (ou **Deploy manually** en glissant le dossier `dist/` après un `npm run build` local).
2. Config Build :
   - Build command : `npm run build`
   - Publish directory : `dist`
3. **Site settings → Environment variables** : ajoute les 2 clés :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Déployer** → attends la fin du build.

**Option B — CLI**
```bash
npm i -g netlify-cli
npm run build
netlify deploy --prod
```

### ⚠️ Dernière étape indispensable : les redirections Supabase
Dans **Supabase → Authentication → URL Configuration → Redirect URLs**, ajoute :
```
https://ton-site.netlify.app/auth/callback
http://localhost:5173/auth/callback   (si tu testes en local)
```
Sans cela, Google se connecte mais la redirection retourne une erreur.

---

## ✨ Fonctionnalités

- 🔐 Connexion **Google OAuth ou email / mot de passe** (pseudo auto-généré, modifiable)
- 📅 **Journal** du jour : coche tes habitudes, série +7 jours, anneau de progression
- ✅ **Habitudes** : 7 derniers jours à cocher, éditeur (nom, emoji, couleur)
- 👥 **Amis** : recherche par pseudo, demandes acceptées/en attente, classement du jour 🏅
- 💬 **Chat** : discute en temps réel avec tes amis (accusés de lecture ✓✓)
- 📈 **Stats** : coches totales, meilleure série, taux sur 14 jours, heatmap 30 jours
- ⚡ **Realtime** : mises à jour instantanées quand un ami coche une habitude
- 🌙 Thème sombre/clair (suit ton système), responsive mobile, French-first

## 🛡️ Sécurité
Toutes les données passent par les **Row Level Security** de Supabase : chacun ne voit/modifie que **ses** habitudes et celles de **ses amis acceptés**. Les actions sensibles (accepter une demande, cocher) passent par des **fonctions PostgreSQL `security definer`** atomiques.

## 📁 Structure
```
supabase/migrations/   → SQL unique de déploiement (schéma + RLS + fonctions)
src/
  lib/                 → client Supabase, auth, API, dates/streaks
  hooks/               → abonnement Realtime
  components/          → UI (cartes, modales, heatmap, ring…)
  views/               → Journal, Habitudes, Amis, Profil, Stats, Login
  styles/              → design system (CSS variables)
netlify.toml           → config build Netlify
```