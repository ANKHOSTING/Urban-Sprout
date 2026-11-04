# Urban Sprout: Play Console answers (draft, NOT submitted)

Package `com.ankhosting.urbansprout`. Evidence = file in `ANKHOSTING/Urban-Sprout` branch `rebuild-expo`. Angel must review before entering anything in Console.

## App content basics
| Item | Answer | Evidence |
|---|---|---|
| Free / paid | Free, with in-app purchases (subscription) | `src/lib/purchases.ts` (RevenueCat entitlement `pro`), `app/pro.tsx` |
| Contains ads | **Yes** | `src/components/AdBanner.tsx` (`BannerAd`), `react-native-google-mobile-ads` in package.json/app.json |
| Advertising ID declaration | **Yes, uses Advertising ID** (ads/analytics) | merged release manifest has `com.google.android.gms.permission.AD_ID`; AdMob SDK |
| App access | Login required. Provide Play reviewers a test email + password | `app/_layout.tsx` Gate redirects to `/sign-in` when no session |
| Account deletion | In-app: Account → Delete account. **Web deletion URL: https://ankhosting.github.io/urban-sprout/delete-account.html** (in-app deletion is immediate and permanent, incl. photos; deletion can also be requested by emailing the contact address in the privacy policy, which states no timeline) | `app/(tabs)/account.tsx` → `supabase.rpc('delete_my_account')`; SQL fn in `supabase/migrations/..._init.sql` |
| Government/health/finance/news app | No | n/a |
| Subscriptions | One subscription (Sprout Pro; product IDs created in Console, e.g. `sprout_pro_monthly` per docs/SETUP.md) | `docs/SETUP.md` |

## Target audience and content
- **Target age group:** **13+ (decided; Angel left the choice to us).** Select 13–15, 16–17, 18+; do NOT select under 13. Matches docs/SETUP.md ("target audience 13+") and the privacy policy.
- **Appeals to children?** No. Evidence: no child-directed content; policy states not directed to under-13.
- **Designed for Families:** No.

## Content rating questionnaire (IARC)
Answer the IARC questionnaire honestly for a lifestyle app with user-generated content (not "Utility"), as below.
| Question | Answer | Evidence |
|---|---|---|
| Violence (any kind) | No | No such content in app code |
| Sexual content / nudity | No | none |
| Profanity / crude humor | No | none (UGC could contain it, see next row) |
| Controlled substances (drugs/alcohol/tobacco) | No | none |
| Gambling / simulated gambling | No | none |
| Fear / horror | No | none |
| **Users can interact or exchange content with each other** | **Yes** | Marketplace listings visible to all signed-in users: `app/market/new.tsx`, `app/(tabs)/market.tsx` (no direct messaging exists) |
| **Shares user's location with others** | No (users type a free-text neighborhood; no device location is read) | `app/market/new.tsx` "Neighborhood (no exact address)"; no location permission in app.json |
| **Digital purchases** | Yes | Sprout Pro subscription |
| Unrestricted internet access / web browsing | No (only opens privacy policy / Play subscription page links) | `app/(tabs)/account.tsx` Linking.openURL |
| UGC moderation | Report + block + hidden flag exist | `app/market/[id].tsx`, `supabase/migrations`: `reports`, `blocks`, `listings.hidden` |
Expected rating: Everyone 10+ / Teen (IARC "users interact"). Final rating is computed by the questionnaire.

## Data safety form
**Data collection and security**
| Question | Answer | Evidence |
|---|---|---|
| Does the app collect or share required user data types? | Yes | below |
| Is all data encrypted in transit? | **Yes** | Supabase `https://*.supabase.co`, AI via server-side HTTPS, AdMob/RevenueCat use TLS (`src/lib/supabase.ts`, Google Mobile Ads data-disclosure page) |
| Can users request data deletion? | **Yes** (in-app delete account; plus email contact; a web URL is required in Console) | `delete_my_account` SQL fn deletes `auth.users` row (cascades) and the user's storage photos |
| Follows Play Families policy | No | n/a |
| Independent security review | No | n/a |

