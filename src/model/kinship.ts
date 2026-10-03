import type { PedigreeDoc, Sex } from "./types";
import { ancestorDepths, parentsOf } from "./graph";

const ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
const TIMES = ["", "once", "twice", "three times", "four times", "five times"];

function gendered(sex: Sex, m: string, f: string, n: string): string {
  return sex === "male" ? m : sex === "female" ? f : n;
}

function greats(n: number): string {
  if (n <= 0) return "";
  if (n === 1) return "great-";
  return `${n}× great-`;
}

function sideOf(doc: PedigreeDoc, ref: string, ca: string): string {
  const parents = parentsOf(doc, ref);
  const sides = parents.filter((par) => ancestorDepths(doc, par).has(ca));
  if (sides.length !== 1) return "";
  const s = doc.people[sides[0]].sex;
  return s === "male" ? "paternal " : s === "female" ? "maternal " : "";
}

export function bloodRelation(doc: PedigreeDoc, ref: string, target: string): string | null {
  if (ref === target) return "self";
  const A = ancestorDepths(doc, ref);
  const B = ancestorDepths(doc, target);
  let best: { up: number; down: number; ca: string } | null = null;
  for (const [id, up] of A) {
    const down = B.get(id);
    if (down === undefined) continue;
    if (!best || up + down < best.up + best.down) best = { up, down, ca: id };
  }
  if (!best) return null;
  const { up, down, ca } = best;
  const sex = doc.people[target].sex;
  if (up === 0) {
    if (down === 1) return gendered(sex, "son", "daughter", "child");
    if (down === 2) return gendered(sex, "grandson", "granddaughter", "grandchild");
    return greats(down - 2) + gendered(sex, "grandson", "granddaughter", "grandchild");
  }
  if (down === 0) {
    const side = up >= 2 ? sideOf(doc, ref, ca) : "";
    if (up === 1) return gendered(sex, "father", "mother", "parent");
    if (up === 2) return side + gendered(sex, "grandfather", "grandmother", "grandparent");
    return side + greats(up - 2) + gendered(sex, "grandfather", "grandmother", "grandparent");
  }
  if (up === 1 && down === 1) {
    const pa = doc.people[ref].parentUnion;
    const pb = doc.people[target].parentUnion;
    const half = pa !== pb;
    const t = doc.people[target];
    const twin = !half && t.twin && t.twin === doc.people[ref].twin;
    if (twin) return gendered(sex, "twin brother", "twin sister", "twin");
    return (half ? "half-" : "") + gendered(sex, "brother", "sister", "sibling");
  }
  if (up === 1) {
    const base = gendered(sex, "nephew", "niece", "nibling");
    if (down === 2) return base;
    if (down === 3) return "grand" + base;
    return greats(down - 3) + "grand" + base;
  }
  if (down === 1) {
    const side = sideOf(doc, ref, ca);
    const base = gendered(sex, "uncle", "aunt", "parent's sibling");
    if (up === 2) return side + base;
    if (up === 3) return side + "great-" + base;
    return side + greats(up - 2) + base;
  }
  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  const side = sideOf(doc, ref, ca);
  let s = `${ORD[degree] ?? `${degree}th`} cousin`;
  if (removed) s += ` ${TIMES[removed] ?? `${removed} times`} removed`;
  return side + s;
}

const IN_LAW: Record<string, [string, string, string]> = {
  father: ["stepfather", "stepmother", "step-parent"],
  mother: ["stepfather", "stepmother", "step-parent"],
  parent: ["stepfather", "stepmother", "step-parent"],
  brother: ["brother-in-law", "sister-in-law", "sibling-in-law"],
  sister: ["brother-in-law", "sister-in-law", "sibling-in-law"],
  sibling: ["brother-in-law", "sister-in-law", "sibling-in-law"],
  son: ["son-in-law", "daughter-in-law", "child-in-law"],
  daughter: ["son-in-law", "daughter-in-law", "child-in-law"],
  child: ["son-in-law", "daughter-in-law", "child-in-law"],
};

const PARTNERS_KIN: Record<string, [string, string, string]> = {
  father: ["father-in-law", "mother-in-law", "parent-in-law"],
  mother: ["father-in-law", "mother-in-law", "parent-in-law"],
  parent: ["father-in-law", "mother-in-law", "parent-in-law"],
  brother: ["brother-in-law", "sister-in-law", "sibling-in-law"],
  sister: ["brother-in-law", "sister-in-law", "sibling-in-law"],
  sibling: ["brother-in-law", "sister-in-law", "sibling-in-law"],
  son: ["stepson", "stepdaughter", "stepchild"],
  daughter: ["stepson", "stepdaughter", "stepchild"],
  child: ["stepson", "stepdaughter", "stepchild"],
};

function pick(sex: Sex, t: [string, string, string]): string {
  return sex === "male" ? t[0] : sex === "female" ? t[1] : t[2];
}

export function relationTo(doc: PedigreeDoc, ref: string, target: string): string {
  const blood = bloodRelation(doc, ref, target);
  if (blood) return blood;
  const sex = doc.people[target].sex;
  const unions = Object.values(doc.unions);
  for (const u of unions) {
    if (!u.partners.includes(target)) continue;
    const other = u.partners[0] === target ? u.partners[1] : u.partners[0];
    if (other === ref) return u.status === "partnered" ? gendered(sex, "husband / partner", "wife / partner", "partner") : "former partner";
    const rel = bloodRelation(doc, ref, other);
    if (rel && rel !== "self") {
      const key = rel.replace(/^half-/, "");
      if (IN_LAW[key]) return pick(sex, IN_LAW[key]);
      if (/uncle|aunt|parent's sibling/.test(rel)) return rel.replace(/uncle|aunt|parent's sibling/, gendered(sex, "uncle", "aunt", "parent's sibling")) + " by marriage";
      return `${rel}'s partner`;
    }
  }
  for (const u of unions) {
    if (!u.partners.includes(ref)) continue;
    const partner = u.partners[0] === ref ? u.partners[1] : u.partners[0];
    const rel = bloodRelation(doc, partner, target);
    if (rel && rel !== "self") {
      if (PARTNERS_KIN[rel]) return pick(sex, PARTNERS_KIN[rel]);
      return `partner's ${rel}`;
    }
  }
  return "";
}

export function relationMap(doc: PedigreeDoc, ref: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!ref || !doc.people[ref]) return out;
  for (const id of Object.keys(doc.people)) out.set(id, relationTo(doc, ref, id));
  return out;
}

export function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function coupleRelation(doc: PedigreeDoc, a: string, b: string): string {
  const r = bloodRelation(doc, a, b);
  if (!r) return "";
  const map: Record<string, string> = {
    "first cousin": "First cousins",
    "second cousin": "Second cousins",
    "third cousin": "Third cousins",
  };
  const bare = r.replace(/^(paternal|maternal) /, "");
  return map[bare] ?? `${capitalise(doc.people[b].name || "Partner")} is their ${r}`;
}
