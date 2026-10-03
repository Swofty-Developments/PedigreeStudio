import { memo } from "react";
import type { PedigreeDoc, Person, Trait } from "../model/types";
import type { Layout, Pt } from "../layout/layout";
import { roman } from "../layout/layout";
import { isLoss, symbolBottom, symbolTop, type UnionGeom } from "../layout/geometry";
import { cancerInfo, GENE_RESULT_BY_ID } from "../model/catalog";
import { FONTS, HALF, LABEL_GAP, SANS, SERIF, measure, type Label } from "./labels";
import { Glyph, PatternDefs, patternId, shapePath } from "./Glyph";
import { INK, INK_2, INK_3, PAPER, RULE, STROKE } from "./theme";

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ChartFrame {
  core: Bounds;
  header: { x: number; y: number; width: number } | null;
  legend: { x: number; y: number; items: LegendItem[]; cols: number; width: number; height: number } | null;
  total: Bounds;
}

type LegendIcon =
  | { kind: "fill"; color: string; trait?: Trait }
  | { kind: "ring"; color: string }
  | { kind: "symbol"; name: string }
  | { kind: "badge"; text: string; color: string };

export interface LegendItem {
  key: string;
  label: string;
  icon: LegendIcon;
}

const LEGEND_COL = 214;
const LEGEND_ROW = 26;

export function legendItems(doc: PedigreeDoc): LegendItem[] {
  const people = Object.values(doc.people);
  const unions = Object.values(doc.unions);
  const items: LegendItem[] = [];
  const cancerCounts = new Map<string, number>();
  for (const p of people) for (const c of new Set(p.cancers.map((x) => x.type))) cancerCounts.set(c, (cancerCounts.get(c) ?? 0) + 1);
  for (const [type] of [...cancerCounts].sort((a, b) => b[1] - a[1])) {
    const info = cancerInfo(type);
    const labels = new Set(people.flatMap((p) => p.cancers.filter((c) => c.type === type && c.label).map((c) => c.label!)));
    const label = type === "other" && labels.size ? [...labels].join(", ") : `${info.name} cancer`;
    items.push({ key: `c:${type}`, label: type === "other" && !labels.size ? "Other cancer" : label, icon: { kind: "fill", color: info.color } });
  }
  for (const t of Object.values(doc.traits)) {
    const used = people.filter((p) => p.conditions.some((c) => c.traitId === t.id));
    if (!used.length) continue;
    const affected = used.some((p) => p.conditions.some((c) => c.traitId === t.id && c.status === "affected"));
    items.push({
      key: `t:${t.id}`,
      label: `${t.name}${t.inheritance ? ` (${t.inheritance})` : ""}`,
      icon: affected ? { kind: "fill", color: t.color, trait: t } : { kind: "ring", color: t.color },
    });
  }
  const sym = (key: string, label: string) => items.push({ key, label, icon: { kind: "symbol", name: key } });
  if (people.some((p) => p.conditions.some((c) => c.status === "carrier"))) sym("carrier", "Carrier (heterozygote)");
  if (people.some((p) => p.conditions.some((c) => c.status === "presymptomatic"))) sym("presym", "Presymptomatic carrier");
  if (people.some((p) => p.proband)) sym("proband", "Proband");
  if (people.some((p) => p.consultand && !p.proband)) sym("consultand", "Consultand");
  if (people.some((p) => p.deceased)) sym("deceased", "Deceased");
  if (people.some((p) => p.adoption !== "none")) sym("adopted", "Adopted (dashed line: adopted in)");
  if (Object.values(doc.twins).some((t) => t.kind === "mz")) sym("mz", "Monozygotic twins");
  if (Object.values(doc.twins).some((t) => t.kind === "dz")) sym("dz", "Dizygotic twins");
  if (Object.values(doc.twins).some((t) => t.kind === "unknown")) sym("tq", "Twins, zygosity unknown");
  if (unions.some((u) => u.consanguinity === "yes" || u.consanguinity === "auto")) {
    if (unions.some((u) => u.consanguinity === "yes" || (u.consanguinity === "auto" && sharesAnyAncestor(doc, u.partners[0], u.partners[1])))) sym("consang", "Consanguineous relationship");
  }
  if (unions.some((u) => u.status === "separated")) sym("separated", "Separated");
  if (unions.some((u) => u.status === "divorced")) sym("divorced", "Divorced");
  if (unions.some((u) => u.noChildren === "infertility")) sym("infertile", "Infertility");
  if (unions.some((u) => u.noChildren === "choice")) sym("nochild", "No children by choice");
  if (people.some((p) => p.outcome === "pregnancy")) sym("preg", "Pregnancy");
  if (people.some((p) => p.outcome === "sab" || p.outcome === "ectopic")) sym("sab", "Miscarriage / ectopic");
  if (people.some((p) => p.outcome === "top")) sym("top", "Termination of pregnancy");
  if (people.some((p) => p.outcome === "stillbirth")) sym("sb", "Stillbirth");
  if (people.some((p) => p.evaluated)) sym("eval", "Documented evaluation");
  const results = new Set(people.flatMap((p) => p.genes.map((g) => g.result)));
  if (results.has("pathogenic") || results.has("likely-pathogenic")) items.push({ key: "g+", label: "Pathogenic variant", icon: { kind: "badge", text: "+", color: GENE_RESULT_BY_ID.pathogenic.color } });
  if (results.has("vus")) items.push({ key: "g?", label: "Variant of uncertain significance", icon: { kind: "badge", text: "?", color: "#b07d00" } });
  if (results.has("negative") || results.has("likely-benign")) items.push({ key: "g-", label: "Negative genetic test", icon: { kind: "badge", text: "−", color: GENE_RESULT_BY_ID.negative.color } });
  return items;
}

