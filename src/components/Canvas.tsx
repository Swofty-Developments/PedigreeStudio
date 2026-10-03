import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, X } from "lucide-react";
import { useStore } from "../store/store";
import { computeLayout, liveLayout, type Pt } from "../layout/layout";
import { computeGeometry, symbolTop } from "../layout/geometry";
import { Chart, computeFrame } from "../render/Chart";
import { clearMeasureCache, HALF } from "../render/labels";
import { relationMap } from "../model/kinship";
import { probandOf } from "../model/graph";
import { completePick } from "../store/actions";
import { NodeToolbar, UnionToolbar } from "./NodeToolbar";
import { EmptyState } from "./EmptyState";
import { useTweenedPositions } from "./useTween";

export interface View {
  x: number;
  y: number;
  k: number;
}

const MIN_K = 0.12;
const MAX_K = 3.2;

export function useChartModel() {
  const doc = useStore((s) => s.doc);
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    document.fonts?.ready.then(() => {
      clearMeasureCache();
      setFontsReady(true);
    });
  }, []);
  const proband = probandOf(doc)?.id;
  const relations = useMemo(() => relationMap(doc, proband), [doc.people, doc.unions, proband]);
  const layout = useMemo(() => computeLayout(doc, relations), [doc, relations, fontsReady]);
  return { doc, layout, relations, fontsReady };
}

