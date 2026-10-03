import type { PedigreeDoc, Person, Sex } from "./types";
import * as ops from "./ops";
import { TRAIT_COLORS } from "./catalog";

export interface QuickStart {
  name: string;
  sex: Sex;
  age: string;
  brothers: number;
  sisters: number;
  sons: number;
  daughters: number;
  paternalUncles: number;
  paternalAunts: number;
  maternalUncles: number;
  maternalAunts: number;
  grandparents: boolean;
  partner: boolean;
}

export const QUICK_DEFAULT: QuickStart = {
  name: "",
  sex: "female",
  age: "",
  brothers: 1,
  sisters: 0,
  sons: 0,
  daughters: 0,
  paternalUncles: 1,
  paternalAunts: 1,
  maternalUncles: 0,
  maternalAunts: 1,
  grandparents: true,
  partner: false,
};

export function buildQuickStart(q: QuickStart, title?: string): PedigreeDoc {
  const doc = ops.blankDoc(title || (q.name ? `${q.name}'s family` : "Family pedigree"));
  const me = ops.addPerson(doc, q.sex);
  Object.assign(doc.people[me], { name: q.name, age: q.age, proband: true });
  const needParents = q.brothers || q.sisters || q.grandparents || q.paternalAunts || q.paternalUncles || q.maternalAunts || q.maternalUncles;
  if (needParents) {
    const par = ops.addParents(doc, me)!;
    const sibs: Sex[] = [...Array(q.brothers).fill("male"), ...Array(q.sisters).fill("female")];
    sibs.forEach((s, i) => {
      if (i % 2 === 0) ops.addChild(doc, par.union, s);
      else {
        const id = ops.addChild(doc, par.union, s);
        doc.people[id].order = -i;
      }
    });
    ops.renumberSiblings(doc, par.union);
    const side = (parent: string, uncles: number, aunts: number) => {
      if (!q.grandparents && !uncles && !aunts) return;
      const gp = ops.addParents(doc, parent)!;
      for (let i = 0; i < uncles; i++) ops.addChild(doc, gp.union, "male");
      for (let i = 0; i < aunts; i++) ops.addChild(doc, gp.union, "female");
    };
    side(par.father, q.paternalUncles, q.paternalAunts);
    side(par.mother, q.maternalUncles, q.maternalAunts);
  }
  if (q.partner || q.sons || q.daughters) {
    const { union } = ops.addPartner(doc, me);
    for (let i = 0; i < q.sons; i++) ops.addChild(doc, union, "male");
    for (let i = 0; i < q.daughters; i++) ops.addChild(doc, union, "female");
  }
  return doc;
}

function set(doc: PedigreeDoc, id: string, patch: Partial<Person>) {
  Object.assign(doc.people[id], patch);
}

function cancer(doc: PedigreeDoc, id: string, type: string, age: string) {
  doc.people[id].cancers.push({ id: ops.uid("c"), type, age });
}

function gene(doc: PedigreeDoc, id: string, g: string, variant: string, result: Person["genes"][number]["result"]) {
  doc.people[id].genes.push({ id: ops.uid("g"), gene: g, variant, result });
}

