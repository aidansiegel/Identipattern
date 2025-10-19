/**
 * Identipattern core (v1.0 spec)
 * - generateIdentipattern(hash, { size, showGrid }) -> SVG string
 * - Blocks: 128 rectangular markers; existence is popcount of bits in bytes 0–15; placement uses p(i) = (i*73) mod 128
 * - Waves: 3–5 lines, 720 points each; stroke width 0.7px at nominal size; border width 0.9×
 * - Center shapes: star, triangle, dot, concentric, polygons (4–8)
 */

export interface Options {
  size?: number;      // px (default 120)
  showGrid?: boolean; // diagnostic overlay
}

const DEFAULTS: Required<Options> = { size: 120, showGrid: false };

function parseBytes(hex: string): number[] {
  const s = hex.toLowerCase();
  const out: number[] = [];
  for (let i = 0; i + 1 < s.length; i += 2) out.push(parseInt(s.slice(i, i + 2), 16) || 0);
  return out;
}

function hashSegment(bytes: number[], start: number, length: number): number {
  let h = 5381;
  for (let i = start; i < start + length && i < bytes.length; i++) h = ((h << 5) + h) + bytes[i];
  return Math.abs(h >>> 0);
}

function permIdx(i: number): number { return (i * 73) & 127; }

function tuneWaves(freq1: number, amplitude: number, curveMaxPx: number, thickness: number) {
  let f1 = freq1;
  let gamma = 1.35;
  let ampScale = 1.0;
  const minGapPx = Math.max(7.0 * thickness, 6.0);

  for (let iter = 0; iter < 3; iter++) {
    let minGap = Infinity;
    const samples = 64;
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      const s1 = Math.sin(f1 * t);
      const s1c = Math.sign(s1) * Math.pow(Math.abs(s1), gamma);
      const r1 = amplitude * (1 + 0.5 * s1c) * ampScale * curveMaxPx;
      const tOpp = t + Math.PI / Math.max(f1, 1e-6);
      const s2 = Math.sin(f1 * tOpp);
      const s2c = Math.sign(s2) * Math.pow(Math.abs(s2), gamma);
      const r2 = amplitude * (1 + 0.5 * s2c) * ampScale * curveMaxPx;
      minGap = Math.min(minGap, Math.abs(r1 - r2));
    }
    if (minGap >= minGapPx) break;
    if (iter === 0) ampScale = Math.min(1.25, ampScale * Math.sqrt(minGapPx / Math.max(minGap, 1e-6)));
    else if (iter === 1) gamma = Math.min(1.7, gamma + 0.2);
    else if (f1 > 3) f1 = Math.max(3, f1 - 1);
  }
  return { f1, gamma, ampScale };
}

function radialAt(t: number, f1: number, amp: number, curveMaxPx: number, keepout: number, thickness: number, gamma: number, ampScale: number) {
  const s = Math.sin(f1 * t);
  const sc = Math.sign(s) * Math.pow(Math.abs(s), gamma);
  let rNorm = amp * (1 + 0.5 * sc) * ampScale;

  const baseHalfSwingPx = 0.5 * amp * curveMaxPx * ampScale;
  const minHalfSwingPx = Math.max(3.0 * thickness, 2.0);
  if (baseHalfSwingPx < minHalfSwingPx) {
    const scale = minHalfSwingPx / Math.max(baseHalfSwingPx, 1e-6);
    const mean = amp * ampScale;
    rNorm = mean + (rNorm - mean) * scale;
  }
  const rPx = rNorm * curveMaxPx;
  return Math.max(keepout, Math.min(curveMaxPx, rPx));
}

function r2(n: number) { return n.toFixed(2); }

