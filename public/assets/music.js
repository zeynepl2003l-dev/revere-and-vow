/* Revere & Vow — visitor-controlled alliance anthem.
 * Full song file: /assets/rav-marsi.mp3 (uploaded by repository owner).
 * Browsers generally block unprompted audible autoplay.
 */
(() => {
  "use strict";
  const song = document.getElementById("rav-anthem");
  const player = document.getElementById("rav-music-player");
  const welcome = document.getElementById("rav-music-welcome");
  const play = document.getElementById("rav-music-toggle");
  const start = document.getElementById("rav-music-start");
  const skip = document.getElementById("rav-music-skip");
  const mute = document.getElementById("rav-music-mute");
  const volume = document.getElementById("rav-music-volume");
  const status = document.getElementById("rav-music-status");
  if (![song, player, welcome, play, start, skip, mute, volume, status].every(Boolean)) return;

  let available = false;
  const labels = {
    tr: {
      stopped: "Marş hazır", playing: "Marş çalıyor", paused: "Duraklatıldı",
      unavailable: "Müzik yüklenemedi", blocked: "Marşı başlatmak için tekrar dokun",
      play: "▶ Marşı Çal", pause: "Ⅱ Duraklat", mute: "Sesi kapat", unmute: "Sesi aç"
    },
    en: {
      stopped: "Anthem ready", playing: "Anthem playing", paused: "Paused",
      unavailable: "Unable to play anthem", blocked: "Tap again to start the anthem",
      play: "▶ Play anthem", pause: "Ⅱ Pause", mute: "Mute", unmute: "Unmute"
    }
  };
  const t = (name) => labels[document.documentElement.lang === "en" ? "en" : "tr"][name];
  const setStatus = (value) => { status.textContent = t(value); };
  const savedVolume = Number.parseFloat(localStorage.getItem("rav-anthem-volume") || "0.35");
  song.volume = Number.isFinite(savedVolume) ? Math.min(1, Math.max(0, savedVolume)) : 0.35;
  volume.value = String(Math.round(song.volume * 100));
  song.loop = true;
  song.muted = localStorage.getItem("rav-anthem-muted") === "true";

  function refresh() {
    const playing = !song.paused && !song.ended;
    play.textContent = playing ? t("pause") : t("play");
    play.setAttribute("aria-pressed", String(playing));
    mute.textContent = song.muted ? "🔇" : "🔊";
    mute.setAttribute("aria-label", song.muted ? t("unmute") : t("mute"));
    setStatus(playing ? "playing" : "paused");
  }
  async function startMusic() {
    if (!available) return;
    try {
      // Called only after a visitor interaction: browser autoplay-safe.
      await song.play();
      welcome.hidden = true;
      refresh();
    } catch {
      setStatus("blocked");
    }
  }
  start.addEventListener("click", startMusic);
  skip.addEventListener("click", () => { welcome.hidden = true; });
  play.addEventListener("click", () => {
    if (!available) return;
    if (song.paused) void startMusic();
    else { song.pause(); refresh(); }
  });
  mute.addEventListener("click", () => {
    song.muted = !song.muted;
    localStorage.setItem("rav-anthem-muted", String(song.muted));
    refresh();
  });
  volume.addEventListener("input", () => {
    song.volume = Number(volume.value) / 100;
    if (song.volume > 0 && song.muted) song.muted = false;
    localStorage.setItem("rav-anthem-volume", String(song.volume));
    localStorage.setItem("rav-anthem-muted", String(song.muted));
    refresh();
  });
  song.addEventListener("play", refresh);
  song.addEventListener("pause", refresh);
  song.addEventListener("error", () => { setStatus("unavailable"); play.disabled = true; start.disabled = true; });

  // Only show the opening prompt if the uploaded MP3 actually exists.
  async function initialize() {
    try {
      const url = new URL(song.getAttribute("src"), document.baseURI);
      const response = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (!response.ok) return;
      const mime = response.headers.get("content-type") || "";
      if (!/audio\/|application\/octet-stream/i.test(mime)) return;
      available = true;
      player.hidden = false;
      welcome.hidden = false;
      setStatus("stopped");
      refresh();
    } catch {
      // No music file yet or connectivity is unavailable; keep site usable.
    }
  }
  void initialize();
})();
