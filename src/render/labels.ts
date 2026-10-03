import type { DisplaySettings, PedigreeDoc, Person } from "../model/types";
import { cancerInfo, GENE_RESULT_BY_ID } from "../model/catalog";
import { capitalise } from "../model/kinship";

export const SANS = "'Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif";
export const SERIF = "'Source Serif 4 Variable', 'Source Serif 4', Georgia, serif";

export const S = 44;
export const HALF = S / 2;
export const LABEL_GAP = 9;
export const LABEL_MAX = 150;

export type LabelLine =
  | { kind: "name"; text: string; muted: boolean; id?: string; h: number; w: number }
  | { kind: "meta"; text: string; h: number; w: number }
  | { kind: "swatch"; text: string; color: string; ring: boolean; h: number; w: number }
  | { kind: "pills"; pills: { text: string; color: string; bg: string; w: number }[]; h: number; w: number }
  | { kind: "note"; text: string; h: number; w: number };

export interface Label {
  lines: LabelLine[];
  width: number;
  height: number;
}

export const FONTS = {
  name: `640 12.5px ${SANS}`,
  meta: `450 11px ${SANS}`,
  pill: `700 9.5px ${SANS}`,
  note: `italic 400 10.5px ${SANS}`,
  id: `650 9.5px ${SANS}`,
};

let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();

export function measure(text: string, font: string): number {
  const key = font + "\u0000" + text;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  let w = text.length * 6.4;
  if (ctx) {
    ctx.font = font;
    w = ctx.measureText(text).width;
  }
  cache.set(key, w);
  return w;
}

export function clearMeasureCache(): void {
  cache.clear();
}

function wrap(text: string, font: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next, font) <= max || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && measure(last + "…", font) > max) last = last.slice(0, -1);
    kept[maxLines - 1] = last + "…";
    return kept;
  }
  return lines.map((l) => {
    if (measure(l, font) <= max) return l;
    let t = l;
    while (t.length > 1 && measure(t + "…", font) > max) t = t.slice(0, -1);
    return t + "…";
  });
}

function truncate(text: string, font: string, max: number): string {
  if (measure(text, font) <= max) return text;
  let t = text;
  while (t.length > 1 && measure(t + "…", font) > max) t = t.slice(0, -1);
  return t + "…";
}

export function ageLine(p: Person): string {
  const parts: string[] = [];
  if (p.outcome === "stillbirth") parts.push(`SB${p.gestation ? ` ${p.gestation}` : ""}`);
  else if (p.outcome === "sab") parts.push(`SAB${p.gestation ? ` ${p.gestation}` : ""}`);
  else if (p.outcome === "top") parts.push(`TOP${p.gestation ? ` ${p.gestation}` : ""}`);
  else if (p.outcome === "ectopic") parts.push("ECT");
  else if (p.outcome === "pregnancy") parts.push(p.gestation ? `LMP/GA ${p.gestation}` : "Pregnancy");
  if (p.outcome === "born") {
    if (p.deceased) {
      const d = p.deathAge ? `d. ${p.deathAge}` : "d.";
      parts.push(p.deathCause ? `${d}, ${p.deathCause}` : d);
    } else if (p.age) parts.push(p.age);
    if (p.birth) parts.push(`b. ${p.birth}`);
  }
  return parts.join(" · ");
}

export function buildLabel(doc: PedigreeDoc, p: Person, relation: string, display: DisplaySettings, idText?: string): Label {
  const lines: LabelLine[] = [];
  const nameText = p.name.trim();
  const idW = idText ? measure(idText, FONTS.id) + 5 : 0;
  if (display.names && nameText) {
    const t = truncate(nameText, FONTS.name, LABEL_MAX - idW);
    lines.push({ kind: "name", text: t, muted: false, id: idText, h: 16, w: measure(t, FONTS.name) + idW });
  } else if (display.relations && relation && relation !== "self") {
    const t = truncate(capitalise(relation), FONTS.meta, LABEL_MAX - idW);
    lines.push({ kind: "name", text: t, muted: true, id: idText, h: 15, w: measure(t, `italic ${FONTS.meta}`) + idW });
  } else if (idText) {
    lines.push({ kind: "name", text: "", muted: true, id: idText, h: 14, w: idW });
  }
  if (display.ages) {
    const a = ageLine(p);
    if (a) {
      const t = truncate(a, FONTS.meta, LABEL_MAX);
      lines.push({ kind: "meta", text: t, h: 14, w: measure(t, FONTS.meta) });
    }
    if (p.assigned) lines.push({ kind: "meta", text: p.assigned, h: 14, w: measure(p.assigned, FONTS.meta) });
  }
  if (display.cancers) {
    for (const c of p.cancers) {
      const info = cancerInfo(c.type);
      const name = c.type === "other" && c.label ? c.label : info.short;
      const t = truncate(`${name}${c.age ? ` ${c.age}` : ""}`, FONTS.meta, LABEL_MAX - 14);
      lines.push({ kind: "swatch", text: t, color: info.color, ring: false, h: 14, w: measure(t, FONTS.meta) + 13 });
    }
    if (p.polyps) {
      const t = `Colon polyps${p.polyps === "yes" ? "" : ` (${p.polyps})`}`;
      lines.push({ kind: "meta", text: t, h: 14, w: measure(t, FONTS.meta) });
    }
    for (const c of p.conditions) {
      const tr = doc.traits[c.traitId];
      if (!tr) continue;
      const suffix = c.status === "carrier" ? " (carrier)" : c.status === "presymptomatic" ? " (presympt.)" : c.status === "suspected" ? " (?)" : "";
      const t = truncate(`${tr.name}${suffix}${c.age ? ` ${c.age}` : ""}`, FONTS.meta, LABEL_MAX - 14);
      lines.push({ kind: "swatch", text: t, color: tr.color, ring: c.status !== "affected", h: 14, w: measure(t, FONTS.meta) + 13 });
    }
  }
  if (display.genes && p.genes.length) {
    const pills = p.genes
      .filter((g) => g.gene.trim())
      .map((g) => {
        const r = GENE_RESULT_BY_ID[g.result];
        const text = `${g.gene.trim()} ${r.short}`;
        return { text, color: r.color, bg: r.bg, w: measure(text, FONTS.pill) + 12 };
      });
    let row: typeof pills = [];
    let rowW = 0;
    const flush = () => {
      if (row.length) lines.push({ kind: "pills", pills: row, h: 18, w: rowW });
      row = [];
      rowW = 0;
    };
    for (const pill of pills) {
      const add = (row.length ? 4 : 0) + pill.w;
      if (rowW + add > LABEL_MAX && row.length) flush();
      rowW += (row.length ? 4 : 0) + pill.w;
      row.push(pill);
    }
    flush();
  }
  if (display.notes && p.note.trim()) {
    for (const l of wrap(p.note.trim(), FONTS.note, LABEL_MAX - 6, 3)) {
      lines.push({ kind: "note", text: l, h: 13.5, w: measure(l, FONTS.note) });
    }
  }
  const width = lines.reduce((m, l) => Math.max(m, l.w), 0);
  const height = lines.reduce((s, l) => s + l.h, 0);
  return { lines, width, height };
}
