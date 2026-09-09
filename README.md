<div align="center">

<img src="./public/readme.jpg" alt="Aiko Live2D Companion Preview" width="100%">

<br>

# Aiko Live2D Companion

**Open-source Live2D AI companion starter untuk web.**

Satu halaman Next.js dengan Live2D interaktif, AI chat, ekspresi, motion, mood system, dan keamanan dasar.

Cocok untuk programmer yang ingin bereksperimen membuat **web L2D / AI companion** sendiri.

<br>

<a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FNimzz-pemboy%2Fl2d-base-website">
  <img src="https://vercel.com/button" alt="Deploy with Vercel">
</a>

<br><br>

<img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js">
<img src="https://img.shields.io/badge/React-149ECA?style=for-the-badge&logo=react&logoColor=white" alt="React">
<img src="https://img.shields.io/badge/Live2D-Cubism-blue?style=for-the-badge" alt="Live2D Cubism">
<img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel">
<img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="MIT License">

</div>

---

## ✨ Apa Isinya?

- **Live2D Full-Screen** — menggunakan `pixi.js` dan `pixi-live2d-display`, lengkap dengan interaction, expression, dan motion.
- **AI Companion Chat** — chat overlay bergaya live comment yang terhubung ke `/api/chat`.
- **Mood Engine** — mood companion dapat berubah berdasarkan interaksi dan memengaruhi expression serta gaya respons.
- **Source & Deploy** — tombol di topbar untuk membuka repository GitHub dan melakukan deploy ke Vercel.
- **Rate Limiting** — mendukung Upstash Redis dengan fallback in-memory.
- **Security Headers** — termasuk CSP, HSTS, dan security headers lainnya.
- **Basic Moderation** — filter kata kasar dan perlindungan terhadap percobaan jailbreak pada system prompt.
- **Single Page** — hanya satu halaman utama agar mudah di-fork dan dikembangkan.

> **Catatan:** project ini dibuat sebagai starter/eksperimen. Provider AI bawaan menggunakan pihak ketiga tidak resmi dan tidak direkomendasikan untuk penggunaan production atau komersial serius.

---

## 🎨 Kustomisasi

Sebagian besar konfigurasi utama project berada di:

```text
src/lib/config.js
```

Contoh:

```js
const config = {
  siteUrl: "https://situs-kamu.com",

  ownerName: "Kamu",

  companion: {
    name: "Aiko",
    tagline: "AI companion Live2D yang hidup di halaman ini.",
    personality: "imut, sopan, dan hangat...",
    greeting: "Haaai, selamat datang~ ...",
    greetingReturning: "Eh, balik lagi~ ...",
  },

  live2d: {
    modelUrl: "/live2d/icegirl/IceGirl.model3.json",
    backgroundImage: "/live2d/icegirl/background.jpg",
    modelCredit: "Live2D model: @TianYeLulu",
  },

  links: {
    github: "https://github.com/kamu/repo-kamu",
  },
};
```

### Konfigurasi Utama

| Property | Fungsi |
|---|---|
| `siteUrl` | URL website |
| `ownerName` | Nama pemilik project |
| `companion.name` | Nama AI companion |
| `companion.personality` | Kepribadian companion |
| `companion.greeting` | Pesan ketika pertama datang |
| `companion.greetingReturning` | Pesan ketika kembali |
| `live2d.modelUrl` | Lokasi model Live2D |
| `live2d.backgroundImage` | Background Live2D |
| `live2d.modelCredit` | Kredit model |
| `links.github` | Repository GitHub |

> Jika melakukan fork, jangan lupa mengganti `links.github` agar tombol **Source** dan **Deploy to Vercel** mengarah ke repository kamu.

---

## 🧍 Mengganti Model Live2D

Taruh asset model baru di:

```text
public/live2d/<nama-model>/
```

Kemudian ubah konfigurasi:

```js
live2d: {
  modelUrl: "/live2d/<nama-model>/<model>.model3.json",
  backgroundImage: "/live2d/<nama-model>/background.jpg",
  modelCredit: "Kredit model",
},
```

Sesuaikan expression dan motion di:

```text
src/app/page.js
src/lib/aikoMood.js
```

Perhatikan bahwa setiap model Live2D dapat memiliki nama expression dan motion yang berbeda.

### Lisensi Model

Pastikan membaca lisensi model yang digunakan.

Jika model membutuhkan credit:

```js
modelCredit: "Nama creator / credit",
```

Jika tidak membutuhkan credit:

```js
modelCredit: "",
```

---

## 🤖 Mengganti AI Provider

Provider bawaan berada di:

```text
src/lib/unlimitedai.js
```

Provider tersebut merupakan layanan pihak ketiga tidak resmi dan digunakan sebagai default untuk eksperimen.

Untuk penggunaan production, disarankan menggunakan provider AI resmi.

### Langkah

**1.** Buat client/provider baru di:

```text
src/lib/
```

**2.** Buat fungsi streaming yang menerima:

```js
{
  systemPrompt,
  messages
}
```

