import { generateIdentipattern, type Options } from "../core";

export interface SvgOptions extends Pick<Options, "showGrid"> {}

export function toSvg(hash: string, size: number, opts?: SvgOptions): string {
  return generateIdentipattern(hash, { size, showGrid: !!opts?.showGrid });
}
