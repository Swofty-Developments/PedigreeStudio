import type { Outcome, Sex, TwinKind } from "../model/types";
import * as ops from "../model/ops";
import { useStore } from "./store";

const S = () => useStore.getState();

const sexWord = (s: Sex, m: string, f: string, u: string) => (s === "male" ? m : s === "female" ? f : u);

function undoToast(text: string) {
  S().toast(text, { action: { label: "Undo", run: () => S().undo() } });
}

export function addPerson(sex: Sex): string {
  const id = S().commit((d) => ops.addPerson(d, sex));
  S().select({ kind: "person", id });
  return id;
}

export function addPartner(id: string, sex?: Sex): string {
  const r = S().commit((d) => ops.addPartner(d, id, sex));
  return r.person;
}

export function addChild(id: string, sex: Sex, outcome: Outcome = "born", unionId?: string): string {
  return S().commit((d) => {
    const u = ops.ensureUnionFor(d, id, unionId);
    return ops.addChild(d, u, sex, outcome);
  });
}

export function addChildToUnion(unionId: string, sex: Sex, outcome: Outcome = "born"): string {
  return S().commit((d) => ops.addChild(d, unionId, sex, outcome));
}

export function addTwinChildren(id: string, kind: TwinKind, sex: Sex, unionId?: string): void {
  S().commit((d) => {
    const u = ops.ensureUnionFor(d, id, unionId);
    const first = ops.addChild(d, u, sex);
    ops.addTwin(d, first, kind, sex);
  });
}

export function addParents(id: string): void {
  const r = S().commit((d) => ops.addParents(d, id));
  if (!r) S().toast("They already have parents.", { tone: "error" });
}

export function addSibling(id: string, sex: Sex, outcome: Outcome = "born"): string {
  return S().commit((d) => ops.addSibling(d, id, sex, outcome));
}

export function addTwin(id: string, kind: TwinKind, sex?: Sex): string {
  return S().commit((d) => ops.addTwin(d, id, kind, sex));
}

export function deletePerson(id: string): void {
  const doc = S().doc;
  const person = doc.people[id];
  if (!person) return;
  const plan = ops.deletionPlan(doc, id);
  if (plan.blocked) {
    S().toast(plan.blocked, { tone: "error" });
    return;
  }
  S().commit((d) => ops.removePeople(d, plan.remove));
  const extra = plan.remove.size - 1;
  const who = person.name || sexWord(person.sex, "Male", "Female", "Person");
  undoToast(extra > 0 ? `Deleted ${who} and ${extra} ${extra === 1 ? "other" : "others"}` : `Deleted ${who}`);
}

export function removeParents(id: string): void {
  const why = ops.removeParentsPlan(S().doc, id);
  if (why) {
    S().toast(why, { tone: "error" });
    return;
  }
  S().commit((d) => ops.removeParents(d, id));
  undoToast("Removed parents");
}

export function deleteUnion(unionId: string): void {
  const why = ops.removeUnionPlan(S().doc, unionId);
  if (why) {
    S().toast(why, { tone: "error" });
    return;
  }
  S().commit((d) => ops.removeUnion(d, unionId));
  S().select(null);
  undoToast("Removed relationship");
}

export function startPick(mode: "partner" | "parents", source: string): void {
  S().setPick({ mode, source });
}

export function completePick(target: { person?: string; union?: string }): void {
  const pick = S().pick;
  if (!pick) return;
  const doc = S().doc;
  if (pick.mode === "partner") {
    if (!target.person) return;
    const why = ops.canLinkPartners(doc, pick.source, target.person);
    if (why) {
      S().toast(why, { tone: "error" });
      return;
    }
    S().commit((d) => ops.linkPartners(d, pick.source, target.person!));
    S().setPick(null);
    S().toast("Linked as partners");
  } else {
    const parent = target.person ?? (target.union ? doc.unions[target.union]?.partners[0] : undefined);
    if (!parent) return;
    let why = ops.canLinkParents(doc, pick.source, parent);
    if (!why && target.union) {
      const other = doc.unions[target.union].partners[1];
      why = ops.canLinkParents(doc, pick.source, other);
    }
    if (why) {
      S().toast(why, { tone: "error" });
      return;
    }
    S().commit((d) => ops.linkParents(d, pick.source, target));
    S().setPick(null);
    S().toast("Linked to parents");
  }
}

export function moveSibling(id: string, dir: -1 | 1): void {
  const moved = S().commit((d) => ops.moveSibling(d, id, dir));
  if (!moved) S().toast(dir < 0 ? "Already the eldest" : "Already the youngest");
}

export function toggleProband(id: string): void {
  const on = !S().doc.people[id].proband;
  S().commit((d) => ops.setProband(d, id, on));
}

export function addCancer(id: string): void {
  S().commit((d) => {
    d.people[id].cancers.push({ id: ops.uid("c"), type: "breast", age: "" });
  });
  S().select({ kind: "person", id });
  S().focusInspector("cancer");
}

export function addGene(id: string): void {
  S().commit((d) => {
    d.people[id].genes.push({ id: ops.uid("g"), gene: "", variant: "", result: "pathogenic" });
  });
  S().select({ kind: "person", id });
  S().focusInspector("genes");
}