function sharesAnyAncestor(doc: PedigreeDoc, a: string, b: string): boolean {
  const up = (id: string) => {
    const out = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      const pu = doc.people[cur]?.parentUnion;
      if (!pu || !doc.unions[pu]) continue;
      for (const p of doc.unions[pu].partners) if (!out.has(p)) { out.add(p); stack.push(p); }
    }
    return out;
  };
  const A = up(a);
  for (const x of up(b)) if (A.has(x)) return true;
  return false;
}

export function computeFrame(doc: PedigreeDoc, layout: Layout, pos: Map<string, Pt>, geoms: UnionGeom[]): ChartFrame {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [id, p] of pos) {
    const person = doc.people[id];
    if (!person) continue;
    const fp = layout.footprint.get(id) ?? 60;
    const lab = layout.labels.get(id);
    const left = person.proband || person.consultand ? p.x - HALF - 40 : p.x - fp / 2;
    minX = Math.min(minX, left, p.x - fp / 2);
    maxX = Math.max(maxX, p.x + fp / 2);
    minY = Math.min(minY, p.y - symbolTop(person) - 16);
    const bottom = p.y + symbolBottom(person) + LABEL_GAP + (lab?.height ?? 0);
    maxY = Math.max(maxY, bottom, person.proband || person.consultand ? p.y + HALF + 36 : bottom);
  }
  for (const g of geoms) if (g.noChildren) maxY = Math.max(maxY, g.noChildren.note.y + 12);
  if (minX === Infinity) {
    minX = 0;
    maxX = 0;
    minY = 0;
    maxY = 0;
  }
  if (doc.display.generations && layout.rows.length) minX -= 54;
  const core = { minX, minY, maxX, maxY };
  let top = minY;
  let header: ChartFrame["header"] = null;
  const titled = !!doc.title.trim() && doc.title.trim() !== "Untitled pedigree";
  if (doc.display.header && (titled || doc.meta.reason || doc.meta.informant || doc.meta.recordedBy)) {
    header = { x: minX, y: minY - 70, width: maxX - minX };
    top = minY - 84;
  }
  let legend: ChartFrame["legend"] = null;
  let bottom = maxY;
  let right = maxX;
  if (doc.display.legend) {
    const items = legendItems(doc);
    if (items.length) {
      const cols = Math.max(1, Math.min(4, Math.floor((maxX - minX) / LEGEND_COL), items.length));
      const colsUsed = Math.max(cols, Math.min(2, items.length));
      const rowsN = Math.ceil(items.length / colsUsed);
      const width = colsUsed * LEGEND_COL;
      const height = 30 + rowsN * LEGEND_ROW;
      legend = { x: minX, y: maxY + 46, items, cols: colsUsed, width, height };
      bottom = maxY + 46 + height;
      right = Math.max(right, minX + width);
    }
  }
  return { core, header, legend, total: { minX: minX, minY: top, maxX: right, maxY: bottom } };
}

