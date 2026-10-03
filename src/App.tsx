import { useEffect } from "react";
import { useStore } from "./store/store";
import { saveDoc } from "./store/persistence";
import * as A from "./store/actions";
import { liveLayout } from "./layout/layout";
import { TopBar } from "./components/TopBar";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { Library } from "./components/Library";
import { Wizard } from "./components/Wizard";
import { Shortcuts, Toasts } from "./components/Overlays";

function useAutosave() {
  const doc = useStore((s) => s.doc);
  const markSaved = useStore((s) => s.markSaved);
  useEffect(() => {
    const t = setTimeout(() => markSaved(saveDoc(doc)), 350);
    return () => clearTimeout(t);
  }, [doc, markSaved]);
}

function navigate(id: string, key: string): string | null {
  const layout = liveLayout.current;
  const doc = useStore.getState().doc;
  if (!layout) return null;
  const p = doc.people[id];
  if (key === "ArrowUp") {
    if (!p.parentUnion || !doc.unions[p.parentUnion]) return null;
    const [a, b] = doc.unions[p.parentUnion].partners;
    return doc.people[b]?.sex === "male" && doc.people[a]?.sex !== "male" ? b : a;
  }
  if (key === "ArrowDown") {
    const kids = (layout.graph.unionsOf.get(id) ?? []).flatMap((u) => layout.graph.childrenOf.get(u) ?? []);
    kids.sort((x, y) => (layout.pos.get(x)?.x ?? 0) - (layout.pos.get(y)?.x ?? 0));
    return kids[0] ?? null;
  }
  const g = layout.gen.get(id);
  if (g === undefined) return null;
  const row = [...(layout.rows[g] ?? [])].sort((x, y) => (layout.pos.get(x)?.x ?? 0) - (layout.pos.get(y)?.x ?? 0));
  const i = row.indexOf(id);
  return row[i + (key === "ArrowLeft" ? -1 : 1)] ?? null;
}

function useGlobalKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        if (typing) return;
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        if (typing) return;
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        s.markSaved(saveDoc(s.doc));
        s.toast("Saved to this browser");
        return;
      }
      if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        import("./export/export").then((m) => m.downloadPng(s.doc, 2)).then(() => s.toast("PNG downloaded"));
        return;
      }
      if (e.key === "Escape") {
        if (typing) {
          (e.target as HTMLElement).blur();
          return;
        }
        if (s.pick) s.setPick(null);
        else if (s.overlay) s.setOverlay(null);
        else s.select(null);
        return;
      }
      if (typing || mod || e.altKey) return;
      if (s.overlay && s.overlay !== "library") return;
      if (e.key === "?") {
        s.setOverlay("shortcuts");
        return;
      }
      const sel = s.selection;
      if (sel?.kind === "person" && s.doc.people[sel.id]) {
        const id = sel.id;
        const k = e.key;
        if (k === "Delete" || k === "Backspace") {
          e.preventDefault();
          A.deletePerson(id);
        } else if (k === "p" || k === "P") window.dispatchEvent(new CustomEvent("pedigree:menu", { detail: "partner" }));
        else if (k === "c" || k === "C") window.dispatchEvent(new CustomEvent("pedigree:menu", { detail: "child" }));
        else if (k === "s" || k === "S") window.dispatchEvent(new CustomEvent("pedigree:menu", { detail: "sibling" }));
        else if (k === "u" || k === "U") A.addParents(id);
        else if (k === "k" || k === "K") A.addCancer(id);
        else if (k === "g" || k === "G") A.addGene(id);
        else if (k === "[") A.moveSibling(id, -1);
        else if (k === "]") A.moveSibling(id, 1);
        else if (k === "Enter") {
          e.preventDefault();
          s.focusInspector("name");
        } else if (k.startsWith("Arrow")) {
          e.preventDefault();
          const next = navigate(id, k);
          if (next) s.select({ kind: "person", id: next });
        }
        return;
      }
      if (sel?.kind === "union") {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          A.deleteUnion(sel.id);
        }
        return;
      }
      if (e.key === "m" || e.key === "M") A.addPerson("male");
      else if (e.key === "f" && Object.keys(s.doc.people).length === 0) A.addPerson("female");
      else if (e.key === "F" && e.shiftKey) A.addPerson("female");
      else if (e.key === "u" || e.key === "U") A.addPerson("unknown");
      else if (e.key.startsWith("Arrow")) {
        const first = liveLayout.current?.rows.find((r) => r.length)?.[0];
        if (first) s.select({ kind: "person", id: first });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function App() {
  useAutosave();
  useGlobalKeys();
  const overlay = useStore((s) => s.overlay);
  return (
    <div className="app">
      <TopBar />
      <main className="workspace">
        <Canvas />
        <Inspector />
      </main>
      {overlay === "library" && <Library />}
      {overlay === "wizard" && <Wizard />}
      {overlay === "shortcuts" && <Shortcuts />}
      <Toasts />
    </div>
  );
}
