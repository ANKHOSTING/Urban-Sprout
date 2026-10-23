# Urban Sprout – Setup Guide

Everything marked **[you]** needs your own account or keys.

## 1. Supabase (auth, database, storage, AI function) [you]
1. Create a project at https://supabase.com.
2. Install the CLI (`npm i -g supabase`), then:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push                     # applies supabase/migrations (tables, RLS, photos bucket)
   supabase secrets set OPENAI_API_KEY=sk-... FREE_DAILY_LIMIT=5   # optional AI_MODEL=gpt-4o-mini
   supabase functions deploy plant-advice
   supabase secrets set REVENUECAT_WEBHOOK_AUTH=$(openssl rand -hex 24)
   supabase functions deploy revenuecat-webhook --no-verify-jwt
   ```
3. Copy `.env.example` to `.env` and fill `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API).
4. Auth → Providers: Email is enabled by default. Optionally turn off "Confirm email" for faster testing.
5. Moderation: reports land in the `reports` table. Review them in the Supabase dashboard and set `listings.hidden = true` to remove content (aim for under 24h).

## 2. RevenueCat – Sprout Pro subscription [you]
1. In Play Console → Monetize → Subscriptions, create a subscription, e.g. `sprout_pro_monthly` ($2.99/mo) and optionally yearly. (You need a Play app with an uploaded build first.)
2. At https://app.revenuecat.com create a project, add a Google Play app (package `com.ankhosting.urbansprout`) and upload a Play service-account JSON for receipt validation.
3. Create entitlement **`pro`**, attach the products, and put them in the **current** Offering.
4. Put the public Android SDK key (`goog_...`) in `.env` as `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
5. Integrations → Webhooks: URL `https://YOUR_PROJECT_REF.functions.supabase.co/revenuecat-webhook`, Authorization header `Bearer <REVENUECAT_WEBHOOK_AUTH>`. This lets the server know who is Pro so the AI limit is enforced securely.

## 3. AdMob banners [you]
1. Create an app at https://admob.google.com and a **Banner** ad unit.
2. In `app.json` → plugins → `react-native-google-mobile-ads`, replace `androidAppId` (currently Google's **test** app ID) with your App ID `ca-app-pub-XXXX~YYYY`.
3. Set `EXPO_PUBLIC_ADMOB_BANNER_ANDROID=ca-app-pub-XXXX/ZZZZ` in `.env`. While it's empty (or in dev), Google's test banner is used.
4. Set `EXPO_PUBLIC_ADS_ENABLED=false` to ship without ads. Pro users never see ads.

## 4. Build with EAS [you: Expo account]
```bash
npm i -g eas-cli
eas login
eas init                      # writes your projectId into app.json (replaces REPLACE_WITH_EAS_PROJECT_ID)
eas env:create ...            # or add the EXPO_PUBLIC_* values as EAS environment variables
eas build -p android --profile production   # produces a signed .aab (EAS manages the upload key)
```
Bump `android.versionCode` in `app.json` for every upload to Play.
For testing ads/purchases on a device: `eas build -p android --profile development`.

## 5. Google Play Console [you]
1. Create app "Urban Sprout", free, with ads and in-app purchases. Enable **Play App Signing**.
2. Store listing: copy from `docs/PLAY_STORE_LISTING.md`. Assets: 512×512 icon, 1024×500 feature graphic, 2+ phone screenshots.
3. App content: privacy policy URL, ads declaration (yes), content rating, target audience (13+), **Data safety** (email, user content, photos, app interactions, device IDs for ads; data encrypted in transit; users can request deletion), and the **account deletion URL** (link to PRIVACY_POLICY.md section or a web form).
4. **Closed testing (required for new personal developer accounts):** create a Closed testing track, upload the AAB, add **at least 12 testers** (Google Group or email list), and keep them **opted in for 14 continuous days**. Then apply for production access in the Dashboard.
5. Optional: `eas submit -p android` with a Play service-account key saved as `play-service-account.json` (gitignored).

## Local checks
```bash
npm install
npx tsc --noEmit
npx expo-doctor
npx expo export --platform android
```
