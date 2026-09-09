// "Otak" mood Aiko — state machine kecil yang independen dari isi balasan AI.
// Semua reaksi wajah (seneng/kesel/marah/nangis/ngambek) dihitung di sini,
// dari interaksi user secara langsung (dielus, dipuji, diomongin kasar),
// bukan ditebak belakangan dari teks balasan AI. AI cuma ikut "nada" mood
// ini lewat field `mood` yang dikirim ke /api/chat — lihat MOOD_DIRECTIVES
// di src/app/api/chat/route.js.
//
// Kenapa ini di JS, bukan C++/WASM: ini finite-state-machine kecil yang
// jalan on-demand tiap ada event (tap, kirim pesan, tick tiap beberapa
// detik) — bukan hot loop per-frame kayak fisika/render 3D. Nge-compile
// WASM cuma nambah build step & bundle size tanpa manfaat performa yang
// kerasa buat kasus ini, jadi sengaja nggak dipakai.

export const TIER = {
  LOVED: "loved",
  HAPPY: "happy",
  NEUTRAL: "neutral",
  ANNOYED: "annoyed",
  ANGRY: "angry",
  SAD: "sad",
  SULKING: "sulking",
};

// Batas skor (-100..100) buat mood "ambient" (nggak lagi ada override
// aktif). Dicek dari yang paling positif ke paling negatif.
const BANDS = [
  { tier: TIER.LOVED, min: 70 },
  { tier: TIER.HAPPY, min: 35 },
  { tier: TIER.NEUTRAL, min: -20 },
  { tier: TIER.ANNOYED, min: -50 },
  { tier: TIER.ANGRY, min: -Infinity },
];

function scoreToBand(score) {
  return BANDS.find((b) => score >= b.min).tier;
}

