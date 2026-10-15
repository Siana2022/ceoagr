"use client";

import { useState } from "react";

const MAX_W = 520;
const MAX_H = 200;

// Resizes the chosen image in the browser and sends it as a small embedded PNG/JPEG.
export function LogoField({ current }: { current: string | null }) {
  const [preview, setPreview] = useState<string | null>(current);
  const [data, setData] = useState("");
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setError("Usa una imagen PNG o JPG.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_W / img.width, MAX_H / img.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let out = canvas.toDataURL("image/png");
      if (out.length > 600_000) out = canvas.toDataURL("image/jpeg", 0.85);
      URL.revokeObjectURL(url);
      if (out.length > 650_000) {
        setError("La imagen es demasiado grande. Prueba con una más pequeña.");
        return;
      }
      setData(out);
      setPreview(out);
      setRemove(false);
    };
    img.onerror = () => setError("No se pudo leer la imagen.");
    img.src = url;
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="logo_data" value={data} />
      <input type="hidden" name="remove_logo" value={remove ? "1" : ""} />
      <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        {preview && !remove ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Logotipo actual" className="max-h-20 max-w-full object-contain" />
        ) : (
          <span className="text-sm text-muted">Sin logotipo</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn btn-secondary cursor-pointer">
          Elegir imagen…
          <input type="file" accept="image/png,image/jpeg" onChange={onFile} className="sr-only" />
        </label>
        {(preview || data) && !remove && (
          <button type="button" className="link-danger text-sm" onClick={() => { setRemove(true); setData(""); }}>Quitar logotipo</button>
        )}
        <span className="text-xs text-muted">PNG o JPG. Se reduce automáticamente.</span>
      </div>
      {error && <p role="alert" className="alert-error">{error}</p>}
    </div>
  );
}
