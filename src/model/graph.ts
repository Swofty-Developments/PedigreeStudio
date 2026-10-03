import type { PedigreeDoc, Person, Union } from "./types";

export interface Graph {
  doc: PedigreeDoc;
  unionsOf: Map<string, string[]>;
  childrenOf: Map<string, string[]>;
}

export function buildGraph(doc: PedigreeDoc): Graph {
  const unionsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const id of Object.keys(doc.people)) unionsOf.set(id, []);
  const unions = Object.values(doc.unions).sort((a, b) => a.order - b.order);
  for (const u of unions) {
    childrenOf.set(u.id, []);
    for (const p of u.partners) unionsOf.get(p)?.push(u.id);
  }
  const people = Object.values(doc.people).sort((a, b) => a.order - b.order || a.created - b.created);
  for (const p of people) {
    if (p.parentUnion && childrenOf.has(p.parentUnion)) childrenOf.get(p.parentUnion)!.push(p.id);
  }
  return { doc, unionsOf, childrenOf };
}

export function partnerIn(u: Union, id: string): string {
  return u.partners[0] === id ? u.partners[1] : u.partners[0];
}

export function parentsOf(doc: PedigreeDoc, id: string): string[] {
  const p = doc.people[id];
  if (!p?.parentUnion) return [];
  const u = doc.unions[p.parentUnion];
  return u ? [...u.partners] : [];
}

export function fatherFirst(doc: PedigreeDoc, ids: string[]): string[] {
  const rank = (id: string) => (doc.people[id]?.sex === "male" ? 0 : doc.people[id]?.sex === "female" ? 1 : 2);
  return [...ids].sort((a, b) => rank(a) - rank(b));
}

export function ancestorDepths(doc: PedigreeDoc, id: string): Map<string, number> {
  const out = new Map<string, number>([[id, 0]]);
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = out.get(cur)!;
    for (const par of parentsOf(doc, cur)) {
      if (!out.has(par)) {
        out.set(par, d + 1);
        queue.push(par);
      }
    }
  }
  return out;
}

export function ancestors(doc: PedigreeDoc, id: string): Set<string> {
  const set = new Set(ancestorDepths(doc, id).keys());
  set.delete(id);
  return set;
}

export function descendants(g: Graph, id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const uid of g.unionsOf.get(cur) ?? []) {
      for (const c of g.childrenOf.get(uid) ?? []) {
        if (!out.has(c)) {
          out.add(c);
          stack.push(c);
        }
      }
    }
  }
  return out;
}

export function siblingsOf(g: Graph, id: string): string[] {
  const p = g.doc.people[id];
  if (!p?.parentUnion) return [];
  return (g.childrenOf.get(p.parentUnion) ?? []).filter((c) => c !== id);
}

export function isConsanguineous(doc: PedigreeDoc, u: Union): boolean {
  if (u.consanguinity === "yes") return true;
  if (u.consanguinity === "no") return false;
  return sharesAncestor(doc, u.partners[0], u.partners[1]);
}

export function sharesAncestor(doc: PedigreeDoc, a: string, b: string): boolean {
  const aa = ancestors(doc, a);
  if (!aa.size) return false;
  for (const x of ancestors(doc, b)) if (aa.has(x)) return true;
  return false;
}

export function probandOf(doc: PedigreeDoc): Person | undefined {
  const all = Object.values(doc.people);
  return all.find((p) => p.proband) ?? all.find((p) => p.consultand);
}
