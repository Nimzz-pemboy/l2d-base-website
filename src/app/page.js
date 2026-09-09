"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./page.module.css";
import config from "@/lib/config";
import {
  AikoMood,
  TIER,
  expressionForTier,
  reactionLineForTier,
  looksLikeInsult,
  looksLikeCompliment,
  pickIdleLine,
} from "@/lib/aikoMood";

const Live2DStage = dynamic(() => import("@/components/live2d/Live2DStage"), {
  ssr: false,
});

// Semua ekspresi manual yang tersedia di model (lihat
// IceGirl.model3.json -> FileReferences.Expressions), dikelompokkan biar
// nggak jadi satu tumpukan 20 tombol tanpa struktur. Label persis nyamain
// "Label" yang udah didefinisiin di model3.json-nya sendiri.
//
// Beberapa nama di sini (blush/love_eyes/star_eyes/angry/crying/dark_face/
// eye_roll/mouth_wry_left/mouth_wry_right/confused) JUGA dipakai otomatis
// sama mood engine (src/lib/aikoMood.js). Milih salah satunya di sini
// tetep aman kok — pickExpression() manggil markManual() yang ngasih jeda
// beberapa detik sebelum auto-mood boleh nimpa lagi, jadi nggak bakal
// langsung ke-reset sepersekian detik doang.
const MOOD_CHIP_GROUPS = [
  {
    section: "Ekspresi Wajah",
    chips: [
      { name: "blush", label: "Malu-malu", icon: "fa-solid fa-face-flushed" },
      { name: "love_eyes", label: "Mata Hati", icon: "fa-solid fa-face-grin-hearts" },
      { name: "star_eyes", label: "Mata Bintang", icon: "fa-solid fa-star" },
      { name: "money_eyes", label: "Mata Duit", icon: "fa-solid fa-sack-dollar" },
      { name: "surprised", label: "Kaget", icon: "fa-solid fa-face-surprise" },
      { name: "confused", label: "Bingung", icon: "fa-solid fa-face-meh" },
      { name: "tongue_out", label: "Lidah Melet", icon: "fa-solid fa-face-grin-tongue" },
      { name: "eye_roll", label: "Melotot Males", icon: "fa-solid fa-face-rolling-eyes" },
      { name: "mouth_wry_left", label: "Mulut Miring Kiri", icon: "fa-solid fa-face-grimace" },
      { name: "mouth_wry_right", label: "Mulut Miring Kanan", icon: "fa-solid fa-face-grimace" },
      { name: "angry", label: "Marah", icon: "fa-solid fa-face-angry" },
      { name: "crying", label: "Nangis", icon: "fa-solid fa-face-sad-tear" },
      { name: "dark_face", label: "Kesel Berat", icon: "fa-solid fa-face-dizzy" },
    ],
  },
  {
    section: "Aksesoris & Gaya",
    chips: [
      { name: "hair_down", label: "Rambut Terurai", icon: "fa-solid fa-wind" },
      { name: "ponytail", label: "Kuncir Kuda", icon: "fa-solid fa-horse-head" },
      { name: "crown", label: "Mahkota", icon: "fa-solid fa-crown" },
      { name: "ice_wings", label: "Sayap Es", icon: "fa-solid fa-snowflake" },
      { name: "cat_ears", label: "Telinga Kucing", icon: "fa-solid fa-cat" },
      { name: "mic_prop", label: "Mic/Prop", icon: "fa-solid fa-microphone" },
      { name: "live_outfit", label: "Outfit Live", icon: "fa-solid fa-shirt" },
    ],
  },
];

// Kata kunci kontekstual dari isi BALASAN AI (bukan pesan user) — reaksi
// sesaat yang nggak ada hubungannya sama mood/afeksi. SENGAJA dibikin
// ketat/spesifik: kata kayak "hehe" dulu sempet dipakai di sini, tapi itu
// muncul di HAMPIR SEMUA balasan Aiko (emang gaya bicaranya), jadi selalu
// ke-trigger dan malah nimpa ekspresi yang lebih tepat (misal abis dipuji
// mestinya blush, tapi ke-timpa jadi melet). Cuma frasa yang jelas nunjuk
// "lagi bercanda/kaget", bukan kata pengisi kalimat biasa.
const CONTEXT_EXPRESSION_KEYWORDS = [
  { name: "surprised", words: ["nggak nyangka", "hah?", "wah, beneran"] },
  { name: "tongue_out", words: ["bercanda kok", "just kidding", "cuma iseng"] },
];

const MOOD_TICK_MS = 5000;
// Live comment ala TikTok cuma nampilin beberapa baris paling baru — bukan
// seluruh riwayat obrolan. Riwayat lengkap tetap ada di `messages` (state)
// buat dikirim ke API; ini cuma batasin yang DIRENDER biar boxnya nggak
// melar ke atas nimpa karakter (lihat catatan di page.module.css).
const VISIBLE_MESSAGE_COUNT = 8;

