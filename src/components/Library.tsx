import { useMemo, useRef, useState } from "react";
import { CopyPlus, FilePlus2, Trash2, Upload, X } from "lucide-react";
import { useStore } from "../store/store";
import { deleteDoc, listLibrary, loadDoc } from "../store/persistence";
import { blankDoc, uid } from "../model/ops";
import { SAMPLES } from "../model/samples";
import type { PedigreeDoc } from "../model/types";
import { computeLayout } from "../layout/layout";
import { computeGeometry } from "../layout/geometry";
import { Chart, computeFrame } from "../render/Chart";
import { relationMap } from "../model/kinship";
import { probandOf } from "../model/graph";

export function MiniChart({ doc, prefix }: { doc: PedigreeDoc; prefix: string }) {
  const model = useMemo(() => {
    const d = { ...doc, display: { ...doc.display, header: false, legend: false, notes: false, generations: false, ids: false } };
    const layout = computeLayout(d, relationMap(d, probandOf(d)?.id));
    const geoms = computeGeometry(d, layout, layout.pos);
    const frame = computeFrame(d, layout, layout.pos, geoms);
    return { d, layout, geoms, frame };
  }, [doc]);
  const { d, layout, geoms, frame } = model;
  const b = frame.total;
  const pad = 30;
  if (!layout.pos.size) return <div className="mini-empty">Empty</div>;
  return (
    <svg viewBox={`${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <Chart doc={d} layout={layout} pos={layout.pos} geoms={geoms} frame={frame} mode="export" prefix={prefix} />
    </svg>
  );
}

function when(t: number): string {
  const d = new Date(t);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export function Library() {
  const tick = useStore((s) => s.libraryTick);
  const current = useStore((s) => s.doc);
  const openDoc = useStore((s) => s.openDoc);
  const setOverlay = useStore((s) => s.setOverlay);
  const toast = useStore((s) => s.toast);
  const bump = useStore((s) => s.bumpLibrary);
  const [confirm, setConfirm] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const entries = useMemo(() => listLibrary(), [tick]);
  const docs = useMemo(() => {
    const m = new Map<string, PedigreeDoc>();
    for (const e of entries) {
      const d = e.id === current.id ? current : loadDoc(e.id);
      if (d) m.set(e.id, d);
    }
    return m;
  }, [entries, current]);

  const open = (d: PedigreeDoc) => {
    openDoc(d);
    setOverlay(null);
  };

  return (
    <div className="drawer-scrim" onPointerDown={() => setOverlay(null)}>
      <aside className="drawer" onPointerDown={(e) => e.stopPropagation()} aria-label="Canvases">
        <header className="drawer-head">
          <div>
            <p className="eyebrow">Saved in this browser</p>
            <h2>Canvases</h2>
          </div>
          <button className="icon-btn" onClick={() => setOverlay(null)} title="Close">
            <X size={17} />
          </button>
        </header>
        <div className="drawer-actions">
          <button className="btn btn-primary" onClick={() => open(blankDoc())}>
            <FilePlus2 size={16} /> New canvas
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Open file
          </button>
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
                open(await (await import("../export/export")).readPedigreeFile(f));
              } catch (err) {
                toast(err instanceof Error ? err.message : "Couldn't open that file", { tone: "error" });
              }
            }}
          />
        </div>
        <ul className="lib-list">
          {entries.map((e) => {
            const d = docs.get(e.id);
            const isCurrent = e.id === current.id;
            return (
              <li key={e.id} className={`lib-item${isCurrent ? " is-current" : ""}`}>
                <button className="lib-open" onClick={() => d && (isCurrent ? setOverlay(null) : open(d))}>
                  <div className="lib-thumb">{d && <MiniChart doc={d} prefix={`lb${e.id.slice(-5)}-`} />}</div>
                  <div className="lib-meta">
                    <strong>{e.title || "Untitled pedigree"}</strong>
                    <span>
                      {e.people} {e.people === 1 ? "person" : "people"} · {when(e.updated)}
                      {isCurrent && <em> · open</em>}
                    </span>
                  </div>
                </button>
                <div className="lib-tools">
                  <button
                    className="icon-btn icon-btn-sm"
                    title="Duplicate"
                    onClick={() => {
                      if (!d) return;
                      const copy: PedigreeDoc = { ...structuredClone(d), id: uid("d"), title: `${d.title} (copy)`, created: Date.now(), updated: Date.now() };
                      open(copy);
                    }}
                  >
                    <CopyPlus size={14} />
                  </button>
                  {confirm === e.id ? (
                    <button
                      className="btn btn-danger btn-xs"
                      onClick={() => {
                        deleteDoc(e.id);
                        setConfirm(null);
                        if (isCurrent) {
                          const next = listLibrary()[0];
                          const nd = next ? loadDoc(next.id) : null;
                          openDoc(nd ?? blankDoc());
                        }
                        bump();
                      }}
                    >
                      Delete?
                    </button>
                  ) : (
                    <button className="icon-btn icon-btn-sm" title="Delete" onClick={() => setConfirm(e.id)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="drawer-foot">
          <p className="eyebrow">Examples</p>
          <div className="sample-grid">
            {SAMPLES.map((s) => (
              <button key={s.id} className="sample" onClick={() => open(s.build())}>
                <strong>{s.title}</strong>
                <span>{s.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
