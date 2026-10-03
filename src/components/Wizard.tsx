import { useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { useStore } from "../store/store";
import { buildQuickStart, QUICK_DEFAULT, type QuickStart } from "../model/samples";
import { MiniChart } from "./Library";
import { Seg, Toggle } from "./Fields";
import { SexIcon } from "./Icons";

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <span>{label}</span>
      <div className="stepper-ctl">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0} aria-label={`Fewer ${label}`}>
          <Minus size={13} />
        </button>
        <output>{value}</output>
        <button type="button" onClick={() => onChange(Math.min(12, value + 1))} aria-label={`More ${label}`}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

export function Wizard() {
  const setOverlay = useStore((s) => s.setOverlay);
  const openDoc = useStore((s) => s.openDoc);
  const current = useStore((s) => s.doc);
  const [q, setQ] = useState<QuickStart>(QUICK_DEFAULT);
  const set = <K extends keyof QuickStart>(k: K, v: QuickStart[K]) => setQ((x) => ({ ...x, [k]: v }));
  const preview = useMemo(() => buildQuickStart(q), [q]);
  const count = Object.keys(preview.people).length;
  const empty = Object.keys(current.people).length === 0;

  const create = () => {
    const doc = buildQuickStart(q, empty ? current.title !== "Untitled pedigree" ? current.title : undefined : undefined);
    if (empty) {
      doc.id = current.id;
      doc.created = current.created;
    }
    openDoc(doc);
    setOverlay(null);
  };

  return (
    <div className="sheet-scrim" onPointerDown={() => setOverlay(null)}>
      <div className="sheet" role="dialog" aria-label="Quick start" onPointerDown={(e) => e.stopPropagation()}>
        <div className="sheet-form">
          <header className="sheet-head">
            <div>
              <p className="eyebrow">Quick start</p>
              <h2>Sketch the immediate family</h2>
            </div>
            <button className="icon-btn" onClick={() => setOverlay(null)} title="Close">
              <X size={17} />
            </button>
          </header>

          <div className="wiz-person">
            <input value={q.name} placeholder="Proband’s name (optional)" onChange={(e) => set("name", e.target.value)} autoFocus />
            <input className="age-in" value={q.age} placeholder="Age" onChange={(e) => set("age", e.target.value)} />
          </div>
          <Seg
            value={q.sex}
            onChange={(v) => set("sex", v)}
            options={[
              { value: "female", label: <><SexIcon sex="female" /> Female</> },
              { value: "male", label: <><SexIcon sex="male" /> Male</> },
              { value: "unknown", label: <><SexIcon sex="unknown" /> Unknown</> },
            ]}
          />

          <div className="wiz-cols">
            <fieldset>
              <legend>Siblings & children</legend>
              <Stepper label="Brothers" value={q.brothers} onChange={(v) => set("brothers", v)} />
              <Stepper label="Sisters" value={q.sisters} onChange={(v) => set("sisters", v)} />
              <Stepper label="Sons" value={q.sons} onChange={(v) => set("sons", v)} />
              <Stepper label="Daughters" value={q.daughters} onChange={(v) => set("daughters", v)} />
            </fieldset>
            <fieldset>
              <legend>Father’s side</legend>
              <Stepper label="Uncles" value={q.paternalUncles} onChange={(v) => set("paternalUncles", v)} />
              <Stepper label="Aunts" value={q.paternalAunts} onChange={(v) => set("paternalAunts", v)} />
              <legend className="legend-2">Mother’s side</legend>
              <Stepper label="Uncles" value={q.maternalUncles} onChange={(v) => set("maternalUncles", v)} />
              <Stepper label="Aunts" value={q.maternalAunts} onChange={(v) => set("maternalAunts", v)} />
            </fieldset>
          </div>
          <div className="wiz-toggles">
            <Toggle checked={q.grandparents} onChange={(v) => set("grandparents", v)} label="Include grandparents" />
            <Toggle checked={q.partner || q.sons + q.daughters > 0} onChange={(v) => set("partner", v)} label="Include a partner" />
          </div>

          <footer className="sheet-foot">
            <span className="muted-line">{count} people · you can edit everything afterwards</span>
            <button className="btn btn-primary" onClick={create}>
              {empty ? "Build on this canvas" : "Build in a new canvas"}
            </button>
          </footer>
        </div>
        <div className="sheet-preview" aria-label="Preview">
          <MiniChart doc={preview} prefix="wz-" />
        </div>
      </div>
    </div>
  );
}