**Data types** (C = collected, S = shared with third party; "required" = cannot opt out)
| Category › type | C | S | Purpose | Optional? | Evidence |
|---|---|---|---|---|---|
| Personal info › **Email address** | Yes | No (service provider Supabase only) | Account management, app functionality | Required | `app/sign-in.tsx` `signUp({ email, password })` |
| Personal info › **Name** (generic display name "Gardener" set at sign-up, shown to other signed-in users next to listings) | Yes | No | Account management, app functionality | Required | trigger `handle_new_user` → `profiles.display_name`; `app/market/[id].tsx` "Posted by" |
| Personal info › **User IDs** (Supabase user id; RevenueCat receives it via `Purchases.logIn`, as the privacy policy states) | Yes | Yes (RevenueCat) | Account management, app functionality | Required | `src/lib/auth.tsx` `identifyPurchaser` → `Purchases.logIn(userId)` |
| Photos and videos › **Photos** | Yes | No | App functionality | Optional | `src/lib/pickImage.ts`, `uploadPhoto` in `src/lib/supabase.ts` (private bucket `photos`, shown via short-lived signed links; journal photos owner-only, listing photos visible to signed-in users who can see the listing) |
| Messages › **Other in-app messages** (AI questions) | Yes (processed, not stored) | Yes (AI provider, Fireworks) | App functionality | Optional | `supabase/functions/plant-advice/index.ts` forwards last 12 messages to `/chat/completions`; nothing stored |
| App activity › **Other user-generated content** (plants, journal, listings, reports) | Yes | Listings visible to other users (in-app, not 3rd-party sharing) | App functionality | Required for those features | `supabase/migrations`: plants, journal_entries, listings, reports, blocks |
| App activity › **App interactions** | Yes (AdMob SDK) | Yes (Google) | Advertising, analytics, fraud prevention | Required (free tier) | Google Mobile Ads SDK data disclosure |
| App info and performance › **Diagnostics** | Yes (AdMob SDK) | Yes (Google) | Analytics, fraud prevention | Required (free tier) | same |
| Device or other IDs › **Advertising ID / app set ID** | Yes | Yes (Google AdMob) | Advertising or marketing, fraud prevention | Required (free tier) | `AD_ID` permission in merged manifest; `BannerAd` |
| Financial info › **Purchase history** | Yes | Yes (RevenueCat/Google Play) | App functionality (Pro entitlement) | Optional | `src/lib/purchases.ts`; `supabase/functions/revenuecat-webhook/index.ts` stores `is_pro`, `expires_at` |
Not collected: location (the privacy policy claims none and the app reads no device location; Angel to confirm this against Google's AdMob data disclosure before submitting), contacts, calendar, files, audio, health, web browsing, SMS/call logs, passwords other than via auth (passwords are handled by Supabase Auth).
Note: Play treats transfers to service providers acting on your behalf (Supabase, RevenueCat, the AI provider) as not "sharing", but treat Fireworks/AdMob conservatively as above; Angel to confirm.

## Ads declaration
- **Contains ads: YES.** Banner ads (`ANCHORED_ADAPTIVE_BANNER`) on My Plants, Ask AI, Journal, Market for non-Pro users; hidden for Pro. Requests non-personalized ads only (`requestNonPersonalizedAdsOnly: true`). Where required (EEA/UK), Google's UMP consent form is shown and ads are not requested until consent is handled. Evidence: `src/components/AdBanner.tsx`, `src/lib/ads.ts`.
- **AdMob IDs:** the EAS `production` profile sets the real AdMob app and banner IDs (`eas.json`); development and preview builds use Google test IDs only. Before release, publish the GDPR (UMP) consent message in the AdMob console.

## Other declarations
- **Permissions in release manifest (declared):** INTERNET, ACCESS_NETWORK_STATE, CAMERA, POST_NOTIFICATIONS, BILLING, AD_ID, VIBRATE, WAKE_LOCK, RECEIVE_BOOT_COMPLETED, FOREGROUND_SERVICE, plus launcher-badge permissions pulled in by libraries. `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` are already blocked via `blockedPermissions` in `app.json:26-29`, so they are not declared. The app code uses none of: microphone, overlay, location, contacts. Re-check the merged manifest of the built AAB before answering Console permission questions.
- **Financial features / health / news / government:** none.
- **Privacy policy URL:** https://ankhosting.github.io/urban-sprout/privacy.html (GitHub Pages, HTTP 200). **Account deletion URL:** https://ankhosting.github.io/urban-sprout/delete-account.html. **Deletion:** in-app deletion is immediate (profile, plants, journal, listings, reports, blocks, usage counts, subscription record, photos); email requests go to the contact address in the privacy policy (no timeline is stated there). AdMob/RevenueCat data follows their own policies.
