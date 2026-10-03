import type { FillPattern, PedigreeDoc, Person, Sex, Trait } from "../model/types";
import { cancerInfo, GENE_RESULT_BY_ID } from "../model/catalog";
import { HALF, SANS } from "./labels";
import { INK, PAPER, STROKE } from "./theme";
import { isLoss } from "../layout/geometry";

export function shapePath(sex: Sex, loss: boolean, grow = 0): string {
  if (loss) {
    const s = 1 + grow / 16;
    return `M0,${-16 * s}L${17 * s},${13 * s}L${-17 * s},${13 * s}Z`;
  }
  if (sex === "male") {
    const h = HALF + grow;
    const r = 2.5 + grow * 0.4;
    return `M${-h + r},${-h}H${h - r}Q${h},${-h} ${h},${-h + r}V${h - r}Q${h},${h} ${h - r},${h}H${-h + r}Q${-h},${h} ${-h},${h - r}V${-h + r}Q${-h},${-h} ${-h + r},${-h}Z`;
  }
  if (sex === "female") {
    const r = HALF + grow;
    return `M${-r},0A${r},${r} 0 1,0 ${r},0A${r},${r} 0 1,0 ${-r},0Z`;
  }
  const d = HALF + 3 + grow * 1.2;
  return `M0,${-d}L${d},0L0,${d}L${-d},0Z`;
}

export interface FillItem {
  key: string;
  color: string;
  pattern: FillPattern;
  traitId?: string;
}

export function fillItems(doc: PedigreeDoc, p: Person): FillItem[] {
  const items: FillItem[] = [];
  const seen = new Set<string>();
  for (const c of p.cancers) {
    if (seen.has(`c:${c.type}`)) continue;
    seen.add(`c:${c.type}`);
    items.push({ key: `c:${c.type}`, color: cancerInfo(c.type).color, pattern: "solid" });
  }
  for (const c of p.conditions) {
    if (c.status !== "affected") continue;
    const t = doc.traits[c.traitId];
    if (!t || seen.has(`t:${t.id}`)) continue;
    seen.add(`t:${t.id}`);
    items.push({ key: `t:${t.id}`, color: t.color, pattern: t.pattern, traitId: t.id });
  }
  return items;
}

export function patternId(prefix: string, traitId: string): string {
  return `${prefix}pat-${traitId}`;
}

export function PatternDefs({ traits, prefix }: { traits: Trait[]; prefix: string }) {
  return (
    <>
      {traits
        .filter((t) => t.pattern !== "solid")
        .map((t) => (
          <pattern
            key={t.id}
            id={patternId(prefix, t.id)}
            width={t.pattern === "dots" ? 5 : 6}
            height={t.pattern === "dots" ? 5 : 6}
            patternUnits="userSpaceOnUse"
            patternTransform={t.pattern === "hatch" || t.pattern === "cross" ? "rotate(45)" : undefined}
          >
            <rect width="6" height="6" fill={PAPER} />
            {t.pattern === "hatch" && <line x1="0" y1="0" x2="0" y2="6" stroke={t.color} strokeWidth="3" />}
            {t.pattern === "cross" && (
              <>
                <line x1="0" y1="0" x2="0" y2="6" stroke={t.color} strokeWidth="2" />
                <line x1="0" y1="0" x2="6" y2="0" stroke={t.color} strokeWidth="2" />
              </>
            )}
            {t.pattern === "dots" && <circle cx="2.5" cy="2.5" r="1.5" fill={t.color} />}
            {t.pattern === "stripes" && <line x1="0" y1="1.5" x2="6" y2="1.5" stroke={t.color} strokeWidth="2.6" />}
          </pattern>
        ))}
    </>
  );
}