// Idle chatter: kalau nggak ada interaksi sama sekali selama segini lama,
// Aiko nyeletuk sendiri (biar halamannya kerasa "hidup" pas sepi, bukan
// diem kayak patung). Diulang tiap IDLE_REPEAT_MS selama masih idle, tapi
// dibatasin IDLE_MAX_STREAK kali berturut-turut biar nggak nyerocos terus
// kalau tab-nya ditinggal berjam-jam.
const IDLE_THRESHOLD_MS = 60_000;
const IDLE_REPEAT_MS = 75_000;
const IDLE_MAX_STREAK = 3;

const VISIT_STORAGE_KEY = "aiko_visits";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Gagal load gambar: ${src}`));
    img.src = src;
  });
}

export default function AikoLivePage() {
  const stageRef = useRef(null);
  const moodRef = useRef(null);
  if (!moodRef.current) moodRef.current = new AikoMood();
  const lastTierRef = useRef(TIER.NEUTRAL);

  const [stageStatus, setStageStatus] = useState("loading");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: config.companion.greeting,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [toast, setToast] = useState(null); // { title, message }
  const [fabOpen, setFabOpen] = useState(false);

  const listEndRef = useRef(null);
  const toastTimerRef = useRef(null);
  const fabWrapRef = useRef(null);

  // Kapan terakhir ada interaksi (kirim pesan/elus/pilih ekspresi)
  // — dipakai buat nge-trigger idle chatter kalau udah lama sepi.
  const lastActivityRef = useRef(Date.now());
  const lastIdleLineRef = useRef(0);
  const idleStreakRef = useRef(0);
  const markActivity = () => {
    lastActivityRef.current = Date.now();
    idleStreakRef.current = 0;
  };

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    // Bersihin timer notifikasi kalau komponennya di-unmount di tengah jalan.
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (title, message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ title, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  // Sekali di awal: cek localStorage buat tau ini kunjungan pertama atau
  // udah pernah ke sini sebelumnya. Pengunjung lama disapa beda (nggak
  // dari nol lagi), dan hint "coba elus Aiko" cuma ditampilin sekali
  // seumur browser ini — pengunjung yang balik nggak perlu dituntunin
  // lagi tiap kali buka halamannya.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VISIT_STORAGE_KEY);
      const prev = raw ? JSON.parse(raw) : null;
      const visitCount = (prev?.count || 0) + 1;
      localStorage.setItem(
        VISIT_STORAGE_KEY,
        JSON.stringify({ count: visitCount, lastVisit: Date.now() }),
      );

      if (prev?.count) {
        setMessages([
          {
            role: "assistant",
            content: config.companion.greetingReturning,
          },
        ]);
        return undefined;
      }
    } catch {
      // localStorage bisa gagal (mode privat, dsb) — nggak fatal, lanjut
      // aja anggap kunjungan pertama.
    }

    const t = setTimeout(() => {
      showToast("Psst~", "Coba tap-tap Aiko buat ngelus dia, tapi jangan kenceng-kenceng ya!");
    }, 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nerapin tier mood sekarang ke wajah Aiko + nulis chat sendiri KALAU
  // tier-nya beda dari yang terakhir diterapkan. Ini satu-satunya tempat
  // yang boleh "mendorong" pesan otomatis ke daftar chat.
  const applyMoodTier = (opts = {}) => {
    const mood = moodRef.current;
    const now = Date.now();
    if (!opts.force && mood.isManualHeld(now)) return;

    const tier = mood.currentTier(now);
    if (tier === lastTierRef.current && !opts.force) return;
    lastTierRef.current = tier;

    stageRef.current?.expression(expressionForTier(tier));
    if (tier !== TIER.NEUTRAL || opts.announceNeutral) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reactionLineForTier(tier), auto: true },
      ]);
    }
  };

  // Tick berkala: skor pelan-pelan balik netral, override kadaluarsa
  // dibersihin, lalu dicek apakah tier berubah. Sekalian dipakai buat
  // ngecek idle chatter (nyatuin ke satu interval yang sama, bukan bikin
  // timer baru lagi, biar tetep ringan).
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      moodRef.current.tick(now);
      applyMoodTier();

      const idleFor = now - lastActivityRef.current;
      const sinceLastIdleLine = now - lastIdleLineRef.current;
      if (
        idleFor > IDLE_THRESHOLD_MS &&
        sinceLastIdleLine > IDLE_REPEAT_MS &&
        idleStreakRef.current < IDLE_MAX_STREAK &&
        !moodRef.current.isManualHeld(now)
      ) {
        lastIdleLineRef.current = now;
        idleStreakRef.current += 1;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: pickIdleLine(), auto: true },
        ]);
      }
    }, MOOD_TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dipanggil dari tap di badan model (Live2DStage onHit) ATAU tombol
  // "Elus" di FAB — satu logika yang sama buat dua entry point itu.
  // Panel FAB lagi kebuka -> tap di luar kotaknya nutup panelnya.
  // pointerdown (bukan click) biar kerasa instan di HP juga.
  useEffect(() => {
    if (!fabOpen) return;
    const handlePointerDown = (e) => {
      if (fabWrapRef.current && !fabWrapRef.current.contains(e.target)) {
        setFabOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [fabOpen]);

  const handlePet = () => {
    markActivity();
    const result = moodRef.current.pet();
    if (result.type === "pet_spam") {
      stageRef.current?.motion("Wave");
    }
    applyMoodTier();
  };

  const pickExpression = (name) => {
    markActivity();
    moodRef.current.markManual();
    stageRef.current?.expression(name);
    setFabOpen(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;
    markActivity();

    // Reaksi wajah instan berdasar isi pesan USER — jalan duluan, nggak
    // nunggu balasan API, biar Aiko "terasa" langsung bereaksi. Ini juga
    // dicatat (`hadMoodEvent`) biar reaksi kontekstual dari teks balasan
    // AI di bawah nggak nimpa reaksi mood yang lebih penting ini.
    let hadMoodEvent = false;
    if (looksLikeInsult(content)) {
      hadMoodEvent = true;
      moodRef.current.insult();
      applyMoodTier();
    } else if (looksLikeCompliment(content)) {
      hadMoodEvent = true;
      moodRef.current.compliment();
      applyMoodTier();
    }

    const newMessages = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    stageRef.current?.talk(true);

    let buffer = "";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages
            .slice(-10)
            .map(({ role, content }) => ({ role, content })),
          mood: moodRef.current.currentTier(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Koneksi ke Aiko lagi bermasalah.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        setStreamingText(buffer);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: buffer }]);
      setStreamingText("");

      // Reaksi kontekstual sesaat dari isi balasan AI (nggak terkait mood)
      // — HANYA kalau turn ini belum ada reaksi mood dari pesan user.
      // Kalau dipaksa jalan bareng, reaksi kontekstual bisa nimpa reaksi
      // mood yang lebih penting (misal: dipuji -> mestinya blush/seneng,
      // tapi kalau balasan AI-nya kebetulan ngandung kata "trigger" di
      // bawah, jadi ke-timpa jadi ekspresi lain yang nggak nyambung).
      if (!hadMoodEvent) {
        const lower = buffer.toLowerCase();
        const matched = CONTEXT_EXPRESSION_KEYWORDS.find(({ words }) =>
          words.some((w) => lower.includes(w)),
        );
        if (matched) {
          moodRef.current.markManual(2500);
          stageRef.current?.expression(matched.name);
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err.message || "Duh, koneksinya lagi ngambek nih.",
        },
      ]);
      setStreamingText("");
    } finally {
      setIsLoading(false);
      stageRef.current?.talk(false);
    }
  };

  // "Capture moment": gabungin background ruangan + render Aiko saat ini
  // (lengkap sama ekspresi yang lagi aktif) jadi satu PNG, terus didownload.
  // Diambil dari canvas Live2D langsung (bukan screenshot seluruh halaman),
  // jadi nggak ke-ikut chat bubble / tombol FAB — hasilnya bersih.
  const captureScreenshot = async () => {
    markActivity();
    const charDataUrl = stageRef.current?.captureDataURL?.();
    if (!charDataUrl) {
      showToast("Gagal", "Nggak bisa ambil gambar Aiko sekarang, coba lagi ya.");
      return;
    }
    try {
      const [bgImg, charImg] = await Promise.all([
        loadImage(config.live2d.backgroundImage),
        loadImage(charDataUrl),
      ]);

      const canvas = document.createElement("canvas");
      canvas.width = charImg.width;
      canvas.height = charImg.height;
      const ctx = canvas.getContext("2d");

      // Manual versi CSS "background-size: cover" biar proporsinya sama
      // kayak yang keliatan di layar, bukan background.jpg gepeng/kepotong beda.
      const scale = Math.max(
        canvas.width / bgImg.width,
        canvas.height / bgImg.height,
      );
      const bw = bgImg.width * scale;
      const bh = bgImg.height * scale;
      ctx.drawImage(bgImg, (canvas.width - bw) / 2, (canvas.height - bh) / 2, bw, bh);
      ctx.drawImage(charImg, 0, 0, canvas.width, canvas.height);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `aiko-${Date.now()}.png`;
      link.click();
      showToast("Tersimpan~", "Screenshot-nya udah kedownload!");
      setFabOpen(false);
    } catch (err) {
      console.error("Gagal bikin screenshot:", err);
      showToast("Gagal", "Nggak bisa bikin screenshot sekarang, coba lagi ya.");
    }
  };

  return (
    <main className={styles.page}>
      {/* ---------- Panggung full-layar ---------- */}
      <div
        className={styles.bgImage}
        style={{ backgroundImage: `url(${config.live2d.backgroundImage})` }}
        aria-hidden="true"
      />
      <div className={styles.snowfall} aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className={styles.flake} style={{ "--i": i }} />
        ))}
      </div>
      <div className={styles.canvasWrap}>
        <Live2DStage ref={stageRef} onStatusChange={setStageStatus} onHit={handlePet} />
      </div>

      {/* ---------- Topbar overlay ---------- */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.topbarTitle}>
            {config.companion.name.toUpperCase()}.LIVE
          </span>
          {config.live2d.modelCredit && (
            <span className={styles.modelCredit}>{config.live2d.modelCredit}</span>
          )}
        </div>
        <span className={styles.topbarSpacer} aria-hidden="true" />
        <div className={styles.topbarLinks}>
          <a
            href={config.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.iconLinkButton}
            aria-label="Lihat source code di GitHub"
            title="Source code"
          >
            <i className="fa-brands fa-github" aria-hidden="true" />
          </a>
          <a
            href={`https://vercel.com/new/clone?repository-url=${encodeURIComponent(
              config.links.github,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.iconLinkButton}
            aria-label="Deploy sendiri ke Vercel"
            title="Deploy to Vercel"
          >
            <i className="fa-solid fa-rocket" aria-hidden="true" />
          </a>
        </div>
        <div className={styles.statusPill}>
          <span
            className={styles.statusDot}
            data-state={isLoading ? "talk" : stageStatus}
          />
          {isLoading ? "TALKING" : stageStatus.toUpperCase()}
        </div>
      </header>

      {/* ---------- Chat mengambang di bawah, gaya live comment ---------- */}
      <div className={styles.chatOverlay}>
        <div className={styles.messages}>
          {messages.slice(-VISIBLE_MESSAGE_COUNT).map((m, i) => (
            <div
              key={i}
              className={styles.bubble}
              data-role={m.role}
              data-auto={m.auto ? "true" : undefined}
            >
              {m.content}
            </div>
          ))}
          {streamingText && (
            <div className={styles.bubble} data-role="assistant">
              {streamingText}
              <span className={styles.caret} />
            </div>
          )}
          <div ref={listEndRef} />
        </div>

        <form className={styles.inputRow} onSubmit={sendMessage}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tulis pesan buat Aiko..."
            className={styles.input}
            disabled={isLoading}
            maxLength={500}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={isLoading || !input.trim()}
          >
            <i className="fa-solid fa-paper-plane" aria-hidden="true" />
          </button>
        </form>
      </div>

      {/* ---------- FAB ekspresi ---------- */}
      <div className={styles.fabWrap} ref={fabWrapRef}>
        {fabOpen && (
          <div className={styles.fabPanel}>
            <button type="button" className={styles.fabAction} onClick={handlePet}>
              <i className="fa-solid fa-hand-sparkles" aria-hidden="true" />
              Elus
            </button>
            <button type="button" className={styles.fabAction} onClick={captureScreenshot}>
              <i className="fa-solid fa-camera" aria-hidden="true" />
              Screenshot
            </button>

            <button
              type="button"
              className={styles.fabAction}
              onClick={() => {
                markActivity();
                moodRef.current.markManual(0);
                applyMoodTier({ force: true, announceNeutral: true });
                setFabOpen(false);
              }}
            >
              <i className="fa-solid fa-arrow-rotate-left" aria-hidden="true" />
              Reset Ekspresi
            </button>

            {MOOD_CHIP_GROUPS.map((group) => (
              <div key={group.section} className={styles.fabSection}>
                <p className={styles.fabSectionTitle}>{group.section}</p>
                <div className={styles.fabGrid}>
                  {group.chips.map((chip) => (
                    <button
                      key={chip.name}
                      type="button"
                      className={styles.fabChip}
                      onClick={() => pickExpression(chip.name)}
                    >
                      <i className={chip.icon} aria-hidden="true" />
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className={styles.fabMain}
          onClick={() => setFabOpen((v) => !v)}
          aria-label="Ekspresi Aiko"
          aria-expanded={fabOpen}
        >
          <i
            className={`fa-solid ${fabOpen ? "fa-xmark" : "fa-face-smile-wink"}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          <i className={`fa-solid fa-hourglass-half ${styles.toastIcon}`} aria-hidden="true" />
          <div className={styles.toastBody}>
            <p className={styles.toastTitle}>{toast.title}</p>
            <p className={styles.toastMessage}>{toast.message}</p>
          </div>
          <button
            type="button"
            className={styles.toastClose}
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
      )}
    </main>
  );
}
