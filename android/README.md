# RAV Alliance Android APK
Native Android WebView shell displaying the official alliance community site https://rav377.netlify.app/. All accounts, chats, forums and the anthem remain served by the existing site and Supabase.

The selected gold RAV alliance emblem is stored at app/src/main/res/drawable-nodpi/rav_icon.webp. The full-size original graphic is also packaged in the downloadable Android Studio project ZIP in the conversation; for a sharper production icon, replace the repository version with that original graphic.

Build: Java 17, Gradle 8.9, Android SDK 35. Run `gradle -p android :app:assembleDebug` or use the GitHub Actions workflow.

This is a debug test APK, not a signed production release. Do not install APKs from unknown sources. Do not commit signing credentials.

IMPORTANT: no off-app audible push notifications are implemented yet. They require an opt-in push platform, server-side notification rules and Android notification permissions. In-game Last Z messages cannot be read automatically without a supported game integration.

## Opt-in audible push alerts (v0.2.0)
This project integrates the pinned Firebase Cloud Messaging Android SDK and high-importance
notification channel `rav_urgent`. It requires Google Play services and notification
permission on Android 13+, and respects user-controlled sound / DND settings.

**Build-time Firebase Android configuration (client config, not service-account secrets):**
Set GitHub repository Actions variables:
- `RAV_FIREBASE_PROJECT_ID`
- `RAV_FIREBASE_APP_ID` (Firebase Android application ID)
- `RAV_FIREBASE_API_KEY`
- `RAV_FIREBASE_SENDER_ID` (FCM numeric project number)

Android package: `com.rav.alliance`. Create the Android app in Firebase first.
The app compiles without these four variables but **will not receive background push**
until configured and a new APK is installed.

**Server setup:** Set the Supabase Edge Function secret `RAV_FCM_SERVICE_ACCOUNT_JSON`
to the full service-account JSON from your own Firebase project in Supabase dashboard Secrets,
not in this repository, chat, or client. Do not commit/paste/share the private key.

**How members opt in:** In the app go to `Acil Bildirim` and tap `Telefon
bildirimlerini aç`, grant system permission, and keep logged into an approved
RAV account. The native FCM token is registered to that user's Supabase ID only
through the authenticated `rav-register-device` Edge Function. Logout
unregisters that device. The service-side `rav-send-alert` function authenticates
sender, checks R4/R5/Site Admin role in the database, rate-limits, persists the
alert and sends FCM. No direct client access to FCM service credentials.

Phone delivery is best-effort; no app can override silent mode, DND, device
battery restrictions, or Google/Android networking. These are RAV-site notifications,
not Last Z native in-game alerts.
