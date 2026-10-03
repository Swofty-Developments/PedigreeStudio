import { X } from "lucide-react";
import { useStore } from "../store/store";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismiss);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.tone === "error" ? " is-error" : ""}`}>
          <span>{t.text}</span>
          {t.action && (
            <button
              className="toast-action"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="toast-x" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: "Building",
    keys: [
      ["M · Shift F · U", "Add an unconnected male, female or unknown person (plain F on an empty canvas)"],
      ["P", "Partner menu for the selected person"],
      ["C", "Child menu, then M / F / U, I identical twins, T fraternal twins"],
      ["S", "Sibling menu"],
      ["U", "Add parents to the selected person"],
      ["K · G", "Add a cancer diagnosis or a gene result"],
      ["[ · ]", "Move older or younger among siblings"],
      ["Del", "Delete the selection"],
    ],
  },
  {
    title: "Moving around",
    keys: [
      ["← → ↑ ↓", "Walk to neighbours, parents and children"],
      ["Enter", "Rename the selected person"],
      ["Esc", "Deselect, close menus or cancel linking"],
      ["Drag · Space+drag", "Pan the canvas"],
      ["Scroll · Ctrl+scroll", "Zoom"],
      ["+ · − · F", "Zoom in, out, fit to screen"],
    ],
  },
  {
    title: "Chart",
    keys: [
      ["Ctrl Z", "Undo"],
      ["Ctrl Shift Z", "Redo"],
      ["Ctrl S", "Save now (saves automatically too)"],
      ["Ctrl E", "Download a PNG screenshot"],
      ["?", "This list"],
    ],
  },
];

export function Shortcuts() {
  const setOverlay = useStore((s) => s.setOverlay);
  return (
    <div className="sheet-scrim" onPointerDown={() => setOverlay(null)}>
      <div className="shortcuts" role="dialog" aria-label="Keyboard shortcuts" onPointerDown={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <p className="eyebrow">Keyboard</p>
            <h2>Shortcuts</h2>
          </div>
          <button className="icon-btn" onClick={() => setOverlay(null)} title="Close">
            <X size={17} />
          </button>
        </header>
        <div className="shortcut-cols">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3>{g.title}</h3>
              <dl>
                {g.keys.map(([k, v]) => (
                  <div key={k}>
                    <dt>
                      {k.split(" · ").map((part, i) => (
                        <kbd key={i}>{part}</kbd>
                      ))}
                    </dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