export function sampleHboc(): PedigreeDoc {
  const doc = ops.blankDoc("Hereditary breast & ovarian cancer");
  doc.meta.reason = "Strong family history of breast and ovarian cancer";
  doc.meta.informant = "Proband";
  const me = ops.addPerson(doc, "female");
  set(doc, me, { name: "Sarah", age: "38y", proband: true, ancestry: ["Ashkenazi Jewish"] });
  cancer(doc, me, "breast", "36");
  gene(doc, me, "BRCA1", "c.68_69delAG", "pathogenic");
  const p = ops.addParents(doc, me)!;
  set(doc, p.father, { name: "David", age: "66y" });
  set(doc, p.mother, { name: "Ruth", deceased: true, deathAge: "52y", deathCause: "ovarian ca." });
  cancer(doc, p.mother, "ovarian", "49");
  const sis = ops.addSibling(doc, me, "female");
  set(doc, sis, { name: "Leah", age: "35y" });
  gene(doc, sis, "BRCA1", "c.68_69delAG", "negative");
  const bro = ops.addSibling(doc, me, "male");
  set(doc, bro, { name: "Aaron", age: "41y" });
  doc.people[bro].order = 0;
  ops.renumberSiblings(doc, p.union);
  const gpM = ops.addParents(doc, p.mother)!;
  set(doc, gpM.father, { name: "Isaac", deceased: true, deathAge: "80y" });
  set(doc, gpM.mother, { name: "Miriam", deceased: true, deathAge: "45y" });
  cancer(doc, gpM.mother, "breast", "41");
  const aunt = ops.addChild(doc, gpM.union, "female");
  set(doc, aunt, { name: "Esther", age: "63y" });
  cancer(doc, aunt, "breast", "47");
  cancer(doc, aunt, "pancreatic", "60");
  gene(doc, aunt, "BRCA1", "c.68_69delAG", "pathogenic");
  const unc = ops.addChild(doc, gpM.union, "male");
  set(doc, unc, { name: "Samuel", age: "70y" });
  cancer(doc, unc, "prostate", "65");
  const gpP = ops.addParents(doc, p.father)!;
  set(doc, gpP.father, { name: "Joseph", deceased: true, deathAge: "88y" });
  set(doc, gpP.mother, { name: "Hannah", deceased: true, deathAge: "91y" });
  const pu = ops.addChild(doc, gpP.union, "male");
  set(doc, pu, { name: "Benjamin", age: "69y" });
  doc.people[pu].order = 0;
  ops.renumberSiblings(doc, gpP.union);
  const part = ops.addPartner(doc, me, "male");
  set(doc, part.person, { name: "Michael", age: "40y" });
  const d1 = ops.addChild(doc, part.union, "female");
  set(doc, d1, { name: "Noa", age: "9y" });
  const s1 = ops.addChild(doc, part.union, "male");
  set(doc, s1, { name: "Eli", age: "6y" });
  const cousinU = ops.addPartner(doc, aunt, "male");
  set(doc, cousinU.person, { name: "Daniel", age: "65y" });
  const c1 = ops.addChild(doc, cousinU.union, "female");
  set(doc, c1, { name: "Talia", age: "34y" });
  gene(doc, c1, "BRCA1", "c.68_69delAG", "pathogenic");
  doc.people[c1].note = "Risk-reducing mastectomy at 32";
  return doc;
}

export function sampleLynch(): PedigreeDoc {
  const doc = ops.blankDoc("Lynch syndrome family");
  doc.meta.reason = "Early-onset colorectal cancer";
  const me = ops.addPerson(doc, "male");
  set(doc, me, { name: "James", age: "44y", proband: true, evaluated: true });
  cancer(doc, me, "colorectal", "42");
  gene(doc, me, "MLH1", "c.350C>T", "pathogenic");
  const p = ops.addParents(doc, me)!;
  set(doc, p.father, { name: "Robert", deceased: true, deathAge: "58y" });
  cancer(doc, p.father, "colorectal", "51");
  cancer(doc, p.father, "stomach", "56");
  set(doc, p.mother, { name: "Linda", age: "72y" });
  const sis = ops.addSibling(doc, me, "female");
  set(doc, sis, { name: "Karen", age: "47y" });
  cancer(doc, sis, "endometrial", "45");
  gene(doc, sis, "MLH1", "c.350C>T", "pathogenic");
  doc.people[sis].order = 0;
  ops.renumberSiblings(doc, p.union);
  const tw = ops.addTwin(doc, me, "mz");
  set(doc, tw, { name: "John", age: "44y", polyps: "3" });
  gene(doc, tw, "MLH1", "c.350C>T", "pathogenic");
  const gp = ops.addParents(doc, p.father)!;
  set(doc, gp.father, { name: "Walter", deceased: true, deathAge: "61y" });
  cancer(doc, gp.father, "colorectal", "55");
  set(doc, gp.mother, { name: "Dorothy", deceased: true, deathAge: "84y" });
  const aunt = ops.addChild(doc, gp.union, "female");
  set(doc, aunt, { name: "Nancy", age: "70y" });
  cancer(doc, aunt, "endometrial", "50");
  cancer(doc, aunt, "ovarian", "62");
  const part = ops.addPartner(doc, me, "female");
  set(doc, part.person, { name: "Emily", age: "41y" });
  const k1 = ops.addChild(doc, part.union, "male");
  set(doc, k1, { name: "Owen", age: "12y" });
  ops.addChild(doc, part.union, "unknown", "sab");
  const k2 = ops.addChild(doc, part.union, "female");
  set(doc, k2, { name: "Ava", age: "8y" });
  const sisP = ops.addPartner(doc, sis, "male");
  set(doc, sisP.person, { name: "Paul" });
  doc.unions[sisP.union].status = "divorced";
  doc.unions[sisP.union].noChildren = "infertility";
  doc.unions[sisP.union].noChildrenNote = "IVF ×2";
  return doc;
}

