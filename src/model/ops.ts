import type { Outcome, PedigreeDoc, Person, Sex, TwinKind, Union } from "./types";
import { ancestors, buildGraph, descendants, partnerIn } from "./graph";

let seq = 0;
export function uid(prefix = "x"): string {
  seq = (seq + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function blankDoc(title = "Untitled pedigree"): PedigreeDoc {
  const now = Date.now();
  return {
    version: 1,
    id: uid("d"),
    title,
    created: now,
    updated: now,
    people: {},
    unions: {},
    twins: {},
    traits: {},
    meta: { informant: "", recordedBy: "", date: new Date().toISOString().slice(0, 10), reason: "", notes: "" },
    display: {
      names: true,
      ages: true,
      ids: true,
      relations: true,
      cancers: true,
      genes: true,
      notes: true,
      legend: true,
      generations: true,
      header: true,
    },
  };
}

export function makePerson(sex: Sex, extra: Partial<Person> = {}): Person {
  return {
    id: uid("p"),
    sex,
    assigned: "",
    name: "",
    note: "",
    age: "",
    birth: "",
    deceased: false,
    deathAge: "",
    deathCause: "",
    proband: false,
    consultand: false,
    evaluated: false,
    adoption: "none",
    outcome: "born",
    gestation: "",
    multiple: "",
    art: "none",
    polyps: "",
    cancers: [],
    conditions: [],
    genes: [],
    ancestry: [],
    parentUnion: null,
    twin: null,
    order: 0,
    created: Date.now() + seq++ / 1000,
    ...extra,
  };
}

function oppositeSex(s: Sex): Sex {
  return s === "male" ? "female" : s === "female" ? "male" : "unknown";
}

function makeUnion(a: string, b: string, order: number): Union {
  return {
    id: uid("u"),
    partners: [a, b],
    status: "partnered",
    consanguinity: "auto",
    noChildren: "none",
    noChildrenNote: "",
    note: "",
    order,
  };
}

function nextUnionOrder(doc: PedigreeDoc): number {
  return Object.values(doc.unions).reduce((m, u) => Math.max(m, u.order), 0) + 1;
}

function childrenOfUnion(doc: PedigreeDoc, uidv: string): Person[] {
  return Object.values(doc.people)
    .filter((p) => p.parentUnion === uidv)
    .sort((a, b) => a.order - b.order);
}

function unionsOfPerson(doc: PedigreeDoc, id: string): Union[] {
  return Object.values(doc.unions)
    .filter((u) => u.partners.includes(id))
    .sort((a, b) => a.order - b.order);
}

export function addPerson(doc: PedigreeDoc, sex: Sex): string {
  const p = makePerson(sex);
  doc.people[p.id] = p;
  return p.id;
}

export function addPartner(doc: PedigreeDoc, id: string, sex?: Sex): { person: string; union: string } {
  const self = doc.people[id];
  const p = makePerson(sex ?? oppositeSex(self.sex));
  doc.people[p.id] = p;
  const u = makeUnion(id, p.id, nextUnionOrder(doc));
  doc.unions[u.id] = u;
  return { person: p.id, union: u.id };
}

export function canLinkPartners(doc: PedigreeDoc, a: string, b: string): string | null {
  if (a === b) return "Pick someone else.";
  const g = buildGraph(doc);
  if (ancestors(doc, a).has(b) || descendants(g, a).has(b)) return "A person can't partner with their own ancestor or descendant.";
  if (Object.values(doc.unions).some((u) => u.partners.includes(a) && u.partners.includes(b))) return "They're already partners.";
  return null;
}

export function linkPartners(doc: PedigreeDoc, a: string, b: string): string {
  const pa = doc.people[a];
  const male = pa.sex === "female" ? b : a;
  const other = male === a ? b : a;
  const u = makeUnion(male, other, nextUnionOrder(doc));
  doc.unions[u.id] = u;
  return u.id;
}

export function canLinkParents(doc: PedigreeDoc, child: string, parent: string): string | null {
  if (doc.people[child]?.parentUnion) return "This person already has parents.";
  if (child === parent) return "Pick someone else.";
  const g = buildGraph(doc);
  if (descendants(g, child).has(parent)) return "A descendant can't become a parent.";
  return null;
}

export function linkParents(doc: PedigreeDoc, child: string, target: { person?: string; union?: string }): void {
  let unionId = target.union;
  if (!unionId && target.person) {
    const us = unionsOfPerson(doc, target.person);
    unionId = us.length ? us[us.length - 1].id : addPartner(doc, target.person).union;
  }
  if (!unionId) return;
  const kids = childrenOfUnion(doc, unionId);
  doc.people[child].parentUnion = unionId;
  doc.people[child].order = (kids.at(-1)?.order ?? 0) + 1;
}

export function ensureUnionFor(doc: PedigreeDoc, id: string, unionId?: string): string {
  if (unionId && doc.unions[unionId]) return unionId;
  const us = unionsOfPerson(doc, id);
  if (us.length) return us[us.length - 1].id;
  return addPartner(doc, id).union;
}

export function addChild(
  doc: PedigreeDoc,
  unionId: string,
  sex: Sex,
  outcome: Outcome = "born",
  after?: string,
): string {
  const kids = childrenOfUnion(doc, unionId);
  let order = (kids.at(-1)?.order ?? 0) + 1;
  if (after) {
    const ref = doc.people[after];
    const later = kids.filter((k) => k.order > ref.order);
    order = later.length ? (ref.order + later[0].order) / 2 : ref.order + 1;
  }
  const p = makePerson(sex, { parentUnion: unionId, order, outcome });
  doc.people[p.id] = p;
  renumberSiblings(doc, unionId);
  return p.id;
}

export function addParents(doc: PedigreeDoc, id: string): { father: string; mother: string; union: string } | null {
  const self = doc.people[id];
  if (self.parentUnion) return null;
  const father = makePerson("male");
  const mother = makePerson("female");
  doc.people[father.id] = father;
  doc.people[mother.id] = mother;
  const u = makeUnion(father.id, mother.id, nextUnionOrder(doc));
  doc.unions[u.id] = u;
  self.parentUnion = u.id;
  self.order = 1;
  return { father: father.id, mother: mother.id, union: u.id };
}

export function addSibling(doc: PedigreeDoc, id: string, sex: Sex, outcome: Outcome = "born"): string {
  const self = doc.people[id];
  if (!self.parentUnion) addParents(doc, id);
  return addChild(doc, self.parentUnion!, sex, outcome, id);
}

export function addTwin(doc: PedigreeDoc, id: string, kind: TwinKind, sex?: Sex): string {
  const self = doc.people[id];
  if (!self.parentUnion) addParents(doc, id);
  let group = self.twin;
  if (!group) {
    group = uid("t");
    doc.twins[group] = { id: group, kind };
    self.twin = group;
  } else {
    doc.twins[group].kind = kind;
  }
  const twinSex = kind === "mz" ? self.sex : (sex ?? self.sex);
  const childId = addChild(doc, self.parentUnion!, twinSex, "born", id);
  doc.people[childId].twin = group;
  if (kind === "mz") {
    for (const p of Object.values(doc.people)) if (p.twin === group) p.sex = self.sex;
  }
  return childId;
}

export function setTwinKind(doc: PedigreeDoc, id: string, kind: TwinKind | "none"): void {
  const self = doc.people[id];
  if (!self.twin) return;
  const group = self.twin;
  if (kind === "none") {
    self.twin = null;
    const rest = Object.values(doc.people).filter((p) => p.twin === group);
    if (rest.length < 2) {
      for (const p of rest) p.twin = null;
      delete doc.twins[group];
    }
    return;
  }
  doc.twins[group].kind = kind;
  if (kind === "mz") for (const p of Object.values(doc.people)) if (p.twin === group) p.sex = self.sex;
}

export function renumberSiblings(doc: PedigreeDoc, unionId: string): void {
  childrenOfUnion(doc, unionId).forEach((k, i) => (k.order = i + 1));
}

export function moveSibling(doc: PedigreeDoc, id: string, dir: -1 | 1): boolean {
  const self = doc.people[id];
  if (!self.parentUnion) return false;
  const kids = childrenOfUnion(doc, self.parentUnion);
  const blocks: Person[][] = [];
  for (const k of kids) {
    const last = blocks.at(-1);
    if (last && k.twin && last[0].twin === k.twin) last.push(k);
    else blocks.push([k]);
  }
  const bi = blocks.findIndex((b) => b.some((k) => k.id === id));
  const block = blocks[bi];
  const inner = block.findIndex((k) => k.id === id);
  if (block.length > 1 && inner + dir >= 0 && inner + dir < block.length) {
    [block[inner], block[inner + dir]] = [block[inner + dir], block[inner]];
  } else {
    const ti = bi + dir;
    if (ti < 0 || ti >= blocks.length) return false;
    [blocks[bi], blocks[ti]] = [blocks[ti], blocks[bi]];
  }
  blocks.flat().forEach((k, i) => (k.order = i + 1));
  return true;
}

export function hasData(p: Person): boolean {
  return !!(p.name || p.note || p.age || p.cancers.length || p.genes.length || p.conditions.length || p.proband || p.consultand);
}

export function deletionPlan(doc: PedigreeDoc, id: string): { remove: Set<string>; blocked: string | null } {
  const g = buildGraph(doc);
  const remove = new Set<string>([id, ...descendants(g, id)]);
  const self = doc.people[id];
  const protectedHit = Object.values(doc.people).find((p) => (p.proband || p.consultand) && p.id !== id && remove.has(p.id));
  if (protectedHit) {
    return {
      remove,
      blocked: self.parentUnion
        ? `Deleting ${self.name || "this person"} would also delete the proband, who descends from them.`
        : `${self.name || "This person"} is an ancestor of the proband. Use “Remove parents” on their child instead.`,
    };
  }
  for (const r of [...remove]) {
    for (const uidv of g.unionsOf.get(r) ?? []) {
      const other = partnerIn(doc.unions[uidv], r);
      if (remove.has(other)) continue;
      const otherP = doc.people[other];
      if (otherP.parentUnion || hasData(otherP)) continue;
      const otherUnions = g.unionsOf.get(other) ?? [];
      if (otherUnions.every((x) => doc.unions[x].partners.some((pp) => remove.has(pp)))) remove.add(other);
    }
  }
  return { remove, blocked: null };
}

export function removePeople(doc: PedigreeDoc, ids: Set<string>): void {
  for (const id of ids) delete doc.people[id];
  for (const u of Object.values(doc.unions)) {
    if (ids.has(u.partners[0]) || ids.has(u.partners[1])) {
      for (const p of Object.values(doc.people)) if (p.parentUnion === u.id) p.parentUnion = null;
      delete doc.unions[u.id];
    }
  }
  cleanupTwins(doc);
}

export function cleanupTwins(doc: PedigreeDoc): void {
  const counts = new Map<string, number>();
  for (const p of Object.values(doc.people)) if (p.twin) counts.set(p.twin, (counts.get(p.twin) ?? 0) + 1);
  for (const p of Object.values(doc.people)) if (p.twin && (counts.get(p.twin) ?? 0) < 2) p.twin = null;
  for (const t of Object.keys(doc.twins)) if ((counts.get(t) ?? 0) < 2) delete doc.twins[t];
}

export function removeParentsPlan(doc: PedigreeDoc, id: string): string | null {
  const self = doc.people[id];
  if (!self.parentUnion) return "No parents to remove.";
  const u = doc.unions[self.parentUnion];
  const siblings = Object.values(doc.people).filter((p) => p.parentUnion === u.id && p.id !== id);
  if (siblings.length) return "Remove the siblings first. Parents are shared with them.";
  for (const par of u.partners) {
    const pp = doc.people[par];
    if (pp.parentUnion) return "A parent has their own parents in the chart. Delete from the top down.";
    if (Object.values(doc.unions).some((x) => x.id !== u.id && x.partners.includes(par))) {
      return "A parent has another partner in the chart. Remove that relationship first.";
    }
  }
  return null;
}

export function removeParents(doc: PedigreeDoc, id: string): void {
  const self = doc.people[id];
  const u = doc.unions[self.parentUnion!];
  self.parentUnion = null;
  self.twin = null;
  for (const par of u.partners) delete doc.people[par];
  delete doc.unions[u.id];
  cleanupTwins(doc);
}

export function removeUnionPlan(doc: PedigreeDoc, unionId: string): string | null {
  if (Object.values(doc.people).some((p) => p.parentUnion === unionId)) return "This couple has children. Delete the children first.";
  return null;
}

export function removeUnion(doc: PedigreeDoc, unionId: string): void {
  const u = doc.unions[unionId];
  delete doc.unions[unionId];
  for (const pid of u.partners) {
    const p = doc.people[pid];
    if (!p) continue;
    const stillLinked = p.parentUnion || Object.values(doc.unions).some((x) => x.partners.includes(pid));
    if (!stillLinked && !hasData(p) && Object.keys(doc.people).length > 1) delete doc.people[pid];
  }
}

export function setProband(doc: PedigreeDoc, id: string, on: boolean): void {
  for (const p of Object.values(doc.people)) if (on) p.proband = p.id === id;
  doc.people[id].proband = on;
}