function wedge(i: number, n: number): string {
  const R = 60;
  const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / n;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M0,0L${R * Math.cos(a0)},${R * Math.sin(a0)}A${R},${R} 0 ${large},1 ${R * Math.cos(a1)},${R * Math.sin(a1)}Z`;
}

export function geneBadge(p: Person): { text: string; color: string } | null {
  if (!p.genes.length) return null;
  const rank = ["pathogenic", "likely-pathogenic", "vus", "likely-benign", "negative"];
  const best = [...p.genes].sort((a, b) => rank.indexOf(a.result) - rank.indexOf(b.result))[0];
  const r = GENE_RESULT_BY_ID[best.result];
  if (best.result === "pathogenic" || best.result === "likely-pathogenic") return { text: "+", color: r.color };
  if (best.result === "vus") return { text: "?", color: "#b07d00" };
  return { text: "−", color: r.color };
}

interface GlyphProps {
  doc: PedigreeDoc;
  person: Person;
  prefix: string;
  showBadges?: boolean;
}

export function Glyph({ doc, person: p, prefix, showBadges = true }: GlyphProps) {
  const loss = isLoss(p);
  const d = shapePath(p.sex, loss);
  const items = fillItems(doc, p);
  const filled = items.length > 0;
  const clipId = `${prefix}clip-${p.id}`;
  const carriers = p.conditions.filter((c) => c.status === "carrier" && doc.traits[c.traitId]);
  const presym = p.conditions.some((c) => c.status === "presymptomatic" && doc.traits[c.traitId]);
  const suspected = p.conditions.some((c) => c.status === "suspected" && doc.traits[c.traitId]);
  const top = loss ? 16 : p.sex === "unknown" ? HALF + 3 : HALF;
  const bottom = loss ? 13 : top;
  const inner = p.multiple ? p.multiple : p.art === "donor" ? "D" : p.art === "surrogate" ? "S" : p.outcome === "pregnancy" ? "P" : suspected && !filled ? "?" : "";
  const badge = showBadges ? geneBadge(p) : null;
  const ext = loss ? 8 : 8;
  const deceased = p.deceased || p.outcome === "stillbirth" || p.outcome === "top";
  const dTop = loss ? 18 : top + ext;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill={PAPER} />
      {filled && (
        <g clipPath={`url(#${clipId})`}>
          {items.length === 1 ? (
            <rect x={-40} y={-40} width={80} height={80} fill={items[0].pattern !== "solid" && items[0].traitId ? `url(#${patternId(prefix, items[0].traitId)})` : items[0].color} />
          ) : (
            items.map((it, i) => (
              <path
                key={it.key}
                d={wedge(i, items.length)}
                fill={it.pattern !== "solid" && it.traitId ? `url(#${patternId(prefix, it.traitId)})` : it.color}
              />
            ))
          )}
          {items.length > 1 &&
            items.map((_, i) => {
              const a = -Math.PI / 2 + (i * 2 * Math.PI) / items.length;
              return <line key={i} x1={0} y1={0} x2={60 * Math.cos(a)} y2={60 * Math.sin(a)} stroke={PAPER} strokeWidth={1.4} />;
            })}
        </g>
      )}
      {presym && <line x1={0} y1={-top} x2={0} y2={bottom} stroke={INK} strokeWidth={2.2} />}
      <path d={d} fill="none" stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
      {carriers.map((c, i) => {
        const n = carriers.length;
        const cx = (i - (n - 1) / 2) * 11;
        const color = doc.traits[c.traitId]?.color ?? INK;
        return (
          <circle
            key={c.id}
            cx={cx}
            cy={loss ? 2 : 0}
            r={4.6}
            fill={filled ? PAPER : n > 1 ? color : INK}
            stroke={filled ? INK : "none"}
            strokeWidth={filled ? 1.4 : 0}
          />
        );
      })}
      {inner && (
        <text
          x={0}
          y={loss ? 6 : 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={SANS}
          fontSize={inner.length > 2 ? 12 : 15}
          fontWeight={650}
          fill={filled ? PAPER : INK}
          stroke={filled ? INK : "none"}
          strokeWidth={filled ? 0.6 : 0}
        >
          {inner}
        </text>
      )}
      {deceased && (
        <line
          x1={-dTop}
          y1={dTop}
          x2={dTop}
          y2={-dTop}
          stroke={INK}
          strokeWidth={STROKE + 0.1}
          strokeLinecap="round"
        />
      )}
      {p.adoption !== "none" && !loss && (
        <path
          d={`M${-top - 5},${-top - 5}h-5v${top * 2 + 10}h5M${top + 5},${-top - 5}h5v${top * 2 + 10}h-5`}
          fill="none"
          stroke={INK}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
      )}
      {(p.proband || p.consultand) && (
        <g>
          <path d={`M${-top - 26},${bottom + 22}L${-top - 5},${bottom + 1}`} stroke={INK} strokeWidth={2} strokeLinecap="round" />
          <path d={`M${-top - 3},${bottom - 1}l-11.5,3.2l8.3,8.3Z`} fill={INK} />
          {p.proband && (
            <text x={-top - 31} y={bottom + 31} textAnchor="middle" fontFamily={SANS} fontWeight={750} fontSize={13} fill={INK}>
              P
            </text>
          )}
        </g>
      )}
      {p.evaluated && (
        <text x={top + 8} y={bottom + 4} fontFamily={SANS} fontWeight={700} fontSize={16} fill={INK}>
          *
        </text>
      )}
      {badge && (
        <g transform={`translate(${loss ? 12 : top - 1},${loss ? -12 : -top + 1})`}>
          <circle r={8} fill={badge.color} stroke={PAPER} strokeWidth={2} />
          <text y={0.5} textAnchor="middle" dominantBaseline="middle" fontFamily={SANS} fontWeight={800} fontSize={11} fill={PAPER}>
            {badge.text}
          </text>
        </g>
      )}
    </g>
  );
}
