import type { PedigreeDoc, Person, Union } from "../model/types";
import { blankDoc, makePerson } from "../model/ops";

const INDEX = "pedigree-studio:index";
const DOC = (id: string) => `pedigree-studio:doc:${id}`;
const CURRENT = "pedigree-studio:current";

export interface LibraryEntry {
  id: string;
  title: string;
  updated: number;
  created: number;
  people: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function listLibrary(): LibraryEntry[] {
  return read<LibraryEntry[]>(INDEX, []).sort((a, b) => b.updated - a.updated);
}

export function loadDoc(id: string): PedigreeDoc | null {
  const d = read<PedigreeDoc | null>(DOC(id), null);
  return d ? normalizeDoc(d) : null;
}

export function saveDoc(doc: PedigreeDoc): boolean {
  const ok = write(DOC(doc.id), doc);
  if (!ok) return false;
  const index = read<LibraryEntry[]>(INDEX, []).filter((e) => e.id !== doc.id);
  index.push({ id: doc.id, title: doc.title, updated: doc.updated, created: doc.created, people: Object.keys(doc.people).length });
  write(INDEX, index);
  write(CURRENT, doc.id);
  return true;
}

export function deleteDoc(id: string): void {
  try {
    localStorage.removeItem(DOC(id));
  } catch {
    /* storage unavailable */
  }
  write(
    INDEX,
    read<LibraryEntry[]>(INDEX, []).filter((e) => e.id !== id),
  );
}

export function currentDocId(): string | null {
  return read<string | null>(CURRENT, null);
}

export function setCurrentDocId(id: string): void {
  write(CURRENT, id);
}

export function normalizeDoc(raw: Partial<PedigreeDoc>): PedigreeDoc {
  const base = blankDoc(raw.title ?? "Untitled pedigree");
  const doc: PedigreeDoc = {
    ...base,
    ...raw,
    meta: { ...base.meta, ...(raw.meta ?? {}) },
    display: { ...base.display, ...(raw.display ?? {}) },
    people: { ...(raw.people ?? {}) },
    unions: { ...(raw.unions ?? {}) },
    twins: { ...(raw.twins ?? {}) },
    traits: { ...(raw.traits ?? {}) },
  } as PedigreeDoc;
  for (const [id, p] of Object.entries(doc.people)) {
    doc.people[id] = { ...makePerson("unknown"), ...(p as Partial<Person>), id };
  }
  for (const [id, u] of Object.entries(doc.unions)) {
    const partial = u as Partial<Union>;
    doc.unions[id] = { status: "partnered", consanguinity: "auto", noChildren: "none", noChildrenNote: "", note: "", order: 0, partners: partial.partners ?? ["", ""], ...partial, id };
    if (!doc.people[doc.unions[id].partners[0]] || !doc.people[doc.unions[id].partners[1]]) delete doc.unions[id];
  }
  for (const p of Object.values(doc.people)) {
    if (p.parentUnion && !doc.unions[p.parentUnion]) p.parentUnion = null;
    if (p.twin && !doc.twins[p.twin]) p.twin = null;
  }
  return doc;
}

export function isPedigreeJson(v: unknown): v is Partial<PedigreeDoc> {
  return !!v && typeof v === "object" && "people" in (v as object) && "unions" in (v as object);
}
