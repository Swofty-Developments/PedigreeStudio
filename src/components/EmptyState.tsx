import { Sparkles } from "lucide-react";
import { useStore } from "../store/store";
import { addPerson } from "../store/actions";
import { SAMPLES } from "../model/samples";
import { SexIcon } from "./Icons";

export function EmptyState() {
  const setOverlay = useStore((s) => s.setOverlay);
  const openDoc = useStore((s) => s.openDoc);
  return (
    <div className="empty" onPointerDown={(e) => e.stopPropagation()}>
      <p className="empty-kicker">Empty canvas</p>
      <h1 className="empty-title">Start with anyone in the family</h1>
      <p className="empty-copy">
        Drop a person on the grid, then grow the chart from them: partners, children, siblings, parents and twins. The layout arranges itself.
      </p>
      <div className="empty-add">
        <button className="add-tile" onClick={() => addPerson("male")}>
          <SexIcon sex="male" size={30} />
          <span>Male</span>
          <kbd>M</kbd>
        </button>
        <button className="add-tile" onClick={() => addPerson("female")}>
          <SexIcon sex="female" size={30} />
          <span>Female</span>
          <kbd>F</kbd>
        </button>
        <button className="add-tile" onClick={() => addPerson("unknown")}>
          <SexIcon sex="unknown" size={30} />
          <span>Unknown</span>
          <kbd>U</kbd>
        </button>
      </div>
      <div className="empty-alt">
        <button className="btn btn-ghost" onClick={() => setOverlay("wizard")}>
          <Sparkles size={15} /> Quick-start a whole family
        </button>
        <span className="empty-or">or open an example</span>
        <div className="empty-samples">
          {SAMPLES.map((s) => (
            <button key={s.id} className="chip" onClick={() => openDoc(s.build())} title={s.blurb}>
              {s.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
