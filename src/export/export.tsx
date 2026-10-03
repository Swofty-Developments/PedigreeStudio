import { renderToStaticMarkup } from "react-dom/server";
import sansUrl from "@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url";
import sansItalicUrl from "@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-italic.woff2?url";
import serifUrl from "@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2?url";
import type { PedigreeDoc } from "../model/types";
import { computeLayout } from "../layout/layout";
import { computeGeometry } from "../layout/geometry";
import { Chart, computeFrame } from "../render/Chart";
import { relationMap } from "../model/kinship";
import { probandOf } from "../model/graph";
import { isPedigreeJson, normalizeDoc } from "../store/persistence";
import { uid } from "../model/ops";

let fontCssCache: Promise<string> | null = null;

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function fontCss(): Promise<string> {
  if (!fontCssCache) {
    fontCssCache = Promise.all([toDataUrl(sansUrl), toDataUrl(sansItalicUrl), toDataUrl(serifUrl)])
      .then(
        ([sans, sansIt, serif]) =>
          `@font-face{font-family:'Atkinson Hyperlegible Next Variable';font-style:normal;font-weight:200 800;src:url(${sans}) format('woff2');}` +
          `@font-face{font-family:'Atkinson Hyperlegible Next Variable';font-style:italic;font-weight:200 800;src:url(${sansIt}) format('woff2');}` +
          `@font-face{font-family:'Source Serif 4 Variable';font-style:normal;font-weight:200 900;src:url(${serif}) format('woff2');}`,
      )
      .catch(() => "");
  }
  return fontCssCache;
}

export interface BuiltSvg {
  svg: string;
  width: number;
  height: number;
}

export async function buildSvg(doc: PedigreeDoc, opts: { background?: boolean; embedFonts?: boolean } = {}): Promise<BuiltSvg> {
  const relations = relationMap(doc, probandOf(doc)?.id);
  const layout = computeLayout(doc, relations);
  const geoms = computeGeometry(doc, layout, layout.pos);
  const frame = computeFrame(doc, layout, layout.pos, geoms);
  const pad = 44;
  const b = frame.total;
  const width = Math.ceil(b.maxX - b.minX + pad * 2);
  const height = Math.ceil(b.maxY - b.minY + pad * 2);
  const vx = b.minX - pad;
  const vy = b.minY - pad;
  const css = opts.embedFonts === false ? "" : await fontCss();
  const title = doc.title || "Pedigree";
  const svg = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`${vx} ${vy} ${width} ${height}`} role="img" aria-label={title}>
      <title>{title}</title>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {opts.background !== false && <rect x={vx} y={vy} width={width} height={height} fill="#ffffff" />}
      <Chart doc={doc} layout={layout} pos={layout.pos} geoms={geoms} frame={frame} mode="export" prefix="ex-" />
    </svg>,
  );
  return { svg, width, height };
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

export function slug(doc: PedigreeDoc): string {
  return (doc.title || "pedigree").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pedigree";
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function rasterize(built: BuiltSvg, scale: number): Promise<Blob> {
  const maxSide = 14000;
  const s = Math.max(0.5, Math.min(scale, maxSide / built.width, maxSide / built.height));
  const url = URL.createObjectURL(new Blob([built.svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    await new Promise((r) => setTimeout(r, 60));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(built.width * s);
    canvas.height = Math.round(built.height * s);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function pngBlob(doc: PedigreeDoc, scale = 2, background = true): Promise<Blob> {
  const built = await buildSvg(doc, { background });
  return rasterize(built, scale);
}

export async function downloadPng(doc: PedigreeDoc, scale = 2, background = true): Promise<void> {
  download(await pngBlob(doc, scale, background), `${slug(doc)}.png`);
}

export async function copyPng(doc: PedigreeDoc): Promise<void> {
  const item = new ClipboardItem({ "image/png": pngBlob(doc, 2, true) });
  await navigator.clipboard.write([item]);
}

export async function downloadSvg(doc: PedigreeDoc): Promise<void> {
  const built = await buildSvg(doc, { background: true });
  download(new Blob([built.svg], { type: "image/svg+xml" }), `${slug(doc)}.svg`);
}

export function downloadJson(doc: PedigreeDoc): void {
  download(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }), `${slug(doc)}.pedigree.json`);
}

export async function printDoc(doc: PedigreeDoc): Promise<void> {
  const built = await buildSvg(doc, { background: false });
  const landscape = built.width > built.height;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const w = frame.contentWindow!;
  w.document.open();
  w.document.write(
    `<!doctype html><html><head><title>${escapeXml(doc.title || "Pedigree")}</title><style>@page{size:${landscape ? "landscape" : "portrait"};margin:12mm}html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center}svg{max-width:100%;max-height:100vh;width:auto;height:auto}</style></head><body>${built.svg}</body></html>`,
  );
  w.document.close();
  await new Promise((r) => setTimeout(r, 250));
  w.focus();
  w.print();
  setTimeout(() => frame.remove(), 1500);
}

export async function readPedigreeFile(file: File): Promise<PedigreeDoc> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!isPedigreeJson(parsed)) throw new Error("That file isn't a Pedigree Studio chart.");
  const doc = normalizeDoc(parsed);
  doc.id = uid("d");
  doc.updated = Date.now();
  return doc;
}

export async function thumbnailSvg(doc: PedigreeDoc): Promise<string> {
  const built = await buildSvg({ ...doc, display: { ...doc.display, header: false, legend: false, notes: false } }, { background: false, embedFonts: false });
  return built.svg;
}
