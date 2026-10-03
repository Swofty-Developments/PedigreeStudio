import type { PedigreeDoc } from "../model/types";
import { buildGraph, descendants, partnerIn, probandOf, type Graph } from "../model/graph";
import { buildLabel, HALF, LABEL_GAP, S, type Label } from "../render/labels";

export interface Pt {
  x: number;
  y: number;
}

export interface Layout {
  pos: Map<string, Pt>;
  gen: Map<string, number>;
  rows: string[][];
  rowY: number[];
  labels: Map<string, Label>;
  footprint: Map<string, number>;
  numbering: Map<string, string>;
  graph: Graph;
}

const GAP_PARTNER = 40;
const GAP_SIBLING = 22;
const GAP_TWIN = 16;
const GAP_FAMILY = 52;
const BELOW_LABEL = 24;
const ABOVE_SYMBOL = 32;

export function roman(n: number): string {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

function computeGenerations(doc: PedigreeDoc, g: Graph): Map<string, number> {
  const ids = Object.keys(doc.people);
  const gen = new Map(ids.map((id) => [id, 0]));
  const unions = Object.values(doc.unions);
  const limit = ids.length * 4 + 20;
  const founder = (id: string) => !doc.people[id].parentUnion;

  for (let outer = 0; outer < 60; outer++) {
    let changed = false;
    for (let it = 0; it < limit; it++) {
      let ch = false;
      for (const u of unions) {
        const [a, b] = u.partners;
        const m = Math.max(gen.get(a)!, gen.get(b)!);
        if (gen.get(a) !== m) { gen.set(a, m); ch = true; }
        if (gen.get(b) !== m) { gen.set(b, m); ch = true; }
        for (const c of g.childrenOf.get(u.id) ?? []) {
          if (gen.get(c)! < m + 1) { gen.set(c, m + 1); ch = true; }
        }
      }
      if (!ch) break;
      changed = true;
    }

    const seen = new Set<string>();
    for (const id of ids) {
      if (!founder(id) || seen.has(id)) continue;
      const cluster: string[] = [];
      const stack = [id];
      seen.add(id);
      let pinned = false;
      while (stack.length) {
        const cur = stack.pop()!;
        cluster.push(cur);
        for (const uid of g.unionsOf.get(cur) ?? []) {
          const other = partnerIn(doc.unions[uid], cur);
          if (!founder(other)) { pinned = true; continue; }
          if (!seen.has(other)) { seen.add(other); stack.push(other); }
        }
      }
      if (pinned) continue;
      let minKid = Infinity;
      for (const m of cluster) {
        for (const uid of g.unionsOf.get(m) ?? []) {
          for (const c of g.childrenOf.get(uid) ?? []) minKid = Math.min(minKid, gen.get(c)!);
        }
      }
      if (minKid === Infinity) continue;
      const target = minKid - 1;
      if (target > gen.get(cluster[0])!) {
        for (const m of cluster) gen.set(m, target);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const min = Math.min(...gen.values());
  for (const [k, v] of gen) gen.set(k, v - min);
  return gen;
}

function orderRows(doc: PedigreeDoc, g: Graph, gen: Map<string, number>): string[][] {
  const placed = new Set<string>();
  const emitted = new Set<string>();
  const rows = new Map<number, string[]>();
  const pos = new Map<string, number>();

  const push = (id: string) => {
    if (placed.has(id)) return;
    const r = gen.get(id)!;
    if (!rows.has(r)) rows.set(r, []);
    const row = rows.get(r)!;
    pos.set(id, row.length);
    row.push(id);
    placed.add(id);
  };

  const parents = (id: string): string[] => {
    const pu = doc.people[id].parentUnion;
    return pu && doc.unions[pu] ? [...doc.unions[pu].partners] : [];
  };

  const hasPlacedAncestor = (id: string): boolean => {
    const seen = new Set<string>();
    const stack = parents(id);
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      if (placed.has(cur)) return true;
      stack.push(...parents(cur));
    }
    return false;
  };

  type Kind = "placed" | "marryin" | "deferred" | "pullin";
  const classify = (q: string): Kind => {
    if (placed.has(q)) return "placed";
    if (!doc.people[q].parentUnion) return "marryin";
    return hasPlacedAncestor(q) ? "deferred" : "pullin";
  };

  const connectScore = (x: string): number => {
    const D = new Set<string>([x, ...descendants(g, x)]);
    let left = false;
    let right = false;
    for (const y of D) {
      for (const uidv of g.unionsOf.get(y) ?? []) {
        const z = partnerIn(doc.unions[uidv], y);
        if (D.has(z)) continue;
        if (placed.has(z)) left = true;
        else if (doc.people[z].parentUnion) right = true;
      }
    }
    return (right ? 1 : 0) - (left ? 1 : 0);
  };

  const emitSibship = (uidv: string) => {
    if (emitted.has(uidv)) return;
    emitted.add(uidv);
    const all = g.childrenOf.get(uidv) ?? [];
    const kids = all.filter((k) => !placed.has(k));
    const anyPlaced = kids.length < all.length;
    const groups: string[][] = [];
    const twinIdx = new Map<string, number>();
    for (const k of kids) {
      const t = doc.people[k].twin;
      if (t && twinIdx.has(t)) groups[twinIdx.get(t)!].push(k);
      else {
        if (t) twinIdx.set(t, groups.length);
        groups.push([k]);
      }
    }
    const scored = groups.map((grp, i) => ({ grp, i, s: Math.sign(grp.reduce((acc, k) => acc + connectScore(k), 0)) }));
    scored.sort((a, b) => a.s - b.s || a.i - b.i);
    const total = scored.reduce((n, x) => n + x.grp.length, 0);
    let idx = 0;
    for (const { grp } of scored) {
      grp.forEach((k, j) => {
        let prefer: "left" | "right" | undefined;
        if (grp.length > 1) prefer = j === 0 ? "left" : "right";
        else if (total === 1 && !anyPlaced) prefer = undefined;
        else prefer = idx === 0 && !anyPlaced ? "left" : "right";
        emitCluster(k, prefer);
        idx++;
      });
    }
  };

  const emitCluster = (c: string, prefer?: "left" | "right", deferPulls = false): string[] => {
    if (placed.has(c)) return [];
    const local = new Set<string>([c]);
    const kinds = (g.unionsOf.get(c) ?? []).map((uidv) => {
      const q = partnerIn(doc.unions[uidv], c);
      return { q, kind: classify(q) };
    });
    const marry = kinds.filter((k) => k.kind === "marryin" && !local.has(k.q));
    const pulls = kinds.filter((k) => k.kind === "pullin");
    const hasPlaced = kinds.some((k) => k.kind === "placed");
    const hasRight = kinds.some((k) => k.kind === "deferred" || k.kind === "pullin");
    const left: string[] = [];
    const right: string[] = [];
    if (hasRight && !hasPlaced) left.push(...marry.map((m) => m.q));
    else if (hasPlaced && !hasRight) right.push(...marry.map((m) => m.q));
    else if (prefer === "left") left.push(...marry.map((m) => m.q));
    else if (prefer === "right") right.push(...marry.map((m) => m.q));
    else {
      let toRight = doc.people[c].sex !== "female";
      for (const m of marry) {
        (toRight ? right : left).push(m.q);
        toRight = !toRight;
      }
    }
    for (const p of pulls) right.push(p.q);
    const pullSet = new Set(pulls.map((p) => p.q));

    const extras = (q: string): string[] => {
      const out: string[] = [];
      for (const uidv of g.unionsOf.get(q) ?? []) {
        const r = partnerIn(doc.unions[uidv], q);
        if (r === c || local.has(r) || placed.has(r)) continue;
        const k = classify(r);
        if (k === "marryin" || k === "pullin") {
          local.add(r);
          out.push(r);
          if (k === "pullin") pullSet.add(r);
        }
      }
      return out;
    };

    for (const q of [...left, ...right]) local.add(q);
    const leftSeq: string[] = [];
    for (const q of left) {
      leftSeq.unshift(q);
      for (const r of extras(q)) leftSeq.unshift(r);
    }
    const rightSeq: string[] = [];
    for (const q of right) {
      rightSeq.push(q);
      for (const r of extras(q)) rightSeq.push(r);
    }
    const seq = [...leftSeq, c, ...rightSeq];
    seq.forEach(push);

    const closing: { uid: string; mid: number }[] = [];
    for (const m of seq) {
      for (const uidv of g.unionsOf.get(m) ?? []) {
        if (emitted.has(uidv)) continue;
        const [a, b] = doc.unions[uidv].partners;
        if (!placed.has(a) || !placed.has(b)) continue;
        if (closing.some((x) => x.uid === uidv)) continue;
        const sameRow = gen.get(a) === gen.get(b);
        closing.push({ uid: uidv, mid: sameRow ? (pos.get(a)! + pos.get(b)!) / 2 : pos.get(m)! });
      }
    }
    closing.sort((a, b) => a.mid - b.mid);
    for (const cl of closing) emitSibship(cl.uid);

    const pullList = seq.filter((m) => pullSet.has(m));
    if (deferPulls) return pullList;
    for (const q of pullList) pullInFamily(q);
    return [];
  };

  const pullInFamily = (q: string) => {
    const pu = doc.people[q].parentUnion;
    if (!pu || emitted.has(pu)) return;
    const [a, b] = doc.unions[pu].partners;
    if (placed.has(a) && placed.has(b)) {
      emitSibship(pu);
      return;
    }
    if (placed.has(a) || placed.has(b)) {
      emitCluster(placed.has(a) ? b : a);
      return;
    }
    let center = a;
    const aHas = !!doc.people[a].parentUnion;
    const bHas = !!doc.people[b].parentUnion;
    if (aHas && !bHas) center = b;
    else if (aHas === bHas && doc.people[b].sex === "male" && doc.people[a].sex !== "male") center = b;
    const later = emitCluster(center, undefined, true);
    const order = doc.people[center].parentUnion ? [center, ...later.filter((x) => x !== center)] : later;
    for (const x of order) pullInFamily(x);
  };

  const climb = (start: string): string => {
    let x = start;
    const seen = new Set<string>();
    while (!seen.has(x)) {
      seen.add(x);
      const ps = parents(x);
      if (!ps.length) break;
      const open = ps.filter((p) => !placed.has(p));
      if (!open.length) break;
      const male = open.find((p) => doc.people[p].sex === "male");
      x = male ?? open[0];
    }
    return x;
  };

  const all = Object.values(doc.people).sort((a, b) => a.created - b.created);
  const start = probandOf(doc) ?? all[0];
  if (start) emitCluster(climb(start.id));

  let guard = all.length * 3 + 10;
  while (placed.size < all.length && guard-- > 0) {
    const rest = all.filter((p) => !placed.has(p.id)).sort((a, b) => gen.get(a.id)! - gen.get(b.id)! || a.created - b.created);
    const x = climb(rest[0].id);
    const pu = doc.people[x].parentUnion;
    if (pu && !emitted.has(pu) && parents(x).every((p) => placed.has(p))) emitSibship(pu);
    else emitCluster(x);
    if (!placed.has(x)) push(x);
  }

  const maxGen = Math.max(0, ...gen.values());
  const out: string[][] = [];
  for (let i = 0; i <= maxGen; i++) out.push(rows.get(i) ?? []);
  return out;
}

export function computeLayout(doc: PedigreeDoc, relations: Map<string, string>): Layout {
  const graph = buildGraph(doc);
  const ids = Object.keys(doc.people);
  const labels = new Map<string, Label>();
  if (!ids.length) {
    return { pos: new Map(), gen: new Map(), rows: [], rowY: [], labels, footprint: new Map(), numbering: new Map(), graph };
  }
  const gen = computeGenerations(doc, graph);
  const rows = orderRows(doc, graph, gen);
  const numbering = new Map<string, string>();
  rows.forEach((row, gi) => row.forEach((id, i) => numbering.set(id, `${roman(gi + 1)}-${i + 1}`)));
  for (const id of ids) {
    labels.set(id, buildLabel(doc, doc.people[id], relations.get(id) ?? "", doc.display, doc.display.ids ? numbering.get(id) : undefined));
  }

  const footprint = new Map<string, number>();
  for (const id of ids) footprint.set(id, Math.max(S + 10, labels.get(id)!.width + 12));

  const partnerKey = new Set<string>();
  for (const u of Object.values(doc.unions)) {
    partnerKey.add(`${u.partners[0]}|${u.partners[1]}`);
    partnerKey.add(`${u.partners[1]}|${u.partners[0]}`);
  }
  const arePartners = (a: string, b: string) => partnerKey.has(`${a}|${b}`);
  const sep = (a: string, b: string): number => {
    const base = (footprint.get(a)! + footprint.get(b)!) / 2;
    if (arePartners(a, b)) return base + GAP_PARTNER;
    const pa = doc.people[a];
    const pb = doc.people[b];
    if (pa.twin && pa.twin === pb.twin) return base + GAP_TWIN;
    if (pa.parentUnion && pa.parentUnion === pb.parentUnion) return base + GAP_SIBLING;
    return base + GAP_FAMILY;
  };

  const x = new Map<string, number>();
  for (const row of rows) {
    let cur = 0;
    row.forEach((id, i) => {
      if (i > 0) cur += sep(row[i - 1], id);
      x.set(id, cur);
    });
  }

  const desiredFor = (id: string): { d: number; w: number } => {
    let sum = 0;
    let w = 0;
    const me = x.get(id)!;
    const p = doc.people[id];
    if (p.parentUnion && doc.unions[p.parentUnion]) {
      const [a, b] = doc.unions[p.parentUnion].partners;
      if (x.has(a) && x.has(b)) {
        const mid = (x.get(a)! + x.get(b)!) / 2;
        const sibs = (graph.childrenOf.get(p.parentUnion) ?? []).filter((s) => gen.get(s) === gen.get(id));
        let lo = Infinity;
        let hi = -Infinity;
        for (const s of sibs) {
          lo = Math.min(lo, x.get(s)!);
          hi = Math.max(hi, x.get(s)!);
        }
        sum += me + (mid - (lo + hi) / 2);
        w += 1;
      }
    }
    for (const uidv of graph.unionsOf.get(id) ?? []) {
      const kids = graph.childrenOf.get(uidv) ?? [];
      if (!kids.length) continue;
      const [a, b] = doc.unions[uidv].partners;
      const mid = (x.get(a)! + x.get(b)!) / 2;
      let lo = Infinity;
      let hi = -Infinity;
      for (const k of kids) {
        lo = Math.min(lo, x.get(k)!);
        hi = Math.max(hi, x.get(k)!);
      }
      sum += me + ((lo + hi) / 2 - mid);
      w += 1;
    }
    if (!w) return { d: me, w: 0.001 };
    return { d: sum / w, w };
  };

  const solveRow = (row: string[]) => {
    if (!row.length) return;
    type Atom = { members: string[]; offs: number[] };
    const atoms: Atom[] = [];
    row.forEach((id, i) => {
      if (i > 0 && arePartners(row[i - 1], id)) {
        const at = atoms[atoms.length - 1];
        at.members.push(id);
        at.offs.push(at.offs[at.offs.length - 1] + sep(row[i - 1], id));
      } else atoms.push({ members: [id], offs: [0] });
    });
    const C: number[] = [];
    atoms.forEach((at, k) => {
      if (k === 0) C.push(0);
      else {
        const prev = atoms[k - 1];
        C.push(C[k - 1] + prev.offs[prev.offs.length - 1] + sep(prev.members[prev.members.length - 1], at.members[0]));
      }
    });
    const targets = atoms.map((at, k) => {
      let s = 0;
      let w = 0;
      at.members.forEach((m, i) => {
        const { d, w: wm } = desiredFor(m);
        s += wm * (d - at.offs[i]);
        w += wm;
      });
      return { t: s / w - C[k], w };
    });
    const blocks: { v: number; w: number; n: number }[] = [];
    for (const t of targets) {
      blocks.push({ v: t.t, w: t.w, n: 1 });
      while (blocks.length >= 2 && blocks[blocks.length - 2].v > blocks[blocks.length - 1].v) {
        const b2 = blocks.pop()!;
        const b1 = blocks.pop()!;
        blocks.push({ v: (b1.v * b1.w + b2.v * b2.w) / (b1.w + b2.w), w: b1.w + b2.w, n: b1.n + b2.n });
      }
    }
    let k = 0;
    for (const b of blocks) {
      for (let j = 0; j < b.n; j++, k++) {
        const at = atoms[k];
        at.members.forEach((m, i) => x.set(m, b.v + C[k] + at.offs[i]));
      }
    }
  };

  const iterations = Math.min(40, 10 + rows.length * 4);
  for (let it = 0; it < iterations; it++) {
    const order = it % 2 === 0 ? rows : [...rows].reverse();
    for (const row of order) solveRow(row);
  }

  let minX = Infinity;
  for (const id of ids) minX = Math.min(minX, x.get(id)! - footprint.get(id)! / 2);

  const rowY: number[] = [];
  rows.forEach((_row, i) => {
    if (i === 0) rowY.push(0);
    else {
      const prev = rows[i - 1];
      const maxLabel = prev.reduce((m, id) => Math.max(m, labels.get(id)!.height), 0);
      rowY.push(rowY[i - 1] + HALF + LABEL_GAP + maxLabel + BELOW_LABEL + ABOVE_SYMBOL + HALF);
    }
  });

  const pos = new Map<string, Pt>();
  rows.forEach((row, gi) => {
    for (const id of row) pos.set(id, { x: Math.round((x.get(id)! - minX) * 10) / 10, y: rowY[gi] });
  });

  return { pos, gen, rows, rowY, labels, footprint, numbering, graph };
}

export const LAYOUT_CONST = { ABOVE_SYMBOL, BELOW_LABEL };

export const liveLayout: { current: Layout | null } = { current: null };

