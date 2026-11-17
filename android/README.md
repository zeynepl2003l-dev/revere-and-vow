# RAV Alliance Android APK
Native Android WebView shell displaying the official alliance community site https://rav377.netlify.app/. All accounts, chats, forums and the anthem remain served by the existing site and Supabase.

The selected gold RAV alliance emblem is stored at app/src/main/res/drawable-nodpi/rav_icon.webp. The full-size original graphic is also packaged in the downloadable Android Studio project ZIP in the conversation; for a sharper production icon, replace the repository version with that original graphic.

Build: Java 17, Gradle 8.9, Android SDK 35. Run `gradle -p android :app:assembleDebug` or use the GitHub Actions workflow.

This is a debug test APK, not a signed production release. Do not install APKs from unknown sources. Do not commit signing credentials.

IMPORTANT: no off-app audible push notifications are implemented yet. They require an opt-in push platform, server-side notification rules and Android notification permissions. In-game Last Z messages cannot be read automatically without a supported game integration.