export function Canvas() {
  const { doc, layout } = useChartModel();
  liveLayout.current = layout;
  const selection = useStore((s) => s.selection);
  const pick = useStore((s) => s.pick);
  const fitTick = useStore((s) => s.fitTick);
  const select = useStore((s) => s.select);
  const setPick = useStore((s) => s.setPick);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [hover, setHover] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const space = useRef(false);

  const prevIds = useRef<Set<string>>(new Set(Object.keys(doc.people)));
  const [entering, setEntering] = useState<Set<string>>(new Set());
  useLayoutEffect(() => {
    const now = new Set(Object.keys(doc.people));
    const fresh = new Set<string>();
    for (const id of now) if (!prevIds.current.has(id)) fresh.add(id);
    prevIds.current = now;
    if (fresh.size) {
      setEntering(fresh);
      const t = setTimeout(() => setEntering(new Set()), 700);
      return () => clearTimeout(t);
    }
  }, [doc.people]);

  const originOf = useCallback(
    (id: string, shown: Map<string, Pt>): Pt | null => {
      const p = doc.people[id];
      if (!p) return null;
      if (p.parentUnion && doc.unions[p.parentUnion]) {
        const [a, b] = doc.unions[p.parentUnion].partners;
        const pa = shown.get(a);
        const pb = shown.get(b);
        if (pa && pb) return { x: (pa.x + pb.x) / 2, y: pa.y };
        const sib = Object.values(doc.people).find((s) => s.parentUnion === p.parentUnion && s.id !== id && shown.has(s.id));
        if (sib) return shown.get(sib.id)!;
        if (pa || pb) return (pa ?? pb)!;
      }
      for (const u of Object.values(doc.unions)) {
        if (!u.partners.includes(id)) continue;
        const other = u.partners[0] === id ? u.partners[1] : u.partners[0];
        if (shown.has(other)) return shown.get(other)!;
      }
      const kid = Object.values(doc.people).find((k) => k.parentUnion && doc.unions[k.parentUnion]?.partners.includes(id) && shown.has(k.id));
      if (kid) {
        const kp = shown.get(kid.id)!;
        return { x: kp.x, y: kp.y - 60 };
      }
      return null;
    },
    [doc.people, doc.unions],
  );

  const pos = useTweenedPositions(layout.pos, originOf);
  const geoms = useMemo(() => computeGeometry(doc, layout, pos), [doc, layout, pos]);
  const targetGeoms = useMemo(() => computeGeometry(doc, layout, layout.pos), [doc, layout]);
  const frame = useMemo(() => computeFrame(doc, layout, layout.pos, targetGeoms), [doc, layout, targetGeoms]);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const animRef = useRef(0);
  const animateTo = useCallback((target: View, ms = 480) => {
    cancelAnimationFrame(animRef.current);
    const from = viewRef.current;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 4);
      setView({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k: from.k + (target.k - from.k) * e });
      if (k < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  const fitView = useCallback(
    (animate: boolean) => {
      const el = wrapRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const b = frameRef.current.total;
      const bw = Math.max(1, b.maxX - b.minX);
      const bh = Math.max(1, b.maxY - b.minY);
      const pad = 72;
      const k = Math.max(MIN_K, Math.min(1.15, (w - pad * 2) / bw, (h - pad * 2 - 40) / bh));
      const target = { k, x: w / 2 - ((b.minX + b.maxX) / 2) * k, y: (h + 30) / 2 - ((b.minY + b.maxY) / 2) * k };
      if (animate) animateTo(target);
      else setView(target);
    },
    [animateTo],
  );

  const fitted = useRef(false);
  useLayoutEffect(() => {
    if (!fitted.current && layout.pos.size) {
      fitted.current = true;
      fitView(false);
    }
  }, [layout, fitView]);

  const lastFit = useRef(fitTick);
  useEffect(() => {
    if (lastFit.current === fitTick) return;
    lastFit.current = fitTick;
    requestAnimationFrame(() => fitView(true));
  }, [fitTick, fitView]);

  const prevCount = useRef(layout.pos.size);
  useEffect(() => {
    const before = prevCount.current;
    prevCount.current = layout.pos.size;
    if (before === 0 && layout.pos.size > 0) {
      requestAnimationFrame(() => fitView(true));
      return;
    }
    const el = wrapRef.current;
    if (!el || !layout.pos.size) return;
    const v = viewRef.current;
    const b = frameRef.current.core;
    const sx0 = v.x + b.minX * v.k;
    const sx1 = v.x + b.maxX * v.k;
    const sy0 = v.y + b.minY * v.k;
    const sy1 = v.y + b.maxY * v.k;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const margin = 40;
    if (sx0 >= margin && sx1 <= w - margin && sy0 >= 70 && sy1 <= h - margin) return;
    const fits = (b.maxX - b.minX) * v.k < w - 2 * margin && (b.maxY - b.minY) * v.k < h - 110;
    if (!fits) {
      if (selection?.kind === "person") {
        const p = layout.pos.get(selection.id);
        if (p) {
          const px = v.x + p.x * v.k;
          const py = v.y + p.y * v.k;
          if (px < 60 || px > w - 60 || py < 90 || py > h - 60) animateTo({ k: v.k, x: w / 2 - p.x * v.k, y: h / 2 - p.y * v.k });
        }
      }
      return;
    }
    let dx = 0;
    let dy = 0;
    if (sx0 < margin) dx = margin - sx0;
    else if (sx1 > w - margin) dx = w - margin - sx1;
    if (sy0 < 70) dy = 70 - sy0;
    else if (sy1 > h - margin) dy = h - margin - sy1;
    if (dx || dy) animateTo({ k: v.k, x: v.x + dx, y: v.y + dy }, 380);
  }, [layout]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(animRef.current);
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const v = viewRef.current;
      const unit = e.deltaMode === 1 ? 16 : 1;
      const trackpadPan = !e.ctrlKey && (Math.abs(e.deltaX) > 0.5 || e.shiftKey);
      if (trackpadPan) {
        setView({ ...v, x: v.x - e.deltaX * unit - (e.shiftKey ? e.deltaY * unit : 0), y: v.y - (e.shiftKey ? 0 : e.deltaY * unit) });
        return;
      }
      const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.012 : 0.0018));
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const r = k / v.k;
      setView({ k, x: mx - (mx - v.x) * r, y: my - (my - v.y) * r });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        space.current = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") space.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; pid: string | null; uid: string | null; pan: boolean } | null>(null);

  const targetOf = (t: EventTarget | null) => {
    const el = t instanceof Element ? t : null;
    const pid = el?.closest("[data-pid]")?.getAttribute("data-pid") ?? null;
    const uid = pid ? null : (el?.closest("[data-uid]")?.getAttribute("data-uid") ?? null);
    return { pid, uid };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    const { pid, uid } = targetOf(e.target);
    const pan = e.button === 1 || space.current || (!pid && !uid);
    cancelAnimationFrame(animRef.current);
    drag.current = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y, moved: false, pid, uid, pan };
    if (pan) {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      setPanning(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true;
      if (!d.pan) {
        d.pan = true;
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        setPanning(true);
      }
    }
    if (d.pan && d.moved) setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setPanning(false);
    if (!d || d.moved) return;
    if (pick) {
      if (d.pid) completePick({ person: d.pid });
      else if (d.uid && pick.mode === "parents") completePick({ union: d.uid });
      return;
    }
    if (d.pid) select({ kind: "person", id: d.pid });
    else if (d.uid) select({ kind: "union", id: d.uid });
    else select(null);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const { pid } = targetOf(e.target);
    if (pid) {
      select({ kind: "person", id: pid });
      useStore.getState().focusInspector("name");
    }
  };

  const onPointerOver = (e: React.PointerEvent) => {
    if (drag.current?.moved) return;
    const { pid } = targetOf(e.target);
    setHover(pid);
  };

  const lineage = useMemo(() => {
    const focus = hover ?? (selection?.kind === "person" ? selection.id : null);
    if (!focus || !doc.people[focus]) return null;
    const set = new Set<string>();
    const up = [focus];
    const seen = new Set<string>();
    while (up.length) {
      const cur = up.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const pu = doc.people[cur]?.parentUnion;
      if (pu && doc.unions[pu]) {
        set.add(pu);
        up.push(...doc.unions[pu].partners);
      }
    }
    const down = [focus];
    const seenDown = new Set<string>();
    while (down.length) {
      const cur = down.pop()!;
      if (seenDown.has(cur)) continue;
      seenDown.add(cur);
      for (const uidv of layout.graph.unionsOf.get(cur) ?? []) {
        set.add(uidv);
        down.push(...(layout.graph.childrenOf.get(uidv) ?? []));
      }
    }
    return set;
  }, [hover, selection, doc, layout.graph]);

  const pickable = useMemo(() => {
    if (!pick) return null;
    const s = new Set(Object.keys(doc.people));
    s.delete(pick.source);
    return s;
  }, [pick, doc.people]);

  const selPerson = selection?.kind === "person" ? doc.people[selection.id] : null;
  const selPt = selPerson ? pos.get(selPerson.id) : null;
  const selUnion = selection?.kind === "union" ? geoms.find((g) => g.id === selection.id) : null;

  const zoomBy = (f: number) => {
    const v = viewRef.current;
    const k = Math.min(MAX_K, Math.max(MIN_K, v.k * f));
    const cx = size.w / 2;
    const cy = size.h / 2;
    animateTo({ k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) }, 260);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "=" || e.key === "+") zoomBy(1.25);
      else if (e.key === "-" || e.key === "_") zoomBy(0.8);
      else if (e.key === "f" || e.key === "F" || e.key === "0") fitView(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const empty = Object.keys(doc.people).length === 0;
  const grid = 26 * view.k;

  return (
    <div
      ref={wrapRef}
      className={`canvas${panning ? " is-panning" : ""}${pick ? " is-picking" : ""}`}
      style={{
        backgroundSize: `${grid}px ${grid}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <svg
        className="canvas-svg"
        width={size.w}
        height={size.h}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerOver={onPointerOver}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          <Chart
            doc={doc}
            layout={layout}
            pos={pos}
            geoms={geoms}
            frame={frame}
            mode="screen"
            prefix="cv-"
            selection={selection}
            entering={entering}
            pickable={pickable}
            lineage={pick ? null : lineage}
          />
        </g>
      </svg>

      {selPerson && selPt && !pick && (
        <NodeToolbar
          key={selPerson.id}
          person={selPerson}
          x={view.x + selPt.x * view.k}
          top={view.y + (selPt.y - symbolTop(selPerson)) * view.k}
          bottom={view.y + (selPt.y + HALF) * view.k}
          bounds={size}
        />
      )}
      {selUnion && !pick && (
        <UnionToolbar key={selUnion.id} unionId={selUnion.id} x={view.x + selUnion.mid.x * view.k} y={view.y + selUnion.mid.y * view.k} bounds={size} />
      )}

      {pick && (
        <div className="pick-banner" role="status">
          <span className="pick-dot" />
          {pick.mode === "partner"
            ? `Click the person ${doc.people[pick.source]?.name || "they"} partnered with`
            : `Click a parent or a couple's line to set as ${doc.people[pick.source]?.name || "their"} parents`}
          <button className="btn btn-ghost btn-sm" onClick={() => setPick(null)}>
            <X size={14} /> Cancel
          </button>
        </div>
      )}

      {empty && <EmptyState />}

      <div className="zoom-dock" aria-label="Zoom">
        <button className="icon-btn" onClick={() => zoomBy(0.8)} title="Zoom out (−)">
          <Minus size={16} />
        </button>
        <button className="zoom-readout" onClick={() => animateTo({ ...viewRef.current, k: 1, x: size.w / 2 - (size.w / 2 - viewRef.current.x) / viewRef.current.k, y: size.h / 2 - (size.h / 2 - viewRef.current.y) / viewRef.current.k }, 260)} title="Reset to 100%">
          {Math.round(view.k * 100)}%
        </button>
        <button className="icon-btn" onClick={() => zoomBy(1.25)} title="Zoom in (+)">
          <Plus size={16} />
        </button>
        <span className="zoom-sep" />
        <button className="icon-btn" onClick={() => fitView(true)} title="Fit to screen (F)">
          <Maximize2 size={15} />
        </button>
      </div>
    </div>
  );
}