**3.** Ganti import dan pemanggilan provider di:

```text
src/app/api/chat/route.js
```

**4.** Simpan API key di:

```text
.env
```

> Jangan pernah commit API key atau credential ke repository.

---

## 📁 Struktur Project

```text
l2d-base-website/
│
├── public/
│   ├── readme.jpg
│   │
│   └── live2d/
│       └── icegirl/
│           ├── IceGirl.model3.json
│           └── ...
│
├── src/
│   │
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       └── route.js
│   │   │
│   │   ├── page.js
│   │   ├── page.module.css
│   │   ├── layout.js
│   │   ├── globals.css
│   │   ├── robots.js
│   │   └── sitemap.js
│   │
│   ├── components/
│   │   └── live2d/
│   │       └── Live2DStage.js
│   │
│   └── lib/
│       ├── config.js
│       ├── aikoMood.js
│       ├── unlimitedai.js
│       └── rateLimit.js
│
├── .env.example
├── .gitignore
├── package.json
└── LICENSE
```

---

## 🛠️ Tech Stack

| Teknologi | Penggunaan |
|---|---|
| **Next.js** | Framework & App Router |
| **React** | UI |
| **Vanilla CSS Modules** | Styling |
| **Pixi.js** | Rendering |
| **pixi-live2d-display** | Live2D |
| **Live2D Cubism 4** | Model Live2D |
| **Framer Motion** | Animasi UI |
| **Upstash Redis** | Rate limiting |
| **Vercel** | Deployment |

---

## 🚀 Menjalankan Secara Lokal

### Prasyarat

- Node.js `18.18+`
- npm atau package manager kompatibel

### Clone Repository

```bash
git clone https://github.com/Nimzz-pemboy/l2d-base-website.git
cd base-l2d
```

### Install Dependency

```bash
npm install
```

### Setup Environment

```bash
cp .env.example .env
```

Isi environment variable jika diperlukan.

### Jalankan Development Server

```bash
npm run dev
```

Kemudian buka:

```text
http://localhost:3000
```

---

## 📜 NPM Scripts

| Command | Keterangan |
|---|---|
| `npm run dev` | Development server menggunakan Turbopack |
| `npm run dev:webpack` | Development server menggunakan Webpack |
| `npm run build` | Build production |
| `npm start` | Menjalankan production build |
| `npm run lint` | Menjalankan ESLint |

---

## 🔐 Environment Variables

Salin `.env.example` menjadi `.env`.

| Variable | Status | Keterangan |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Opsional | URL REST Upstash Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Opsional | Token REST Upstash Redis |

Upstash direkomendasikan untuk deployment production.

Tanpa credential Upstash, rate limiter akan menggunakan **in-memory fallback**.

> Pada environment serverless, in-memory rate limiting tidak selalu konsisten karena instance dapat dibuat ulang atau dihentikan.

**Jangan commit `.env` yang berisi credential asli.**

---

## ☁️ Deployment

Project ini dapat di-deploy ke Vercel atau platform Node.js lain yang kompatibel.

### Deploy dengan Vercel

<div align="center">

<a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FNimzz-pemboy%2Fl2d-base-website">
  <img src="https://vercel.com/button" alt="Deploy with Vercel">
</a>

</div>

### Manual

```bash
npm run build
npm start
```

---

## 🛡️ Keamanan

Project menyediakan beberapa lapisan keamanan dasar:

- Rate limiting
- Upstash Redis support
- In-memory fallback
- Content Security Policy
- HSTS
- Security headers
- Basic profanity filtering
- Basic jailbreak filtering

Fitur tersebut bukan pengganti security audit.

Untuk production, lakukan security review dan hardening sesuai kebutuhan aplikasi.

---

## 🎭 Lisensi Model

Model Live2D bawaan adalah **IceGirl** oleh **@TianYeLulu**.

Penggunaan model harus mengikuti ketentuan lisensi dan credit dari creator.

Credit dikontrol melalui:

```js
live2d.modelCredit
```

Jika mengganti model, pastikan model tersebut memiliki lisensi yang mengizinkan penggunaanmu.

---

## 🤝 Kontribusi

Kontribusi sangat diterima.

- Buat **Issue** untuk bug atau feature request.
- Buat **Fork** untuk eksperimen.
- Kirim **Pull Request** untuk improvement.
- Bagikan hasil modifikasi project ini.

---

## ⚠️ Disclaimer

Project ini dibuat sebagai **starter template dan project eksperimen**.

Provider AI bawaan menggunakan layanan pihak ketiga tidak resmi. Jangan mengandalkannya untuk aplikasi production atau sistem komersial yang membutuhkan reliability dan SLA.

Untuk penggunaan serius, gunakan provider AI resmi dan kelola API credential dengan benar.

---

## 📄 License

Project ini dirilis di bawah lisensi **MIT**.

Lihat file [`LICENSE`](./LICENSE) untuk detail lengkap.

---

<div align="center">

**Made with code, Live2D, and curiosity.**

</div>