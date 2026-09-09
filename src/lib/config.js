// Satu-satunya tempat yang perlu kamu ubah buat "isi ulang" template ini
// jadi punya kamu sendiri — identitas kamu, kepribadian companion-nya,
// dan path asset Live2D.
const config = {
  // Ganti ke domain kamu sendiri kalau sudah deploy (dipakai buat metadata
  // SEO/OG image & sitemap.xml).
  siteUrl: "https://l2d-base-website.vercel.app/",

  // Nama kamu sebagai pembuat/pemilik situs ini — dipakai di system prompt
  // AI companion (misal buat jawab "siapa yang bikin kamu?").
  ownerName: "Kamu",

  companion: {
    name: "Aiko",
    // Deskripsi singkat buat metadata SEO (title/OG/Twitter card) di layout.js.
    tagline: "AI companion Live2D yang hidup di halaman ini.",
    // Deskripsi singkat kepribadian, dipakai langsung di system prompt AI
    // (lihat src/app/api/chat/route.js).
    personality:
      "imut, sopan, dan hangat ke siapapun yang baik — tapi punya batas, bukan boneka yang selalu manis apapun yang terjadi",
    greeting:
      "Haaai, selamat datang~ Seneng aku ditemenin di sini. Tap-tap aku buat ngelus, atau langsung ngobrol aja (｡•ᴗ•｡)",
    greetingReturning:
      "Eh, balik lagi~ Seneng deh masih inget aku (｡♥‿♥｡) Mau ngobrol apa hari ini?",
  },

  // Ganti tiga path ini kalau kamu ganti model Live2D-nya ke model lain —
  // nggak ada path lain yang perlu disentuh di luar file ini.
  live2d: {
    modelUrl: "/live2d/icegirl/IceGirl.model3.json",
    backgroundImage: "/live2d/icegirl/background.jpg",
    // Beberapa model Live2D gratisan mewajibkan kredit ditampilkan di
    // halaman (cek lisensi model kamu). Model bawaan template ini,
    // "IceGirl", bikinan @TianYeLulu — bebas dipakai buat VTuber
    // activity/video/SNS asal dikreditkan. Kosongin string ini ("") kalau
    // model penggantimu nggak mewajibkan kredit.
    modelCredit: "Live2D model: @TianYeLulu",
  },

  links: {
    // Dipakai buat tombol "Source" dan "Deploy to Vercel" di topbar
    // halaman. Ganti ke repo GitHub kamu sendiri kalau kamu fork template
    // ini — tombol Deploy otomatis ngikutin URL ini juga.
    github: "https://github.com/Nimzz-pemboy/l2d-base-website",
  },
};

export default config;