function LabelBlock({ label, y }: { label: Label; y: number }) {
  let cy = y;
  return (
    <g className="plabel">
      {label.lines.map((l, i) => {
        const y0 = cy;
        cy += l.h;
        switch (l.kind) {
          case "name":
            return (
              <text key={i} y={y0 + (l.muted ? 11 : 12)} textAnchor="middle" fontFamily={SANS}>
                {l.id && (
                  <tspan fontSize={9.5} fontWeight={650} fill={INK_3} letterSpacing={0.2}>
                    {l.id}
                  </tspan>
                )}
                {l.text &&
                  (l.muted ? (
                    <tspan dx={l.id ? 5 : 0} fontSize={11} fontStyle="italic" fill={INK_3}>
                      {l.text}
                    </tspan>
                  ) : (
                    <tspan dx={l.id ? 5 : 0} fontSize={12.5} fontWeight={640} fill={INK}>
                      {l.text}
                    </tspan>
                  ))}
              </text>
            );
          case "meta":
            return (
              <text key={i} y={y0 + 10.5} textAnchor="middle" fontFamily={SANS} fontSize={11} fontWeight={450} fill={INK_2}>
                {l.text}
              </text>
            );
          case "swatch": {
            const sx = -l.w / 2;
            return (
              <g key={i}>
                {l.ring ? (
                  <rect x={sx + 0.8} y={y0 + 2.8} width={7.4} height={7.4} rx={1.6} fill={PAPER} stroke={l.color} strokeWidth={1.6} />
                ) : (
                  <rect x={sx} y={y0 + 2} width={9} height={9} rx={2} fill={l.color} />
                )}
                <text x={sx + 13} y={y0 + 10.5} fontFamily={SANS} fontSize={11} fontWeight={500} fill={INK_2}>
                  {l.text}
                </text>
              </g>
            );
          }
          case "pills": {
            let px = -l.w / 2;
            return (
              <g key={i}>
                {l.pills.map((p, j) => {
                  const x0 = px;
                  px += p.w + 4;
                  return (
                    <g key={j}>
                      <rect x={x0} y={y0 + 2} width={p.w} height={14} rx={7} fill={p.bg} stroke={p.color} strokeOpacity={0.35} strokeWidth={0.8} />
                      <text x={x0 + p.w / 2} y={y0 + 12.4} textAnchor="middle" fontFamily={SANS} fontSize={9.5} fontWeight={700} letterSpacing={0.2} fill={p.color}>
                        {p.text}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          }
          case "note":
            return (
              <text key={i} y={y0 + 10} textAnchor="middle" fontFamily={SANS} fontSize={10.5} fontStyle="italic" fill={INK_3}>
                {l.text}
              </text>
            );
        }
      })}
    </g>
  );
}

function LegendIconView({ icon, prefix }: { icon: LegendIcon; prefix: string }) {
  const s = 0.36;
  const box = (child: React.ReactNode) => <g transform={`translate(11,11) scale(${s})`}>{child}</g>;
  if (icon.kind === "fill") {
    const fill = icon.trait && icon.trait.pattern !== "solid" ? `url(#${patternId(prefix, icon.trait.id)})` : icon.color;
    return <rect x={2} y={2} width={18} height={18} rx={3} fill={fill} stroke={icon.trait && icon.trait.pattern !== "solid" ? icon.color : "none"} strokeWidth={1} />;
  }
  if (icon.kind === "ring") return <rect x={3} y={3} width={16} height={16} rx={3} fill={PAPER} stroke={icon.color} strokeWidth={2} />;
  if (icon.kind === "badge")
    return (
      <g transform="translate(11,11)">
        <circle r={8} fill={icon.color} />
        <text y={0.5} textAnchor="middle" dominantBaseline="middle" fontFamily={SANS} fontWeight={800} fontSize={11} fill={PAPER}>
          {icon.text}
        </text>
      </g>
    );
  const sq = <path d={shapePath("male", false)} fill={PAPER} stroke={INK} strokeWidth={STROKE / s} />;
  const ln = { stroke: INK, strokeWidth: 1.6, fill: "none", strokeLinecap: "round" as const };
  switch (icon.name) {
    case "carrier":
      return box(<>{sq}<circle r={6 / s / 2.4} fill={INK} /></>);
    case "presym":
      return box(<>{sq}<line x1={0} y1={-HALF} x2={0} y2={HALF} stroke={INK} strokeWidth={2.2 / s / 1.6} /></>);
    case "deceased":
      return box(<>{sq}<line x1={-30} y1={30} x2={30} y2={-30} stroke={INK} strokeWidth={STROKE / s} /></>);
    case "proband":
      return (
        <g>
          <path d="M3,19L10,12" {...ln} />
          <path d="M12,10l-5.5,1.6l3.9,3.9Z" fill={INK} />
          <text x={15} y={19} fontFamily={SANS} fontWeight={750} fontSize={11} fill={INK}>
            P
          </text>
        </g>
      );
    case "consultand":
      return (
        <g>
          <path d="M4,18L12,10" {...ln} />
          <path d="M14,8l-5.5,1.6l3.9,3.9Z" fill={INK} />
        </g>
      );
    case "adopted":
      return <path d="M7,3h-4v16h4M15,3h4v16h-4" {...ln} />;
    case "mz":
      return <path d="M11,3L4,19M11,3L18,19M7.5,11H14.5" {...ln} />;
    case "dz":
      return <path d="M11,3L4,19M11,3L18,19" {...ln} />;
    case "tq":
      return (
        <g>
          <path d="M11,3L4,19M11,3L18,19" {...ln} />
          <text x={11} y={17} textAnchor="middle" fontFamily={SANS} fontSize={8} fontWeight={700} fill={INK}>
            ?
          </text>
        </g>
      );
    case "consang":
      return (
        <g>
          <path d="M1,11H21" stroke={INK} strokeWidth={5.4} />
          <path d="M1,11H21" stroke={PAPER} strokeWidth={1.8} />
        </g>
      );
    case "separated":
      return <path d="M1,11H21M8.5,17L13.5,5" {...ln} />;
    case "divorced":
      return <path d="M1,11H21M6,17L11,5M11,17L16,5" {...ln} />;
    case "infertile":
      return <path d="M11,2V14M5,14H17M5,18H17" {...ln} />;
    case "nochild":
      return <path d="M11,2V16M5,16H17" {...ln} />;
    case "preg":
      return box(<>{sq}<text y={2} textAnchor="middle" dominantBaseline="middle" fontFamily={SANS} fontWeight={650} fontSize={15 / s / 2.2} fill={INK}>P</text></>);
    case "sab":
      return <path d="M11,4L18,17H4Z" fill={PAPER} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />;
    case "top":
      return (
        <g>
          <path d="M11,4L18,17H4Z" fill={PAPER} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
          <path d="M3,20L19,2" {...ln} />
        </g>
      );
    case "sb":
      return (
        <g>
          {box(<>{sq}<line x1={-30} y1={30} x2={30} y2={-30} stroke={INK} strokeWidth={STROKE / s} /></>)}
        </g>
      );
    case "eval":
      return (
        <text x={11} y={20} textAnchor="middle" fontFamily={SANS} fontSize={20} fontWeight={700} fill={INK}>
          *
        </text>
      );
  }
  return null;
}

interface ChartProps {
  doc: PedigreeDoc;
  layout: Layout;
  pos: Map<string, Pt>;
  geoms: UnionGeom[];
  frame: ChartFrame;
  mode: "screen" | "export";
  prefix: string;
  selection?: { kind: "person" | "union"; id: string } | null;
  entering?: Set<string>;
  pickable?: Set<string> | null;
  lineage?: Set<string> | null;
}

function NodeView({
  doc,
  person,
  pt,
  label,
  mode,
  prefix,
  selected,
  entering,
  dim,
  footprint,
}: {
  doc: PedigreeDoc;
  person: Person;
  pt: Pt;
  label: Label;
  mode: "screen" | "export";
  prefix: string;
  selected: boolean;
  entering: boolean;
  dim: boolean;
  footprint: number;
}) {
  const loss = isLoss(person);
  const top = symbolTop(person);
  const bottom = symbolBottom(person);
  const screen = mode === "screen";
  return (
    <g
      className={screen ? `pnode${selected ? " is-selected" : ""}${entering ? " is-entering" : ""}${dim ? " is-dim" : ""}` : undefined}
      transform={`translate(${pt.x},${pt.y})`}
      data-pid={screen ? person.id : undefined}
    >
      <g className={screen ? "pnode-body" : undefined}>
        {screen && (
          <rect className="pnode-hit" x={-footprint / 2} y={-top - 8} width={footprint} height={top + bottom + LABEL_GAP + label.height + 12} rx={10} />
        )}
        {screen && <path className="pnode-halo" d={shapePath(person.sex, loss, 8)} />}
        {screen && <path className="pnode-ring" d={shapePath(person.sex, loss, 6)} />}
        <g className={screen ? "pnode-glyph" : undefined}>
          <Glyph doc={doc} person={person} prefix={prefix} />
        </g>
        <LabelBlock label={label} y={bottom + LABEL_GAP} />
      </g>
    </g>
  );
}

const MemoNode = memo(NodeView, (a, b) =>
  a.person === b.person &&
  a.pt.x === b.pt.x &&
  a.pt.y === b.pt.y &&
  a.label === b.label &&
  a.selected === b.selected &&
  a.entering === b.entering &&
  a.dim === b.dim &&
  a.doc.traits === b.doc.traits &&
  a.doc.display === b.doc.display &&
  a.footprint === b.footprint,
);

export function Chart({ doc, layout, pos, geoms, frame, mode, prefix, selection, entering, pickable, lineage }: ChartProps) {
  const screen = mode === "screen";
  const traits = Object.values(doc.traits);
  const lineStroke = { stroke: INK, strokeWidth: STROKE, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <g>
      <defs>
        <PatternDefs traits={traits} prefix={prefix} />
      </defs>

      {frame.header && (
        <g className="chart-header">
          <text x={frame.header.x} y={frame.header.y} fontFamily={SERIF} fontSize={24} fontWeight={560} fill={INK}>
            {doc.title || "Untitled pedigree"}
          </text>
          <text x={frame.header.x} y={frame.header.y + 24} fontFamily={SANS} fontSize={11.5} fill={INK_2}>
            {[
              doc.meta.date && `Recorded ${doc.meta.date}`,
              doc.meta.recordedBy && `by ${doc.meta.recordedBy}`,
              doc.meta.informant && `Informant: ${doc.meta.informant}`,
              doc.meta.reason && `Reason: ${doc.meta.reason}`,
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </text>
        </g>
      )}

      {doc.display.generations &&
        layout.rows.map((row, i) =>
          row.length ? (
            <text
              key={i}
              x={frame.core.minX + 8}
              y={(pos.get(row[0])?.y ?? layout.rowY[i]) + 6}
              fontFamily={SERIF}
              fontSize={18}
              fontWeight={500}
              fill={INK_3}
            >
              {roman(i + 1)}
            </text>
          ) : null,
        )}

      <g className="chart-lines">
        {geoms.map((g) => {
          const selected = selection?.kind === "union" && selection.id === g.id;
          const hot = lineage?.has(g.id);
          return (
            <g key={g.id} className={screen ? `punion${selected ? " is-selected" : ""}${hot ? " is-lineage" : ""}` : undefined} data-uid={screen ? g.id : undefined}>
              {screen && <path className="punion-hit" d={g.line} />}
              {screen && g.descent && <path className="punion-hit" d={g.descent} />}
              {g.double ? (
                <>
                  <path d={g.line} stroke={INK} strokeWidth={6.2} fill="none" strokeLinejoin="round" className={screen ? "punion-line" : undefined} />
                  <path d={g.line} stroke={PAPER} strokeWidth={2.4} fill="none" strokeLinejoin="round" />
                </>
              ) : (
                <path d={g.line} {...lineStroke} className={screen ? "punion-line" : undefined} />
              )}
              {g.slashes && <path d={g.slashes} {...lineStroke} />}
              {g.descent && <path d={g.descent} {...lineStroke} className={screen ? "punion-line" : undefined} />}
              {g.bar && <path d={g.bar} {...lineStroke} className={screen ? "punion-line" : undefined} />}
              {g.drops.map((d) => (
                <path key={d.id} d={d.path} {...lineStroke} strokeDasharray={d.dashed ? "4 4" : undefined} className={screen ? "punion-line" : undefined} />
              ))}
              {g.twins.map((t, i) => (
                <g key={i}>
                  <path d={t.path} {...lineStroke} className={screen ? "punion-line" : undefined} />
                  {t.bar && <path d={t.bar} {...lineStroke} />}
                  {t.question && (
                    <text x={t.question.x} y={t.question.y} textAnchor="middle" fontFamily={SANS} fontSize={11} fontWeight={700} fill={INK}>
                      ?
                    </text>
                  )}
                </g>
              ))}
              {g.noChildren && (
                <>
                  <path d={g.noChildren.path} {...lineStroke} />
                  {doc.unions[g.id]?.noChildrenNote && (
                    <text x={g.noChildren.note.x} y={g.noChildren.note.y} textAnchor="middle" fontFamily={SANS} fontSize={10.5} fill={INK_2}>
                      {doc.unions[g.id].noChildrenNote}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </g>

      <g className="chart-nodes">
        {layout.rows.flat().map((id) => {
          const person = doc.people[id];
          const pt = pos.get(id);
          if (!person || !pt) return null;
          return (
            <MemoNode
              key={id}
              doc={doc}
              person={person}
              pt={pt}
              label={layout.labels.get(id)!}
              mode={mode}
              prefix={prefix}
              selected={selection?.kind === "person" && selection.id === id}
              entering={!!entering?.has(id)}
              dim={!!pickable && !pickable.has(id)}
              footprint={layout.footprint.get(id) ?? 60}
            />
          );
        })}
      </g>

      {frame.legend && (
        <g className="chart-legend" transform={`translate(${frame.legend.x},${frame.legend.y})`}>
          <line x1={0} y1={-18} x2={Math.max(frame.legend.width, frame.core.maxX - frame.core.minX)} y2={-18} stroke={RULE} strokeWidth={1} />
          <text x={0} y={6} fontFamily={SERIF} fontSize={14} fontWeight={600} fill={INK}>
            Key
          </text>
          {frame.legend.items.map((it, i) => {
            const col = i % frame.legend!.cols;
            const row = Math.floor(i / frame.legend!.cols);
            return (
              <g key={it.key} transform={`translate(${col * LEGEND_COL},${22 + row * LEGEND_ROW})`}>
                <LegendIconView icon={it.icon} prefix={prefix} />
                <text x={30} y={15} fontFamily={SANS} fontSize={11.5} fill={INK_2}>
                  {truncateLegend(it.label)}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
}

function truncateLegend(s: string): string {
  const max = LEGEND_COL - 40;
  if (measure(s, FONTS.meta) <= max) return s;
  let t = s;
  while (t.length > 1 && measure(t + "…", FONTS.meta) > max) t = t.slice(0, -1);
  return t + "…";
}