export function sampleConsanguineous(): PedigreeDoc {
  const doc = ops.blankDoc("Consanguineous family · autosomal recessive");
  doc.meta.reason = "Child with cystic fibrosis";
  const tid = ops.uid("tr");
  doc.traits[tid] = { id: tid, name: "Cystic fibrosis", color: TRAIT_COLORS[0], pattern: "solid", inheritance: "AR" };
  const gf = ops.addPerson(doc, "male");
  set(doc, gf, { name: "Hassan", deceased: true, deathAge: "79y" });
  const { person: gm, union: gu } = ops.addPartner(doc, gf, "female");
  set(doc, gm, { name: "Amira", deceased: true, deathAge: "83y" });
  const s1 = ops.addChild(doc, gu, "male");
  set(doc, s1, { name: "Omar", age: "58y" });
  doc.people[s1].conditions.push({ id: ops.uid("k"), traitId: tid, status: "carrier", age: "" });
  const s2 = ops.addChild(doc, gu, "female");
  set(doc, s2, { name: "Layla", age: "55y" });
  doc.people[s2].conditions.push({ id: ops.uid("k"), traitId: tid, status: "carrier", age: "" });
  const w1 = ops.addPartner(doc, s1, "female");
  set(doc, w1.person, { name: "Salma", age: "56y" });
  const h2 = ops.addPartner(doc, s2, "male");
  set(doc, h2.person, { name: "Karim", age: "57y" });
  const c1 = ops.addChild(doc, w1.union, "male");
  set(doc, c1, { name: "Yusuf", age: "31y" });
  doc.people[c1].conditions.push({ id: ops.uid("k"), traitId: tid, status: "carrier", age: "" });
  const c1b = ops.addChild(doc, w1.union, "female");
  set(doc, c1b, { name: "Nour", age: "28y" });
  doc.people[c1b].order = 0;
  ops.renumberSiblings(doc, w1.union);
  const c2 = ops.addChild(doc, h2.union, "female");
  set(doc, c2, { name: "Mariam", age: "29y" });
  doc.people[c2].conditions.push({ id: ops.uid("k"), traitId: tid, status: "carrier", age: "" });
  ops.addChild(doc, h2.union, "male");
  const cu = ops.linkPartners(doc, c1, c2);
  const k1 = ops.addChild(doc, cu, "male");
  set(doc, k1, { name: "Adam", age: "4y", proband: true });
  doc.people[k1].conditions.push({ id: ops.uid("k"), traitId: tid, status: "affected", age: "dx 6m" });
  gene(doc, k1, "CFTR", "F508del / F508del", "pathogenic");
  const k2 = ops.addChild(doc, cu, "female");
  set(doc, k2, { name: "Sara", age: "2y" });
  ops.addChild(doc, cu, "unknown", "pregnancy");
  doc.people[Object.keys(doc.people).at(-1)!].gestation = "20 wk";
  return doc;
}

