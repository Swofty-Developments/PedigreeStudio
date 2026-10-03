import { useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronDown, CircleAlert, ClipboardCopy, Download, FileJson, FolderOpen, Keyboard, Printer, Redo2, Sparkles, Undo2, Upload, UserPlus, Image as ImageIcon } from "lucide-react";
import { useStore } from "../store/store";
import { addPerson } from "../store/actions";
const exporter = () => import("../export/export");
import { Logo, SexIcon } from "./Icons";

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function ago(t: number): string {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TopBar() {
  const doc = useStore((s) => s.doc);
  const commit = useStore((s) => s.commit);
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const savedAt = useStore((s) => s.savedAt);
  const saveError = useStore((s) => s.saveError);
  const setOverlay = useStore((s) => s.setOverlay);
  const overlay = useStore((s) => s.overlay);
  const toast = useStore((s) => s.toast);
  const openDoc = useStore((s) => s.openDoc);
  const [menu, setMenu] = useState<null | "add" | "export">(null);
  const close = () => setMenu(null);
  const addRef = useOutside(menu === "add", close);
  const expRef = useOutside(menu === "export", close);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const run = async (label: string, fn: () => Promise<void> | void) => {
    close();
    try {
      await fn();
      toast(label);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", { tone: "error" });
    }
  };

  const empty = Object.keys(doc.people).length === 0;

  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <span className="brand-name">Pedigree Studio</span>
      </div>
      <span className="topbar-rule" />
      <div className="doc-title">
        <input value={doc.title} onChange={(e) => commit((d) => void (d.title = e.target.value), "title")} aria-label="Chart title" spellCheck={false} />
        <span className={`save-state${saveError ? " is-error" : ""}`} title={saveError ? "Browser storage is full or blocked" : `Saved ${new Date(savedAt).toLocaleString()}`}>
          {saveError ? <CircleAlert size={13} /> : <Check size={13} />}
          {saveError ? "Not saved" : `Saved ${ago(savedAt)}`}
        </span>
      </div>

      <div className="topbar-actions">
        <div className="btn-group">
          <button className="icon-btn" onClick={undo} disabled={!past} title="Undo (Ctrl+Z)">
            <Undo2 size={17} />
          </button>
          <button className="icon-btn" onClick={redo} disabled={!future} title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={17} />
          </button>
        </div>

        <div className="pop-wrap" ref={addRef}>
          <button className={`btn${menu === "add" ? " is-active" : ""}`} onClick={() => setMenu(menu === "add" ? null : "add")}>
            <UserPlus size={16} /> Add person <ChevronDown size={14} className="chev" />
          </button>
          {menu === "add" && (
            <div className="menu menu-right" role="menu">
              <div className="menu-head">Unconnected, link them up later</div>
              {(["male", "female", "unknown"] as const).map((s) => (
                <button key={s} className="menu-item" onClick={() => (addPerson(s), close())}>
                  <span className="menu-icon">
                    <SexIcon sex={s} />
                  </span>
                  <span className="menu-label">{s === "male" ? "Male" : s === "female" ? "Female" : "Sex unknown"}</span>
                  <kbd>{s === "male" ? "M" : s === "female" ? "F" : "U"}</kbd>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-ghost" onClick={() => setOverlay(overlay === "wizard" ? null : "wizard")}>
          <Sparkles size={16} /> Quick start
        </button>
        <button className={`btn btn-ghost${overlay === "library" ? " is-active" : ""}`} onClick={() => setOverlay(overlay === "library" ? null : "library")}>
          <FolderOpen size={16} /> Canvases
        </button>

        <div className="pop-wrap" ref={expRef}>
          <button className={`btn btn-primary${menu === "export" ? " is-active" : ""}`} onClick={() => setMenu(menu === "export" ? null : "export")} disabled={empty && menu !== "export"}>
            <Download size={16} /> Export <ChevronDown size={14} className="chev" />
          </button>
          {menu === "export" && (
            <div className="menu menu-right menu-wide" role="menu">
              <div className="menu-head">Image</div>
              <button className="menu-item" onClick={() => run("PNG downloaded", async () => (await exporter()).downloadPng(doc, 2))}>
                <span className="menu-icon"><Camera size={15} /></span>
                <span className="menu-label">Screenshot · PNG</span>
                <em>2×</em>
              </button>
              <button className="menu-item" onClick={() => run("High-res PNG downloaded", async () => (await exporter()).downloadPng(doc, 4))}>
                <span className="menu-icon"><ImageIcon size={15} /></span>
                <span className="menu-label">High resolution PNG</span>
                <em>4×</em>
              </button>
              <button className="menu-item" onClick={() => run("Transparent PNG downloaded", async () => (await exporter()).downloadPng(doc, 3, false))}>
                <span className="menu-icon"><ImageIcon size={15} /></span>
                <span className="menu-label">Transparent PNG</span>
                <em>3×</em>
              </button>
              <button className="menu-item" onClick={() => run("Image copied to clipboard", async () => (await exporter()).copyPng(doc))}>
                <span className="menu-icon"><ClipboardCopy size={15} /></span>
                <span className="menu-label">Copy image</span>
              </button>
              <div className="menu-sep" />
              <div className="menu-head">Vector & print</div>
              <button className="menu-item" onClick={() => run("SVG downloaded", async () => (await exporter()).downloadSvg(doc))}>
                <span className="menu-icon"><Download size={15} /></span>
                <span className="menu-label">SVG vector</span>
              </button>
              <button className="menu-item" onClick={() => run("Print dialog opened", async () => (await exporter()).printDoc(doc))}>
                <span className="menu-icon"><Printer size={15} /></span>
                <span className="menu-label">Print or save as PDF</span>
              </button>
              <div className="menu-sep" />
              <div className="menu-head">Chart file</div>
              <button className="menu-item" onClick={() => run("Chart file downloaded", async () => (await exporter()).downloadJson(doc))}>
                <span className="menu-icon"><FileJson size={15} /></span>
                <span className="menu-label">Save chart file (.json)</span>
              </button>
              <button className="menu-item" onClick={() => (close(), fileRef.current?.click())}>
                <span className="menu-icon"><Upload size={15} /></span>
                <span className="menu-label">Open chart file…</span>
              </button>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              openDoc(await (await exporter()).readPedigreeFile(f));
              toast(`Opened ${f.name}`);
            } catch (err) {
              toast(err instanceof Error ? err.message : "Couldn't open that file", { tone: "error" });
            }
          }}
        />
        <button className="icon-btn" onClick={() => setOverlay(overlay === "shortcuts" ? null : "shortcuts")} title="Keyboard shortcuts (?)">
          <Keyboard size={17} />
        </button>
      </div>
    </header>
  );
}
