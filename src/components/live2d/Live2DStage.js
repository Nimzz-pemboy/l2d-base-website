"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import config from "@/lib/config";

const MODEL_URL = config.live2d.modelUrl;
const CUBISM_CORE_URL =
  "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js";

// Cubism Core itu script global (bukan npm package), jadi di-load sekali lewat
// tag <script> biasa. Kalau udah pernah di-load (misal user pindah-pindah tab),
// nggak usah di-load ulang.
function loadCubismCore() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.Live2DCubismCore) return resolve();

    const existing = document.querySelector(`script[src="${CUBISM_CORE_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Gagal load Cubism Core")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = CUBISM_CORE_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal load Cubism Core"));
    document.body.appendChild(script);
  });
}

/**
 * Panggung Live2D buat Aiko. Semua kerjaan berat (load PIXI, load model,
 * render loop) ada di sini. Parent ngontrol lewat ref:
 *   - stageRef.current.expression("blush")
 *   - stageRef.current.motion("Wave")
 *   - stageRef.current.captureDataURL() -> string dataURL PNG | null
 *
 * Tap/klik di badan model diteruskan ke `onHit` (bukan dipilih di sini) —
 * keputusan ekspresi apa yang muncul akibat tap itu sekarang jadi tanggung
 * jawab mood engine di parent (src/lib/aikoMood.js), bukan random di sini,
 * biar cuma ada SATU sumber kebenaran buat wajah Aiko.
 */
const Live2DStage = forwardRef(function Live2DStage({ onStatusChange, onHit }, ref) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const modelRef = useRef(null);
  const naturalSizeRef = useRef({ w: 1, h: 1 });
  const onHitRef = useRef(onHit);
  onHitRef.current = onHit;
  // Kalau expression() dipanggil SEBELUM model kelar load (misal user
  // langsung ngetik & ngirim pesan begitu halaman kebuka, sebelum status
  // "READY"), panggilan itu dulu hilang gitu aja (modelRef.current masih
  // null, optional-chaining-nya no-op diem-diem). Simpen permintaan
  // terakhir di sini, terapin begitu model beres load.
  const pendingExpressionRef = useRef(undefined);
  const hasPendingExpressionRef = useRef(false);

  const talkingRef = useRef(false);

  const [status, setStatus] = useState("loading");
  const [errorDetail, setErrorDetail] = useState("");

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useImperativeHandle(ref, () => ({
    expression(name) {
      if (modelRef.current) {
        modelRef.current.expression(name);
      } else {
        // Model belum siap — simpen, nanti di-apply pas load selesai.
        pendingExpressionRef.current = name;
        hasPendingExpressionRef.current = true;
      }
    },
    motion(group) {
      modelRef.current?.motion(group);
    },
    resetFace() {
      modelRef.current?.expression();
    },
    // Buat fitur screenshot: ambil render Aiko SEKARANG (lengkap sama
    // ekspresi yang lagi aktif) sebagai PNG. Sengaja pakai
    // renderer.plugins.extract (API resmi PIXI v6 buat nge-grab hasil
    // render), bukan canvas.toDataURL() langsung ke elemen <canvas> WebGL
    // -- itu gampang balikin gambar kosong/hitam kalau timing-nya kepeleset
    // dari frame render terakhir, karena WebGL buffer-nya bisa ke-clear
    // begitu frame udah "dipresentasiin" ke layar.
    captureDataURL() {
      const app = appRef.current;
      if (!app || !modelRef.current) return null;
      try {
        const canvas = app.renderer.plugins.extract.canvas(app.stage);
        return canvas.toDataURL("image/png");
      } catch (err) {
        console.error("Gagal extract canvas Live2D:", err);
        return null;
      }
    },
    talk(active) {
      talkingRef.current = active;
      if (!active) {
        const model = modelRef.current;
        if (model?.internalModel?.coreModel) {
          model.internalModel.coreModel.setParameterValueById(
            "ParamMouthOpenY",
            0,
          );
        }
      }
    },
  }));

  useEffect(() => {
    let destroyed = false;
    let removeResize = () => {};

    async function setup() {
      try {
        setStatus("loading");
        await loadCubismCore();
        if (destroyed) return;

        const PIXI = await import("pixi.js");
        // pixi-live2d-display butuh PIXI di window (dipakai internal buat
        // register beberapa mixin/plugin), jadi wajib di-set sebelum di-import.
        window.PIXI = PIXI;

        // PixiJS v6 pakai `new Function(...)` buat generate uniform-setter
        // shader yang dioptimasi, dan itu butuh 'unsafe-eval' di CSP. Daripada
        // longgarin CSP se-situs, kita patch PixiJS-nya biar nggak butuh eval
        // sama sekali — ini yang direkomendasiin PixiJS sendiri buat CSP ketat.
        const { install: installUnsafeEvalPatch } = await import(
          "@pixi/unsafe-eval"
        );
        installUnsafeEvalPatch(PIXI);

        const { Live2DModel } = await import("pixi-live2d-display/cubism4");
        if (destroyed) return;

        const app = new PIXI.Application({
          view: canvasRef.current,
          autoStart: true,
          backgroundAlpha: 0,
          antialias: true,
          // Kanvas sekarang penuh 1 layar (bukan cuma sepotong panel kayak
          // dulu), jadi total piksel yang di-render jauh lebih banyak.
          // Resolution di-cap lebih rendah dari sebelumnya (1.5 alih-alih 2)
          // biar nggak nge-drop FPS di HP dengan devicePixelRatio tinggi
          // (banyak HP Android mid-range punya DPR 2.5–3). Kualitas visual
          // turun dikit, tapi buat karakter 2D di layar HP nggak kerasa.
          resolution: Math.min(window.devicePixelRatio || 1, 1.5),
          autoDensity: true,
        });
        appRef.current = app;

        const model = await Live2DModel.from(MODEL_URL, {
          autoInteract: true,
        });
        if (destroyed) {
          model.destroy();
          app.destroy(true, { children: true });
          return;
        }

        modelRef.current = model;
        app.stage.addChild(model);

        // Ada permintaan expression() yang nyangkut dari sebelum model
        // ini siap? Terapin sekarang, jangan sampe ke-skip permanen.
        if (hasPendingExpressionRef.current) {
          model.expression(pendingExpressionRef.current);
          hasPendingExpressionRef.current = false;
        }

        // Simpan ukuran asli SEBELUM di-scale, karena model.width/height
        // ikut berubah begitu scale di-set (dia PIXI.Container biasa).
        naturalSizeRef.current = { w: model.width || 1, h: model.height || 1 };

        // Framing "setengah badan" — di-tuning ulang dari feedback nyata
        // (screenshot user nunjukkin kepala baru muncul di ~50% tinggi
        // layar, padahal target awal 2%). Penyebabnya: MAX_WIDTH_FRACTION
        // lama (0.96) kepicu duluan sebelum scale-by-height sempet jalan
        // penuh, karena modelnya jauh lebih tinggi drpd lebar (dress+kaki),
        // sementara layar HP portrait juga sempit. Dihitung ulang pakai
        // rasio yang kebalikan dari itu: MAX_WIDTH_FRACTION dilonggarin
        // jauh (lebar dress boleh kepotong di kanan-kiri — itu wajar buat
        // framing setengah-badan ala live streaming), scale-by-height
        // yang jadi patokan utama.
        const ANCHOR_Y = 0.5; // titik anchor di body: 0 = ubun-ubun, 1 = kaki
        const SCREEN_Y = 0.8; // posisi titik anchor itu, relatif ke tinggi kanvas
        const TOP_MARGIN = 0.05; // jarak minimal ubun-ubun ke tepi atas kanvas
        const MAX_WIDTH_FRACTION = 1.8; // cuma jaga2 kasus ekstrem, sengaja longgar

        model.anchor.set(0.5, ANCHOR_Y);

        const fit = () => {
          const parent = wrapRef.current;
          if (!parent || !model) return;
          const w = parent.clientWidth;
          const h = parent.clientHeight;
          const { w: nw, h: nh } = naturalSizeRef.current;

          const renderedHeight = ((SCREEN_Y - TOP_MARGIN) * h) / ANCHOR_Y;
          let scale = renderedHeight / nh;

          const renderedWidth = nw * scale;
          const maxWidth = w * MAX_WIDTH_FRACTION;
          if (renderedWidth > maxWidth) scale = maxWidth / nw;

          model.scale.set(scale);
          model.x = w / 2;
          model.y = h * SCREEN_Y;
          app.renderer.resize(w, h);
        };
        fit();

        window.addEventListener("resize", fit);
        removeResize = () => window.removeEventListener("resize", fit);

        // Klik/tap di badan model = "elus". Ekspresi apa yang muncul
        // sesudahnya ditentukan mood engine di parent lewat onHit, biar
        // konsisten sama reaksi elus yang dipicu dari tombol FAB.
        model.on("hit", () => {
          model.motion("Wave");
          onHitRef.current?.();
        });

        // Lipsync manual: mulut buka-tutup sintetis (sine wave) selama Aiko
        // lagi "ngetik" balasan chat, tanpa perlu audio sama sekali.
        app.ticker.add(() => {
          const core = model.internalModel?.coreModel;
          if (!core) return;

          if (talkingRef.current) {
            const value = (Math.sin(performance.now() / 90) + 1) * 0.28;
            core.setParameterValueById("ParamMouthOpenY", value);
          }
        });

        setStatus("ready");
      } catch (err) {
        console.error("[Live2DStage] gagal init:", err);
        if (!destroyed) {
          setErrorDetail(err?.message || String(err));
          setStatus("error");
        }
      }
    }

    setup();

    return () => {
      destroyed = true;
      removeResize();
      if (modelRef.current) {
        modelRef.current.destroy();
        modelRef.current = null;
      }
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      {status === "loading" && (
        <div style={overlayStyle}>Aiko lagi siap-siap...</div>
      )}
      {status === "error" && (
        <div style={overlayStyle}>
          Gagal load model Aiko.
          {errorDetail && (
            <>
              <br />
              <span style={{ opacity: 0.7, fontSize: "0.78rem" }}>
                {errorDetail}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
});

const overlayStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--text-secondary, #a3a29c)",
  fontFamily: "var(--font-body, sans-serif)",
  fontSize: "0.9rem",
  textAlign: "center",
  padding: "1rem",
};

export default Live2DStage;