export function sampleShowcase(): PedigreeDoc {
  const doc = ops.blankDoc("Symbol showcase");
  doc.meta.reason = "Every NSGC notation in one chart";
  const tid = ops.uid("tr");
  doc.traits[tid] = { id: tid, name: "Hearing loss", color: TRAIT_COLORS[4], pattern: "hatch", inheritance: "AR" };
  const tid2 = ops.uid("tr");
  doc.traits[tid2] = { id: tid2, name: "Hypertrophic cardiomyopathy", color: TRAIT_COLORS[6], pattern: "solid", inheritance: "AD" };
  const a = ops.addPerson(doc, "male");
  set(doc, a, { name: "Frank", age: "70y" });
  doc.people[a].conditions.push({ id: ops.uid("k"), traitId: tid2, status: "affected", age: "" });
  const first = ops.addPartner(doc, a, "female");
  set(doc, first.person, { name: "Grace", deceased: true, deathAge: "60y" });
  doc.unions[first.union].status = "divorced";
  const second = ops.addPartner(doc, a, "female");
  set(doc, second.person, { name: "Helen", age: "66y" });
  const k1 = ops.addChild(doc, first.union, "male");
  set(doc, k1, { name: "Ian", age: "42y", consultand: true });
  doc.people[k1].conditions.push({ id: ops.uid("k"), traitId: tid2, status: "presymptomatic", age: "" });
  const k2 = ops.addChild(doc, second.union, "female");
  set(doc, k2, { name: "June", age: "35y", adoption: "in", assigned: "AMAB" });
  const t1 = ops.addChild(doc, second.union, "female");
  set(doc, t1, { name: "Kate", age: "30y" });
  const t2 = ops.addTwin(doc, t1, "mz");
  set(doc, t2, { name: "Kim", age: "30y" });
  doc.people[t2].conditions.push({ id: ops.uid("k"), traitId: tid, status: "affected", age: "" });
  const iP = ops.addPartner(doc, k1, "female");
  set(doc, iP.person, { name: "Lena", age: "40y", evaluated: true });
  doc.people[iP.person].conditions.push({ id: ops.uid("k"), traitId: tid, status: "carrier", age: "" });
  const x1 = ops.addChild(doc, iP.union, "male");
  set(doc, x1, { name: "Max", age: "10y" });
  doc.people[x1].conditions.push({ id: ops.uid("k"), traitId: tid, status: "affected", age: "" });
  doc.people[x1].conditions.push({ id: ops.uid("k"), traitId: tid2, status: "affected", age: "" });
  ops.addChild(doc, iP.union, "unknown", "sab");
  ops.addChild(doc, iP.union, "unknown", "top");
  const sb = ops.addChild(doc, iP.union, "female", "stillbirth");
  doc.people[sb].gestation = "34 wk";
  const preg = ops.addChild(doc, iP.union, "unknown", "pregnancy");
  doc.people[preg].gestation = "16 wk";
  const dz1 = ops.addChild(doc, iP.union, "male");
  const dz2 = ops.addTwin(doc, dz1, "dz", "female");
  set(doc, dz1, { age: "3y" });
  set(doc, dz2, { age: "3y" });
  const m = ops.addSibling(doc, k1, "unknown");
  set(doc, m, { multiple: "3", name: "" });
  const kP = ops.addPartner(doc, k2, "female");
  doc.unions[kP.union].noChildren = "choice";
  doc.unions[kP.union].status = "separated";
  set(doc, kP.person, { name: "Nina" });
  return doc;
}

export const SAMPLES = [
  { id: "hboc", title: "Hereditary breast & ovarian cancer", blurb: "BRCA1 family across 4 generations", build: sampleHboc },
  { id: "lynch", title: "Lynch syndrome", blurb: "Colorectal & endometrial, twins, a divorce", build: sampleLynch },
  { id: "consang", title: "Consanguineous family", blurb: "First-cousin union, recessive carriers", build: sampleConsanguineous },
  { id: "showcase", title: "Symbol showcase", blurb: "Adoption, twins, losses, multiple partners", build: sampleShowcase },
];