export function generateIdentipattern(hashHex: string, options: Options = {}): string {
  const { size, showGrid } = { ...DEFAULTS, ...options };
  if (!/^[0-9a-f]{64}$/i.test(hashHex)) throw new Error("hash must be 64 hex characters");
  const bytes = parseBytes(hashHex);

  // Parameters
  let freq1 = (hashSegment(bytes, 0, 8) % 5) + 3;            // 3..7
  const pseudo = hashSegment(bytes, 8, 8) % 1024;
  const amplitude = ((hashSegment(bytes, 16, 8) % 1000) / 1000) * 0.35 + 0.35; // 0.35..0.70
  if (amplitude < 0.5 && freq1 > 4) freq1 = 4;

  const innerAccent = hashSegment(bytes, 30, 2) % 10;
  const centerHollow = (hashSegment(bytes, 29, 1) & 1) === 1;

  const thickness = 0.7;
  const detail = 720;
  const cx = size / 2, cy = size / 2;
  const maxR = size * 0.38;

  const curveOuterMargin = Math.max(3 * thickness, size * 0.05);
  const curveMaxPx = maxR - curveOuterMargin;

  let keepout = 0;
  if (innerAccent === 0) keepout = size * 0.12;        // star
  else if (innerAccent === 1) keepout = size * 0.15;   // triangle
  else if (innerAccent === 2) keepout = size * 0.06;   // dot
  else if (innerAccent === 3) keepout = size * 0.08;   // concentric
  else if (innerAccent >= 5 && innerAccent <= 9) keepout = size * 0.13; // polygons
  keepout = keepout > 0 ? Math.min(keepout, curveMaxPx * 0.4) : 0;

  const { f1, gamma, ampScale } = tuneWaves(freq1, amplitude, curveMaxPx, thickness);
  const nWaves = ((pseudo >> 6) % 3) + 3;       // 3..5
  const freq2  = ((pseudo >> 2) & 15) % 5 + 4;  // 4..8

  // Border
  const borderSize = size * 0.84; // 8% margin
  const borderOffset = (size - borderSize) / 2;
  const borderThickness = thickness * 0.9;

  // Blocks
  const blockWidth = size * 0.036;
  const blockLength = size * 0.07;
  const blocksPerSide = 32;

  const parts: string[] = [];
  parts.push(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`);
  parts.push(`<rect width="${size}" height="${size}" fill="white"/>`);

  if (showGrid) {
    parts.push('<g opacity="0.2">');
    for (let i = 0; i < 10; i++) {
      const pos = (i + 1) * (size / 10);
      parts.push(`<line x1="${r2(pos)}" y1="0" x2="${r2(pos)}" y2="${r2(size)}" stroke="blue" stroke-width="0.5"/>`);
      parts.push(`<line x1="0" y1="${r2(pos)}" x2="${r2(size)}" y2="${r2(pos)}" stroke="blue" stroke-width="0.5"/>`);
    }
    parts.push('</g>');
  }

  // Square border
  parts.push(`<rect x="${r2(borderOffset)}" y="${r2(borderOffset)}" width="${r2(borderSize)}" height="${r2(borderSize)}" fill="none" stroke="black" stroke-width="${r2(borderThickness)}"/>`);

  // Wave lines
  for (let w = 0; w < nWaves; w++) {
    const waveAngle = (w * 2 * Math.PI) / nWaves;
    const pts: string[] = [];
    for (let i = 0; i <= detail; i++) {
      const t = (i / detail) * Math.PI * 2;
      const r = radialAt(t, f1, amplitude, curveMaxPx, keepout, thickness, gamma, ampScale);
      const ang = freq2 * t + waveAngle;
      const x = cx + r * Math.cos(ang);
      const y = cy + r * Math.sin(ang);
      pts.push(`${r2(x)},${r2(y)}`);
    }
    parts.push(`<path d="M${pts.join(' L')}" fill="none" stroke="black" stroke-width="${r2(thickness)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  // Blocks
  const blockStart = borderOffset + borderSize;
  for (let i = 0; i < 128; i++) {
    const byteIdx = i >> 3, bitIdx = i & 7;
    if (byteIdx < bytes.length && ((bytes[byteIdx] >> bitIdx) & 1)) {
      const pi = permIdx(i);
      const side = Math.floor(pi / blocksPerSide); // 0 top,1 right,2 bottom,3 left
      const posOnSide = (pi % blocksPerSide) / blocksPerSide;
      let x = 0, y = 0, width = 0, height = 0;
      if (side === 0) { // top
        x = borderOffset + posOnSide * borderSize - blockWidth / 2;
        y = borderOffset - blockLength;
        width = blockWidth; height = blockLength;
      } else if (side === 1) { // right
        x = blockStart; y = borderOffset + posOnSide * borderSize - blockWidth / 2;
        width = blockLength; height = blockWidth;
      } else if (side === 2) { // bottom
        x = borderOffset + posOnSide * borderSize - blockWidth / 2;
        y = blockStart; width = blockWidth; height = blockLength;
      } else { // left
        x = borderOffset - blockLength; y = borderOffset + posOnSide * borderSize - blockWidth / 2;
        width = blockLength; height = blockWidth;
      }
      parts.push(`<rect x="${r2(x)}" y="${r2(y)}" width="${r2(width)}" height="${r2(height)}" fill="black"/>`);
    }
  }

  // Center shape
  const centerR = keepout * 0.75;
  function pushStar() {
    const nPoints = 5; const pts: string[] = [];
    for (let i = 0; i < nPoints * 2; i++) {
      const ang = (i * Math.PI) / nPoints - Math.PI / 2;
      const rr = (i % 2 === 0) ? centerR : centerR * 0.4;
      const x = cx + rr * Math.cos(ang), y = cy + rr * Math.sin(ang);
      pts.push(`${r2(x)},${r2(y)}`);
    }
    const extra = centerHollow ? ` fill="none" stroke="black" stroke-width="${r2(thickness)}"` : ` fill="black" stroke="black" stroke-width="${r2(thickness)}"`;
    parts.push(`<path d="M${pts.join(' L')}Z"${extra}/>`);
  }

  function pushTriangle() {
    const pts: string[] = [];
    for (let i = 0; i < 3; i++) {
      const ang = (i * 2 * Math.PI) / 3 - Math.PI / 2;
      const x = cx + centerR * Math.cos(ang), y = cy + centerR * Math.sin(ang);
      pts.push(`${r2(x)},${r2(y)}`);
    }
    const extra = centerHollow ? ` fill="none" stroke="black" stroke-width="${r2(thickness)}"` : ` fill="black" stroke="black" stroke-width="${r2(thickness)}"`;
    parts.push(`<path d="M${pts.join(' L')}Z"${extra}/>`);
  }

  function pushDot() { parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(centerR)}" fill="black"/>`); }

  function pushConcentric() {
    for (let i = 0; i < 3; i++) {
      const r = centerR * (0.4 + i * 0.3);
      parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="none" stroke="black" stroke-width="${r2(thickness * 0.8)}"/>`);
    }
  }

  function pushPolygon(nSides: number) {
    const pts: string[] = [];
    for (let i = 0; i < nSides; i++) {
      const ang = (i * 2 * Math.PI) / nSides - Math.PI / 2;
      const x = cx + centerR * Math.cos(ang), y = cy + centerR * Math.sin(ang);
      pts.push(`${r2(x)},${r2(y)}`);
    }
    const extra = centerHollow ? ` fill="none" stroke="black" stroke-width="${r2(thickness)}"` : ` fill="black" stroke="black" stroke-width="${r2(thickness)}"`;
    parts.push(`<path d="M${pts.join(' L')}Z"${extra}/>`);
  }

  if (centerR > 0) {
    if (innerAccent === 0) pushStar();
    else if (innerAccent === 1) pushTriangle();
    else if (innerAccent === 2) pushDot();
    else if (innerAccent === 3) pushConcentric();
    else if (innerAccent >= 5 && innerAccent <= 9) pushPolygon(innerAccent - 1);
  }

  parts.push('</svg>');
  return parts.join('');
}