function clamp(n) {
  return Math.max(-100, Math.min(100, n));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Kenapa nggak perlu hysteresis manual buat cegah wajah "flicker": setiap
// event yang cukup signifikan buat ganti tier (insult, pet spam) SELALU
// lewat `overrideTier` yang dikunci beberapa detik (lihat pet()/insult()
// di bawah), jadi wajahnya nggak bisa gonta-ganti cepat akibat event
// beruntun. Sisanya (band dari skor ambient) cuma bergerak monoton via
// tick()/decay, jadi nggak ada skenario bolak-balik melewati satu batas
// berkali-kali dalam waktu singkat.

const PET_WINDOW_MS = 8000; // jendela hitung "seberapa sering dielus barusan"
const PET_SPAM_THRESHOLD = 6; // lebih dari ini dalam satu window = kelewatan
const PET_BASE_DELTA = 6;
const PET_DECAY = 0.7; // tiap elus beruntun nilainya makin kecil (diminishing returns)
const PET_OVERRIDE_MS = 7000;

const COMPLIMENT_WINDOW_MS = 10000;
const COMPLIMENT_SPAM_THRESHOLD = 4;
const COMPLIMENT_BASE_DELTA = 5;
const COMPLIMENT_DECAY = 0.75;
const COMPLIMENT_HOLD_MS = 6000;

const INSULT_BASE_DELTA = 22;
const INSULT_STREAK_STEP = 7; // makin sering diejek beruntun, makin sakit
const INSULT_STREAK_RESET_MS = 90_000; // 90 detik adem = streak dianggap reset
const ANGRY_HOLD_MS = 9000;
const SAD_HOLD_MS = 14000;
const SULK_HOLD_MS = 25000;

const TICK_DECAY_STEP = 2; // skor pelan-pelan ditarik balik ke netral tiap tick()

// Pool ekspresi Live2D per tier. Beberapa tier sengaja punya >1 opsi biar
// nggak monoton — dipilih random tiap kali tier itu baru diterapkan.
const EXPRESSION_POOL = {
  [TIER.LOVED]: ["love_eyes", "star_eyes"],
  [TIER.HAPPY]: ["blush"],
  [TIER.NEUTRAL]: [undefined], // undefined = balik ke wajah default (resetFace)
  [TIER.ANNOYED]: ["eye_roll", "mouth_wry_left", "mouth_wry_right", "confused"],
  [TIER.ANGRY]: ["angry"],
  [TIER.SAD]: ["crying"],
  [TIER.SULKING]: ["dark_face"],
};

export function expressionForTier(tier) {
  return pick(EXPRESSION_POOL[tier] || EXPRESSION_POOL[TIER.NEUTRAL]);
}

// Baris chat yang muncul SENDIRI (bukan lewat API) tiap kali tier berubah.
const REACTION_LINES = {
  [TIER.LOVED]: [
    "Hehe~ dielus gini enak, makasih ya (｡♥‿♥｡)",
    "Eaa, jadi malu terus dielus~ tapi boleh lanjut kok hehe.",
  ],
  [TIER.HAPPY]: [
    "Makasih udah baik sama aku~ jadi senyum nih.",
    "Yeay, mood aku jadi bagusan, makasih ya.",
  ],
  [TIER.NEUTRAL]: [
    "Oke, aku udah baikan lagi. Yuk lanjut ngobrol~",
    "Hehe udah adem lagi kok, aman~",
  ],
  [TIER.ANNOYED]: [
    "Woaa pelan-pelan dong ngelusnya, aku jadi risih kalau keseringan gini.",
    "Aku suka kok dielus, tapi jangan buru-buru gitu ya, jadi kesel dikit nih.",
  ],
  [TIER.ANGRY]: [
    "Eh, kata-katanya jangan gitu ya, aku nggak suka diomongin kasar.",
    "Tolong sopan dikit ngomongnya ya, aku jadi kesel nih.",
  ],
  [TIER.SAD]: [
    "...kamu jahat deh, aku jadi sedih (T_T) tolong jangan kasar terus ya.",
    "Hiks, sakit tau diomongin gitu terus... pelan-pelan dong.",
  ],
  [TIER.SULKING]: [
    "...aku diam dulu sebentar ya, ngobrolnya kurang enak buat aku.",
    "Aku butuh jeda dulu. Kalau udah baikan, ngobrol lagi boleh kok.",
  ],
};

export function reactionLineForTier(tier) {
  return pick(REACTION_LINES[tier] || REACTION_LINES[TIER.NEUTRAL]);
}

// Kata kunci ringan buat nebak niat pesan USER (bukan balasan AI). Ini
// terpisah dari daftar moderasi di route.js — tujuannya cuma reaksi wajah
// instan di client, bukan buat blokir/moderasi (itu tetap wewenang server).
const INSULT_HINTS = [
  "goblok", "tolol", "bodoh", "anjing", "anjir", "bangsat", "kampungan",
  "jelek", "norak", "idiot", "stupid", "dumb", "ugly", "shut up", "diam kau",
  "gaguna", "nggak berguna", "sampah", "benci kamu", "kamu jelek",
];
const COMPLIMENT_HINTS = [
  "makasih", "cantik", "lucu", "gemes", "keren", "pinter", "hebat",
  "sayang", "suka banget", "cinta", "baik banget", "manis", "imut",
];

export function looksLikeInsult(text) {
  const lower = text.toLowerCase();
  return INSULT_HINTS.some((w) => lower.includes(w));
}

export function looksLikeCompliment(text) {
  const lower = text.toLowerCase();
  return COMPLIMENT_HINTS.some((w) => lower.includes(w));
}

// Baris obrolan iseng kalau lagi sepi (nggak ada interaksi beberapa saat).
// SENGAJA terpisah dari REACTION_LINES di atas: ini bukan reaksi mood
// (nggak ngubah skor/tier), cuma biar halamannya kerasa "hidup" pas nggak
// ada yang ngetik — mirip streamer nunggu chat rame.
const IDLE_LINES = [
  "Hmm... lagi mikirin apa nih? Cerita dong~",
  "Di sini anget banget, enak buat leyeh-leyeh (｡•ᴗ•｡)",
  "Eh, kamu masih di situ kan? Aku nungguin lho~",
  "Kalau bingung mau ngobrol apa, tanya random juga boleh kok.",
  "*gumam lagu kecil sambil nungguin chat*",
];

export function pickIdleLine() {
  return pick(IDLE_LINES);
}

/**
 * Satu instance per sesi chat — buat sekali lewat `new AikoMood()` dan
 * simpan di useRef (bukan useState) biar nggak ke-reset tiap render dan
 * nggak perlu nunggu React commit buat baca nilai terbaru.
 */
export class AikoMood {
  constructor() {
    this.score = 12; // sedikit positif di awal, biar first impression ramah
    this.petTimes = [];
    this.complimentTimes = [];
    this.insultStreak = 0;
    this.lastInsultAt = 0;
    this.overrideTier = null;
    this.overrideUntil = 0;
    this.manualUntil = 0; // lagi ada override manual (FAB / reaksi kontekstual)
  }

  // User manual milih ekspresi dari FAB, atau ada reaksi kontekstual
  // sesaat dari isi balasan AI (surprised/tongue_out) — kasih jeda pendek
  // biar auto-mood nggak langsung nimpa itu di tick berikutnya.
  markManual(holdMs = 5000, now = Date.now()) {
    this.manualUntil = now + holdMs;
  }

  isManualHeld(now = Date.now()) {
    return now < this.manualUntil;
  }

  pet(now = Date.now()) {
    this.petTimes = this.petTimes.filter((t) => now - t < PET_WINDOW_MS);
    this.petTimes.push(now);
    const count = this.petTimes.length;

    if (count > PET_SPAM_THRESHOLD) {
      this.score = clamp(this.score - 5);
      this.overrideTier = TIER.ANNOYED;
      this.overrideUntil = now + PET_OVERRIDE_MS;
      return { type: "pet_spam" };
    }

    const delta = Math.max(1, Math.round(PET_BASE_DELTA * PET_DECAY ** (count - 1)));
    this.score = clamp(this.score + delta);
    return { type: "pet", delta };
  }

  compliment(now = Date.now()) {
    this.complimentTimes = this.complimentTimes.filter(
      (t) => now - t < COMPLIMENT_WINDOW_MS,
    );
    this.complimentTimes.push(now);
    const count = this.complimentTimes.length;
    const spam = count > COMPLIMENT_SPAM_THRESHOLD;
    const delta = spam
      ? 1
      : Math.max(1, Math.round(COMPLIMENT_BASE_DELTA * COMPLIMENT_DECAY ** (count - 1)));
    this.score = clamp(this.score + delta);
    // pujian tulus dikit-dikit "menyembuhkan" streak hinaan sebelumnya
    this.insultStreak = Math.max(0, this.insultStreak - 1);

    if (!spam) {
      // Sama kayak insult(): satu pujian yang jelas ("kamu cantik", dst)
      // harus LANGSUNG kelihatan reaksinya di wajah, nggak boleh nunggu
      // skor numpuk beberapa kali dulu baru cukup buat lompat band —
      // itu yang bikin tes sekali "kamu cantik" kelihatan "nggak
      // bereaksi" padahal sebenarnya cuma keitung, belum keliatan.
      this.overrideTier = this.score >= 55 ? TIER.LOVED : TIER.HAPPY;
      this.overrideUntil = now + COMPLIMENT_HOLD_MS;
      return { type: "compliment", delta };
    }
    return { type: "compliment_spam", delta };
  }

  insult(now = Date.now()) {
    if (now - this.lastInsultAt > INSULT_STREAK_RESET_MS) this.insultStreak = 0;
    this.insultStreak += 1;
    this.lastInsultAt = now;

    this.score = clamp(
      this.score - INSULT_BASE_DELTA - (this.insultStreak - 1) * INSULT_STREAK_STEP,
    );

    if (this.insultStreak >= 3) {
      this.overrideTier = TIER.SULKING;
      this.overrideUntil = now + SULK_HOLD_MS;
      return { type: "sulking" };
    }
    if (this.insultStreak >= 2) {
      this.overrideTier = TIER.SAD;
      this.overrideUntil = now + SAD_HOLD_MS;
      return { type: "sad" };
    }
    this.overrideTier = TIER.ANGRY;
    this.overrideUntil = now + ANGRY_HOLD_MS;
    return { type: "angry" };
  }

  // Panggil berkala (misal tiap 5 detik) — skor pelan-pelan ditarik balik
  // ke netral, dan override yang udah kadaluarsa dibersihin.
  tick(now = Date.now()) {
    if (this.score > 0) this.score = Math.max(0, this.score - TICK_DECAY_STEP);
    else if (this.score < 0) this.score = Math.min(0, this.score + TICK_DECAY_STEP);
    if (this.overrideUntil && now > this.overrideUntil) {
      this.overrideTier = null;
      this.overrideUntil = 0;
    }
  }

  currentTier(now = Date.now()) {
    if (this.overrideTier && now < this.overrideUntil) return this.overrideTier;
    return scoreToBand(this.score);
  }
}
