import { create } from "zustand";
import { produce, type Draft } from "immer";
import type { PedigreeDoc, Selection } from "../model/types";
import { blankDoc } from "../model/ops";
import { currentDocId, loadDoc, saveDoc } from "./persistence";

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "error";
  action?: { label: string; run: () => void };
}

export type PickMode = { mode: "partner" | "parents"; source: string } | null;
export type Overlay = null | "library" | "wizard" | "shortcuts";

interface StoreState {
  doc: PedigreeDoc;
  past: PedigreeDoc[];
  future: PedigreeDoc[];
  lastKey: string | null;
  lastAt: number;
  selection: Selection;
  pick: PickMode;
  toasts: Toast[];
  savedAt: number;
  saveError: boolean;
  libraryTick: number;
  fitTick: number;
  inspectorFocus: { section: string; tick: number } | null;
  overlay: Overlay;
  setOverlay: (o: Overlay) => void;
  commit: <T>(recipe: (d: Draft<PedigreeDoc>) => T, key?: string) => T;
  undo: () => void;
  redo: () => void;
  select: (s: Selection) => void;
  openDoc: (doc: PedigreeDoc) => void;
  setPick: (p: PickMode) => void;
  toast: (text: string, opts?: { tone?: "info" | "error"; action?: Toast["action"] }) => void;
  dismiss: (id: number) => void;
  markSaved: (ok: boolean) => void;
  bumpLibrary: () => void;
  requestFit: () => void;
  focusInspector: (section: string) => void;
}

function initialDoc(): PedigreeDoc {
  const id = currentDocId();
  const loaded = id ? loadDoc(id) : null;
  if (loaded) return loaded;
  const d = blankDoc();
  saveDoc(d);
  return d;
}

let toastSeq = 0;

export const useStore = create<StoreState>((set, get) => ({
  doc: initialDoc(),
  past: [],
  future: [],
  lastKey: null,
  lastAt: 0,
  selection: null,
  pick: null,
  toasts: [],
  savedAt: Date.now(),
  saveError: false,
  libraryTick: 0,
  fitTick: 0,
  inspectorFocus: null,
  overlay: null,
  setOverlay: (o) => set({ overlay: o }),

  commit: (recipe, key) => {
    let result: ReturnType<typeof recipe> | undefined;
    const prev = get().doc;
    const next = produce(prev, (d) => {
      result = recipe(d);
    });
    if (next === prev) return result as ReturnType<typeof recipe>;
    const stamped = produce(next, (d) => {
      d.updated = Date.now();
    });
    const now = Date.now();
    const { lastKey, lastAt, past } = get();
    const coalesce = !!key && key === lastKey && now - lastAt < 1500;
    set({
      doc: stamped,
      past: coalesce ? past : [...past.slice(-149), prev],
      future: [],
      lastKey: key ?? null,
      lastAt: now,
    });
    const sel = get().selection;
    if (sel && ((sel.kind === "person" && !stamped.people[sel.id]) || (sel.kind === "union" && !stamped.unions[sel.id]))) {
      set({ selection: null });
    }
    return result as ReturnType<typeof recipe>;
  },

  undo: () => {
    const { past, doc, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future], lastKey: null });
    const sel = get().selection;
    if (sel && ((sel.kind === "person" && !prev.people[sel.id]) || (sel.kind === "union" && !prev.unions[sel.id]))) set({ selection: null });
  },

  redo: () => {
    const { past, doc, future } = get();
    if (!future.length) return;
    const next = future[0];
    set({ doc: next, past: [...past, doc], future: future.slice(1), lastKey: null });
    const sel = get().selection;
    if (sel && ((sel.kind === "person" && !next.people[sel.id]) || (sel.kind === "union" && !next.unions[sel.id]))) set({ selection: null });
  },

  select: (s) => set({ selection: s }),

  openDoc: (doc) => {
    saveDoc(doc);
    set({ doc, past: [], future: [], selection: null, pick: null, lastKey: null, savedAt: Date.now(), fitTick: get().fitTick + 1, libraryTick: get().libraryTick + 1 });
  },

  setPick: (p) => set({ pick: p }),

  toast: (text, opts) => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts.slice(-3), { id, text, tone: opts?.tone ?? "info", action: opts?.action }] });
    setTimeout(() => get().dismiss(id), opts?.action ? 6500 : 3800);
  },

  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  markSaved: (ok) => set({ savedAt: Date.now(), saveError: !ok, libraryTick: get().libraryTick + 1 }),

  bumpLibrary: () => set({ libraryTick: get().libraryTick + 1 }),

  requestFit: () => set({ fitTick: get().fitTick + 1 }),

  focusInspector: (section) => set({ inspectorFocus: { section, tick: Date.now() } }),
}));
