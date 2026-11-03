# Urban Sprout – Setup Guide

Everything marked **[you]** needs your own account or keys.

## 1. Supabase (auth, database, storage, AI function) [you]
1. Create a project at https://supabase.com.
2. Install the CLI (`npm i -g supabase`), then:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push                     # applies supabase/migrations (tables, RLS, photos bucket)
   supabase secrets set AI_API_KEY=fw_... FREE_DAILY_LIMIT=5
   # Optional: AI_BASE_URL (default https://api.fireworks.ai/inference/v1)
   #           AI_MODEL    (default accounts/fireworks/models/nemotron-lightning-3p5-30b-a3b)
   # Any OpenAI-compatible provider works. For OpenAI itself:
   #   supabase secrets set AI_API_KEY=sk-... AI_BASE_URL=https://api.openai.com/v1 AI_MODEL=gpt-4o-mini
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
5. Integrations → Webhooks: URL `https://YOUR_PROJECT_REF.functions.supabase.co/revenuecat-webhook`, Authorization header `Bearer <REVENUECAT_WEBHOOK_AUTH>`. Optional secrets: `LIFETIME_PRODUCT_IDS` (comma-separated non-renewing product ids that grant Pro until 2099-12-31; any other non-renewing product gets `NON_RENEWING_DAYS`, default 31). Events older than the stored row are ignored. This lets the server know who is Pro so the AI limit is enforced securely.

## 3. AdMob banners [you]
1. Create an app at https://admob.google.com and a **Banner** ad unit.
2. Set `ADMOB_ANDROID_APP_ID=ca-app-pub-XXXX~YYYY` (env / EAS environment variable); `app.config.js` injects it into the AdMob plugin. Config resolution (any EAS profile or local build) fails if it is missing; there is no test-id fallback. For local dev only, set `ADMOB_ALLOW_TEST_IDS=true` (already set in the EAS `development` profile). The opt-in is honoured only for the EAS `development` profile or local non-EAS runs, and is rejected anywhere else. `plugins/with-no-test-admob.js` also fails any release Gradle build whose merged manifest contains Google's test app id. **Preview builds and `eas update` also need the real IDs**: add `ADMOB_ANDROID_APP_ID` and `EXPO_PUBLIC_ADMOB_BANNER_ANDROID` as EAS environment variables for the `preview` (and `production`) environments, and run `eas update` with `--environment` set so the same values are available; they must not use the test opt-in.
3. Set `EXPO_PUBLIC_ADMOB_BANNER_ANDROID=ca-app-pub-XXXX/ZZZZ` in `.env` / EAS env. Config resolution fails if it is missing/invalid (unless `EXPO_PUBLIC_ADS_ENABLED=false`); Google's test banner is used only in `__DEV__`.
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
