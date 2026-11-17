# Revere and Vow

Independent Last Z: Survival Shooter alliance community portal.

This repository hosts the public Netlify site. Protected member data and private database scripts are not stored here.

Netlify: main branch, publish directory `public`, no build command.

## RAV ittifak marşı

Sayfa açılışında ziyaretçiye marşı başlatma seçeneği sunulur. Mobil tarayıcılar sesli otomatik oynatmayı genellikle engellediği için ilk dokunuş gerekir.

Müziğin etkin olması için GitHub'daki `public/assets/` klasörüne **`rav-marsi.mp3`** adlı ses dosyasını yükleyin (4.3 MB). Dosya kaynak koda henüz aktarılmadıysa müzik kutusu otomatik gizli kalır. Marşı yayımlamak için gerekli izinlerin sizde olduğundan emin olun; parçada oyuncu isimleri duyulabilir.

Site: https://rav377.netlify.app

## Installable PWA (Android / iOS / desktop)

The existing Netlify site is also a Progressive Web App. Its app manifest, PNG icons and a service worker live in `public/`. Visitors can open the site in Chrome and select **Install app / Add to Home screen**; on iOS use Safari's Share menu to **Add to Home Screen**. The small 📲 button in the header provides a prompt or platform-specific instructions.

The offline fallback is informational only. **Authenticated content, user profiles, DM/chat messages, Supabase API calls, admin sessions and MP3 media are NOT cached by the service worker**. Online connectivity is required for member operations. PWA installation does not grant any membership or moderation privileges.

After pushing changes to `main`, Netlify will publish the updated `public` folder. For a new version, increase the service worker cache identifier in `public/sw.js` if the offline fallback/icons change.
