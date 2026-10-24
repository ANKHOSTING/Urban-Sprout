# Urban Sprout 🌱

Urban gardening app with plant care, AI advice, journal entries, and community marketplace.

Rebuilt from scratch as a native **Expo / React Native** app (TypeScript, expo-router) for Google Play.
The original version was built on Base44; this version no longer depends on Base44.

## Features
- **My Plants** – care info (built-in guide for common plants) and local watering reminders (expo-notifications)
- **Ask AI** – plant-advice chat via a Supabase Edge Function (AI key stays on the server; any OpenAI-compatible provider — Fireworks by default, OpenAI via `AI_BASE_URL`/`AI_MODEL`); free tier 5 questions/day
- **Garden Journal** – notes with camera/gallery photos
- **Community Market** – listings for cuttings, seeds and produce, with **report** and **block user**
- **Account** – sign in, privacy policy, restore purchases, **delete account** (Google Play requirement)
- **Monetization** – *Sprout Pro* subscription (RevenueCat → Google Play Billing) unlocks unlimited AI + no ads; AdMob banners for free users (test IDs by default)

## Quick start
```bash
npm install
cp .env.example .env   # fill in Supabase keys
npx expo start
```
Ads and in-app purchases are native modules, so use a development build (`eas build --profile development`) rather than Expo Go to test them.

## Project layout
- `app/` – screens (expo-router)
- `src/lib/` – Supabase client, auth, notifications, AI, purchases, ads
- `supabase/migrations/` – database schema with Row Level Security
- `supabase/functions/plant-advice` – AI advice + daily limit
- `supabase/functions/revenuecat-webhook` – syncs Pro status to the database
- `docs/SETUP.md` – full setup: Supabase, RevenueCat, AdMob, EAS build, Play closed testing
- `docs/PLAY_STORE_LISTING.md` – store listing copy
- `PRIVACY_POLICY.md`

## Security
- `.gitignore` prevents API keys, secrets and credentials from being committed.
- Never commit `.env` or any file containing secrets. Only `EXPO_PUBLIC_*` values (safe, public) are used by the app.
