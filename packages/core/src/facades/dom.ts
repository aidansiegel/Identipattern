import { toSvg } from "./svg";

export interface DomOptions { showGrid?: boolean; }

/**
 * update(target, hash?, options)
 * target: CSS selector or <svg> Element
 * if hash is omitted, reads data-identipattern-hash on the element
 */
export function update(target: string | Element, hash?: string, opts?: DomOptions): void {
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (!el) return;

  const h = (hash ?? (el as Element).getAttribute("data-identipattern-hash") ?? "").toString();
  if (!/^[0-9a-f]{64}$/i.test(h)) throw new Error("hash must be 64 hex characters");

  const szAttr = (el as Element).getAttribute("width") || (el as Element).getAttribute("height");
  const sz = Number(szAttr || 120);
  const svg = toSvg(h, sz || 120, { showGrid: !!opts?.showGrid });

  (el as Element).outerHTML = svg;
}
