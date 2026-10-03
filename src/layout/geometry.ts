import type { PedigreeDoc, Person } from "../model/types";
import { isConsanguineous } from "../model/graph";
import { HALF } from "../render/labels";
import type { Layout, Pt } from "./layout";

export interface TwinGeom {
  path: string;
  bar: string | null;
  question: Pt | null;
}

export interface UnionGeom {
  id: string;
  line: string;
  double: boolean;
  mid: Pt;
  slashes: string | null;
  descent: string | null;
  bar: string | null;
  drops: { id: string; path: string; dashed: boolean }[];
  twins: TwinGeom[];
  noChildren: { path: string; note: Pt } | null;
}

export function isLoss(p: Person): boolean {
  return p.outcome === "sab" || p.outcome === "top" || p.outcome === "ectopic";
}

export function symbolTop(p: Person): number {
  if (isLoss(p)) return 16;
  if (p.sex === "unknown") return HALF + 3;
  return HALF;
}

export function symbolBottom(p: Person): number {
  if (isLoss(p)) return 13;
  if (p.sex === "unknown") return HALF + 3;
  return HALF;
}

function symbolEdge(p: Person): number {
  if (isLoss(p)) return 12;
  if (p.sex === "unknown") return HALF + 3;
  return HALF;
}

const f = (n: number) => Math.round(n * 10) / 10;

export function computeGeometry(doc: PedigreeDoc, layout: Layout, pos: Map<string, Pt>): UnionGeom[] {
  const out: UnionGeom[] = [];
  const rowOf = new Map<string, number>();
  layout.rows.forEach((row, i) => row.forEach((id) => rowOf.set(id, i)));

  for (const u of Object.values(doc.unions)) {
    const pa = pos.get(u.partners[0]);
    const pb = pos.get(u.partners[1]);
    if (!pa || !pb) continue;
    const [lid, rid] = pa.x <= pb.x ? u.partners : [u.partners[1], u.partners[0]];
    const L = pos.get(lid)!;
    const R = pos.get(rid)!;
    const lp = doc.people[lid];
    const rp = doc.people[rid];
    const y = L.y;
    const row = layout.rows[rowOf.get(lid) ?? 0] ?? [];
    const between = row.some((id) => {
      if (id === lid || id === rid) return false;
      const p = pos.get(id);
      return !!p && p.x > L.x + 1 && p.x < R.x - 1;
    });

    let line: string;
    let mid: Pt;
    if (!between || Math.abs(L.y - R.y) > 1) {
      const x1 = L.x + symbolEdge(lp);
      const x2 = R.x - symbolEdge(rp);
      line = `M${f(x1)},${f(y)}H${f(x2)}`;
      mid = { x: (L.x + R.x) / 2, y };
    } else {
      const lane = y - HALF - 13;
      const ax = L.x + 13;
      const bx = R.x - 13;
      const r = 6;
      line = `M${f(ax)},${f(y - symbolTop(lp))}V${f(lane + r)}Q${f(ax)},${f(lane)} ${f(ax + r)},${f(lane)}H${f(bx - r)}Q${f(bx)},${f(lane)} ${f(bx)},${f(lane + r)}V${f(y - symbolTop(rp))}`;
      mid = { x: (ax + bx) / 2, y: lane };
    }

    const double = isConsanguineous(doc, u);
    const kids = (layout.graph.childrenOf.get(u.id) ?? []).filter((k) => pos.has(k));

    let slashes: string | null = null;
    if (u.status !== "partnered") {
      const cx = kids.length || u.noChildren !== "none" ? mid.x - 12 : mid.x;
      const one = (dx: number) => `M${f(cx + dx - 3.5)},${f(mid.y + 7)}L${f(cx + dx + 3.5)},${f(mid.y - 7)}`;
      slashes = u.status === "divorced" ? one(-3) + one(3) : one(0);
    }

    let descent: string | null = null;
    let bar: string | null = null;
    const drops: UnionGeom["drops"] = [];
    const twins: TwinGeom[] = [];
    let noChildren: UnionGeom["noChildren"] = null;

    if (kids.length) {
      const tops = kids.map((k) => {
        const p = pos.get(k)!;
        return { id: k, x: p.x, top: p.y - symbolTop(doc.people[k]) };
      });
      const minRowY = Math.min(...kids.map((k) => pos.get(k)!.y));
      const barY = minRowY - HALF - 22;
      const attach: number[] = [mid.x];
      const groups = new Map<string, typeof tops>();
      for (const t of tops) {
        const tw = doc.people[t.id].twin;
        if (tw) {
          if (!groups.has(tw)) groups.set(tw, []);
          groups.get(tw)!.push(t);
        }
      }
      const inTwin = new Set<string>();
      for (const [tw, members] of groups) {
        if (members.length < 2) continue;
        members.sort((a, b) => a.x - b.x);
        members.forEach((m) => inTwin.add(m.id));
        const ax = members.reduce((s, m) => s + m.x, 0) / members.length;
        attach.push(ax);
        let path = "";
        for (const m of members) path += `M${f(ax)},${f(barY)}L${f(m.x)},${f(m.top)}`;
        const kind = doc.twins[tw]?.kind ?? "dz";
        let mzBar: string | null = null;
        if (kind === "mz") {
          const a = members[0];
          const b = members[members.length - 1];
          const t = 0.5;
          const ya = barY + (a.top - barY) * t;
          mzBar = `M${f(ax + (a.x - ax) * t)},${f(ya)}L${f(ax + (b.x - ax) * t)},${f(barY + (b.top - barY) * t)}`;
        }
        twins.push({ path, bar: mzBar, question: kind === "unknown" ? { x: ax, y: barY + 17 } : null });
      }
      for (const t of tops) {
        if (inTwin.has(t.id)) continue;
        attach.push(t.x);
        drops.push({ id: t.id, path: `M${f(t.x)},${f(barY)}V${f(t.top)}`, dashed: doc.people[t.id].adoption === "in" });
      }
      const lo = Math.min(...attach);
      const hi = Math.max(...attach);
      descent = `M${f(mid.x)},${f(mid.y)}V${f(barY)}`;
      if (hi - lo > 0.5) bar = `M${f(lo)},${f(barY)}H${f(hi)}`;
    } else if (u.noChildren !== "none") {
      const y0 = mid.y;
      const y1 = y0 + 24;
      let path = `M${f(mid.x)},${f(y0)}V${f(y1)}M${f(mid.x - 9)},${f(y1)}H${f(mid.x + 9)}`;
      if (u.noChildren === "infertility") path += `M${f(mid.x - 9)},${f(y1 + 4.5)}H${f(mid.x + 9)}`;
      noChildren = { path, note: { x: mid.x, y: y1 + (u.noChildren === "infertility" ? 17 : 13) } };
    }

    out.push({ id: u.id, line, double, mid, slashes, descent, bar, drops, twins, noChildren });
  }
  return out;
}
