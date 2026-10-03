import { useLayoutEffect, useReducer, useRef } from "react";
import type { Pt } from "../layout/layout";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useTweenedPositions(target: Map<string, Pt>, originOf: (id: string, shown: Map<string, Pt>) => Pt | null, duration = 420): Map<string, Pt> {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const shown = useRef<Map<string, Pt>>(target);
  const raf = useRef(0);
  const lastTarget = useRef<Map<string, Pt> | null>(null);

  useLayoutEffect(() => {
    if (lastTarget.current === target) return;
    const first = lastTarget.current === null;
    lastTarget.current = target;
    cancelAnimationFrame(raf.current);
    if (first || reduced()) {
      shown.current = target;
      force();
      return;
    }
    const from = new Map<string, Pt>();
    for (const [id, p] of target) {
      const prev = shown.current.get(id) ?? originOf(id, shown.current);
      from.set(id, prev ?? p);
    }
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 4);
      const m = new Map<string, Pt>();
      for (const [id, p] of target) {
        const f = from.get(id)!;
        m.set(id, { x: f.x + (p.x - f.x) * e, y: f.y + (p.y - f.y) * e });
      }
      shown.current = m;
      force();
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, originOf, duration]);

  const cur = shown.current;
  let complete = true;
  for (const id of target.keys()) {
    if (!cur.has(id)) {
      complete = false;
      break;
    }
  }
  if (complete) return cur;
  const merged = new Map(cur);
  for (const [id, p] of target) if (!merged.has(id)) merged.set(id, originOf(id, cur) ?? p);
  return merged;
}
