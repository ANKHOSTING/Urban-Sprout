# Urban Sprout Privacy Policy

_Last updated: November 10, 2026_

Urban Sprout ("the app", "we") is published by **ankhosting**. This policy explains what data the app handles and why.

**Contact:** ankhosting2025@gmail.com

## 1. Information we collect

**Account information.** To use the app you create an account with an email address and password. Our authentication provider (Supabase) stores your email and a hashed password. When your account is created we automatically set a generic display name ("Gardener"). This display name is shown to other signed-in users next to marketplace listings you post.

**Content you create.** The app stores, under your account:

- Plants you add: nickname, species, location text, sunlight, watering interval, care notes and the date last watered.
- Garden journal entries: your notes and optional photos.
- Marketplace listings: title, description, price or "trade/free", a neighborhood text you type, and an optional photo. Listings are visible to other signed-in users.
- Reports and blocks you submit about other users' listings (for safety and moderation).

**Photos.** If you add a photo, the app asks for camera or photo-library permission and uploads the selected image to our storage (Supabase Storage, private `photos` bucket). Your journal photos are visible only to you. A photo you attach to a marketplace listing can be viewed by other signed-in users who can see that listing. Photos are shown through short-lived signed links. Photos used for plant identification are not saved to our storage (see the next paragraph).

**AI plant questions.** When you use "Ask AI", your recent conversation (up to the last 12 messages, each truncated to 2,000 characters) is sent to our server and then to an AI model provider (currently Fireworks AI, an OpenAI-compatible API) to generate an answer. Fireworks AI states that, by default, it does not log or store prompt or generation data for open models (requests are held only in memory while being processed, plus up to several minutes in a prompt cache) and logs only request metadata such as token counts; see the [Fireworks data handling docs](https://docs.fireworks.ai/guides/security_compliance/data_handling) and [privacy policy](https://fireworks.ai/privacy-policy). We do not store the text of your questions or the answers; we store only a per-day question count tied to your account to apply the free daily limit (5 questions/day on the free plan). **Photo plant identification.** If you take or pick a photo on the Add Plant screen, the app resizes it on your device (to at most 768 pixels on its longest side) and sends it over HTTPS through our server to Fireworks AI only to identify the plant and suggest care details. We do not store the photo or the result (unless you save the plant), and each identification counts toward the same free daily limit.

**Subscription and purchase information.** If you subscribe to Sprout Pro, the purchase is processed by Google Play. RevenueCat receives purchase information and uses your account ID as your user ID to confirm your subscription. We store whether you are a Pro subscriber and its expiry date. We never see your payment card details.

**Advertising data.** The free version shows banner ads from Google AdMob. We request non-personalized ads. Where required (for example in the European Economic Area and the United Kingdom), a Google consent form (Google's User Messaging Platform) is shown before ads are requested, and ads are not requested until consent is handled. The Google Mobile Ads SDK may still collect your IP address, your Android advertising ID, interaction information and diagnostic information for advertising, analytics and fraud prevention. Sprout Pro removes ads.

**Notifications.** Watering reminders are scheduled locally on your device. We do not send push notifications from a server.

**What we do not collect.** The app does not use precise or background location, contacts, or the microphone for any feature.

## 2. How we use information

To provide your account and the app's features (plants, journal, marketplace, AI answers); to apply free-tier limits; to process and verify subscriptions; to keep the community safe (reports, blocks, removing rule-breaking listings); and to show ads to free users. We do not sell your personal data.

## 3. Sharing

We share data only with service providers needed to run the app:

- **Supabase**: authentication, database and file storage.
- **Fireworks AI** (or the configured AI provider): to generate AI answers from your questions and to identify plants from photos you submit.
- **RevenueCat and Google Play**: subscriptions and purchase verification.
- **Google AdMob**: ads (see above).
Marketplace listings you post, your display name and listing photos are visible to other users of the app. We may disclose information if required by law.

## 4. Security

Data is sent over encrypted connections (HTTPS/TLS). Database access rules ensure that only you can read or change your plants and journal entries. Photos are stored in a private bucket; journal photos are readable only by you, and listing photos only by signed-in users who can see the listing (see Section 1).

## 5. Retention and deletion

We keep your data while your account is active. You can permanently delete your account at any time in the app: **Account → Delete account**. This deletes your profile, plants, journal entries, listings, reports, blocks, usage counts, subscription record and your uploaded photos. You can also request deletion by emailing ankhosting2025@gmail.com or by following the steps at [ankhosting.github.io/urban-sprout/delete-account.html](https://ankhosting.github.io/urban-sprout/delete-account.html). Cancelling a Sprout Pro subscription is separate and is done in Google Play (**Account → Manage subscription**). Data held by Google (AdMob) and RevenueCat is governed by their policies.

## 6. Children

Urban Sprout is not directed to children under 13, and we do not knowingly collect personal information from them. If you believe a child has provided data, contact us and we will delete it.

## 7. Third-party policies

- Supabase: https://supabase.com/privacy
- Fireworks AI: https://fireworks.ai/privacy-policy
- RevenueCat: https://www.revenuecat.com/privacy
- Google (AdMob/Play): https://policies.google.com/privacy

## 8. Changes

We may update this policy and will change the date above when we do.

_This file mirrors the hosted policy at https://ankhosting.github.io/urban-sprout/privacy.html._
