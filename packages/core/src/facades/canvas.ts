import { toSvg } from "./svg";

export function toCanvas(canvas: HTMLCanvasElement, hash: string, size = 120, opts?: { showGrid?: boolean }) {
  const svg = toSvg(hash, size, opts);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  img.onload = () => {
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
