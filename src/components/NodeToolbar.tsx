import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, Baby, Dna, Ellipsis, HeartHandshake, Link2, Ribbon, Trash2, Unlink, Users, ArrowUpRight } from "lucide-react";
import type { Outcome, Person, Sex } from "../model/types";
import { useStore } from "../store/store";
import * as A from "../store/actions";
import { SexIcon, TwinIcon } from "./Icons";

type MenuItem =
  | { kind: "item"; label: string; icon: ReactNode; hotkey?: string; run: () => void; danger?: boolean; disabled?: boolean }
  | { kind: "sep" }
  | { kind: "head"; label: string }
  | { kind: "custom"; node: ReactNode };

function Menu({ items, onClose, align = "center" }: { items: MenuItem[]; onClose: () => void; align?: "center" | "right" }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      const hit = items.find((i) => i.kind === "item" && i.hotkey && i.hotkey.toLowerCase() === e.key.toLowerCase() && !i.disabled);
      if (hit && hit.kind === "item") {
        e.preventDefault();
        e.stopPropagation();
        hit.run();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [items, onClose]);
  return (
    <div className={`menu menu-${align}`} role="menu" onPointerDown={(e) => e.stopPropagation()}>
      {items.map((it, i) => {
        if (it.kind === "sep") return <div key={i} className="menu-sep" />;
        if (it.kind === "head") return <div key={i} className="menu-head">{it.label}</div>;
        if (it.kind === "custom") return <div key={i}>{it.node}</div>;
        return (
          <button
            key={i}
            role="menuitem"
            className={`menu-item${it.danger ? " is-danger" : ""}`}
            disabled={it.disabled}
            onClick={() => {
              it.run();
              onClose();
            }}
          >
            <span className="menu-icon">{it.icon}</span>
            <span className="menu-label">{it.label}</span>
            {it.hotkey && <kbd>{it.hotkey}</kbd>}
          </button>
        );
      })}
    </div>
  );
}

function ToolButton({
  label,
  icon,
  onClick,
  active,
  danger,
  disabled,
  hint,
  children,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="tool-wrap">
      <button
        className={`tool${active ? " is-active" : ""}${danger ? " is-danger" : ""}`}
        onClick={onClick}
        disabled={disabled}
        title={hint}
        aria-haspopup={children ? "menu" : undefined}
        aria-expanded={children ? !!active : undefined}
      >
        {icon}
        <span>{label}</span>
      </button>
      {children}
    </div>
  );
}

function usePlacement(x: number, top: number, bottom: number, bounds: { w: number; h: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useLayoutEffect(() => {
    if (ref.current) setWidth(ref.current.offsetWidth);
  }, []);
  const below = top < 150;
  const left = Math.min(Math.max(x, width / 2 + 12), bounds.w - width / 2 - 12);
  const style = below ? { left, top: bottom + 18 } : { left, top: top - 16 };
  return { ref, style, below };
}

const SEXES: { sex: Sex; key: string }[] = [
  { sex: "male", key: "M" },
  { sex: "female", key: "F" },
  { sex: "unknown", key: "U" },
];

export function NodeToolbar({ person, x, top, bottom, bounds }: { person: Person; x: number; top: number; bottom: number; bounds: { w: number; h: number } }) {
  const [menu, setMenu] = useState<string | null>(null);
  const doc = useStore((s) => s.doc);
  const { ref, style, below } = usePlacement(x, top, bottom, bounds);
  const id = person.id;
  const unions = Object.values(doc.unions)
    .filter((u) => u.partners.includes(id))
    .sort((a, b) => a.order - b.order);
  const [unionChoice, setUnionChoice] = useState<string | undefined>(unions.at(-1)?.id);
  const effectiveUnion = unions.some((u) => u.id === unionChoice) ? unionChoice : unions.at(-1)?.id;

  useEffect(() => {
    const onMenu = (e: Event) => setMenu((e as CustomEvent<string>).detail);
    window.addEventListener("pedigree:menu", onMenu);
    return () => window.removeEventListener("pedigree:menu", onMenu);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu, ref]);

  const toggle = (m: string) => setMenu((cur) => (cur === m ? null : m));
  const close = () => setMenu(null);

  const kidWord = (s: Sex) => (s === "male" ? "Son" : s === "female" ? "Daughter" : "Child, sex unknown");
  const sibWord = (s: Sex) => (s === "male" ? "Brother" : s === "female" ? "Sister" : "Sibling, sex unknown");
  const partnerWord = (s: Sex) => (s === "male" ? "Male partner" : s === "female" ? "Female partner" : "Partner, sex unknown");

  const partnerName = (uidv: string) => {
    const u = doc.unions[uidv];
    const other = doc.people[u.partners[0] === id ? u.partners[1] : u.partners[0]];
    return other?.name || (other?.sex === "male" ? "Male partner" : other?.sex === "female" ? "Female partner" : "Partner");
  };

  const childWith: MenuItem[] =
    unions.length > 1
      ? [
          {
            kind: "custom",
            node: (
              <div className="menu-choose">
                <span>With</span>
                <div className="seg seg-sm">
                  {unions.map((u) => (
                    <button key={u.id} className={u.id === effectiveUnion ? "is-on" : ""} onClick={() => setUnionChoice(u.id)}>
                      {partnerName(u.id)}
                    </button>
                  ))}
                </div>
              </div>
            ),
          },
          { kind: "sep" },
        ]
      : unions.length === 0
        ? [{ kind: "head", label: "A partner is added automatically" }]
        : [];

  const outcomeItem = (label: string, outcome: Outcome, icon: ReactNode, hotkey?: string): MenuItem => ({
    kind: "item",
    label,
    icon,
    hotkey,
    run: () => A.addChild(id, "unknown", outcome, effectiveUnion),
  });

  const childMenu: MenuItem[] = [
    ...childWith,
    ...SEXES.map(({ sex, key }) => ({ kind: "item" as const, label: kidWord(sex), icon: <SexIcon sex={sex} />, hotkey: key, run: () => A.addChild(id, sex, "born", effectiveUnion) })),
    { kind: "sep" },
    { kind: "item", label: "Identical twins", icon: <TwinIcon kind="mz" />, hotkey: "I", run: () => A.addTwinChildren(id, "mz", "unknown", effectiveUnion) },
    { kind: "item", label: "Fraternal twins", icon: <TwinIcon kind="dz" />, hotkey: "T", run: () => A.addTwinChildren(id, "dz", "unknown", effectiveUnion) },
    { kind: "sep" },
    outcomeItem("Pregnancy", "pregnancy", <SexIcon sex="pregnancy" />, "P"),
    outcomeItem("Miscarriage (SAB)", "sab", <SexIcon sex="loss" />, "A"),
    outcomeItem("Stillbirth", "stillbirth", <SexIcon sex="stillbirth" />, "S"),
    outcomeItem("Termination (TOP)", "top", <SexIcon sex="top" />),
  ];

  const siblingMenu: MenuItem[] = [
    ...(person.parentUnion ? [] : [{ kind: "head" as const, label: "Parents are added automatically" }]),
    ...SEXES.map(({ sex, key }) => ({ kind: "item" as const, label: sibWord(sex), icon: <SexIcon sex={sex} />, hotkey: key, run: () => A.addSibling(id, sex) })),
    { kind: "sep" },
    { kind: "item", label: "Identical twin", icon: <TwinIcon kind="mz" />, hotkey: "I", run: () => A.addTwin(id, "mz") },
    { kind: "item", label: "Fraternal twin brother", icon: <TwinIcon kind="dz" />, hotkey: "B", run: () => A.addTwin(id, "dz", "male") },
    { kind: "item", label: "Fraternal twin sister", icon: <TwinIcon kind="dz" />, hotkey: "G", run: () => A.addTwin(id, "dz", "female") },
    { kind: "sep" },
    { kind: "item", label: "Miscarriage (SAB)", icon: <SexIcon sex="loss" />, run: () => A.addSibling(id, "unknown", "sab") },
    { kind: "item", label: "Stillbirth", icon: <SexIcon sex="stillbirth" />, run: () => A.addSibling(id, "unknown", "stillbirth") },
  ];

  const partnerMenu: MenuItem[] = [
    ...(unions.length ? [{ kind: "head" as const, label: `Adds partner number ${unions.length + 1}` }] : []),
    ...SEXES.map(({ sex, key }) => ({ kind: "item" as const, label: partnerWord(sex), icon: <SexIcon sex={sex} />, hotkey: key, run: () => A.addPartner(id, sex) })),
    { kind: "sep" },
    { kind: "item", label: "Someone already on the canvas…", icon: <Link2 size={14} />, hotkey: "E", run: () => A.startPick("partner", id) },
  ];

  const moreMenu: MenuItem[] = [
    { kind: "item", label: person.proband ? "Unmark as proband" : "Mark as proband", icon: <ArrowUpRight size={14} />, run: () => A.toggleProband(id) },
    { kind: "sep" },
    { kind: "item", label: "Link to existing parents…", icon: <Link2 size={14} />, disabled: !!person.parentUnion, run: () => A.startPick("parents", id) },
    { kind: "item", label: "Remove parents", icon: <Unlink size={14} />, disabled: !person.parentUnion, run: () => A.removeParents(id) },
    { kind: "sep" },
    { kind: "item", label: "Move left (older)", icon: <ArrowLeft size={14} />, hotkey: "[", disabled: !person.parentUnion, run: () => A.moveSibling(id, -1) },
    { kind: "item", label: "Move right (younger)", icon: <ArrowRight size={14} />, hotkey: "]", disabled: !person.parentUnion, run: () => A.moveSibling(id, 1) },
  ];

  return (
    <div ref={ref} className={`node-toolbar${below ? " is-below" : ""}`} style={style} onPointerDown={(e) => e.stopPropagation()}>
      <ToolButton label="Partner" icon={<HeartHandshake size={16} />} onClick={() => toggle("partner")} active={menu === "partner"} hint="Add partner (P)">
        {menu === "partner" && <Menu items={partnerMenu} onClose={close} />}
      </ToolButton>
      <ToolButton label="Child" icon={<Baby size={16} />} onClick={() => toggle("child")} active={menu === "child"} hint="Add child (C)">
        {menu === "child" && <Menu items={childMenu} onClose={close} />}
      </ToolButton>
      <ToolButton label="Sibling" icon={<Users size={16} />} onClick={() => toggle("sibling")} active={menu === "sibling"} hint="Add sibling or twin (S)">
        {menu === "sibling" && <Menu items={siblingMenu} onClose={close} />}
      </ToolButton>
      <ToolButton label="Parents" icon={<ArrowUp size={16} />} onClick={() => A.addParents(id)} disabled={!!person.parentUnion} hint={person.parentUnion ? "Already has parents" : "Add mother and father (U)"} />
      <span className="tool-sep" />
      <ToolButton label="Cancer" icon={<Ribbon size={16} />} onClick={() => A.addCancer(id)} hint="Add a cancer diagnosis (K)" />
      <ToolButton label="Gene" icon={<Dna size={16} />} onClick={() => A.addGene(id)} hint="Add a genetic test result (G)" />
      <span className="tool-sep" />
      <ToolButton label="" icon={<Ellipsis size={16} />} onClick={() => toggle("more")} active={menu === "more"} hint="More">
        {menu === "more" && <Menu items={moreMenu} onClose={close} align="right" />}
      </ToolButton>
      <ToolButton label="" icon={<Trash2 size={16} />} onClick={() => A.deletePerson(id)} danger hint="Delete (Del)" />
    </div>
  );
}

export function UnionToolbar({ unionId, x, y, bounds }: { unionId: string; x: number; y: number; bounds: { w: number; h: number } }) {
  const [menu, setMenu] = useState<string | null>(null);
  const { ref, style, below } = usePlacement(x, y - 6, y + 6, bounds);
  const close = () => setMenu(null);
  const more: MenuItem[] = [
    { kind: "item", label: "Identical twins", icon: <TwinIcon kind="mz" />, hotkey: "I", run: () => addTwins("mz") },
    { kind: "item", label: "Fraternal twins", icon: <TwinIcon kind="dz" />, hotkey: "T", run: () => addTwins("dz") },
    { kind: "sep" },
    { kind: "item", label: "Pregnancy", icon: <SexIcon sex="pregnancy" />, hotkey: "P", run: () => A.addChildToUnion(unionId, "unknown", "pregnancy") },
    { kind: "item", label: "Miscarriage (SAB)", icon: <SexIcon sex="loss" />, hotkey: "A", run: () => A.addChildToUnion(unionId, "unknown", "sab") },
    { kind: "item", label: "Stillbirth", icon: <SexIcon sex="stillbirth" />, hotkey: "S", run: () => A.addChildToUnion(unionId, "unknown", "stillbirth") },
    { kind: "item", label: "Termination (TOP)", icon: <SexIcon sex="top" />, run: () => A.addChildToUnion(unionId, "unknown", "top") },
  ];
  function addTwins(kind: "mz" | "dz") {
    const first = A.addChildToUnion(unionId, "unknown");
    A.addTwin(first, kind);
  }
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menu, ref]);
  return (
    <div ref={ref} className={`node-toolbar${below ? " is-below" : ""}`} style={style} onPointerDown={(e) => e.stopPropagation()}>
      <ToolButton label="Son" icon={<SexIcon sex="male" size={15} />} onClick={() => A.addChildToUnion(unionId, "male")} hint="Add son" />
      <ToolButton label="Daughter" icon={<SexIcon sex="female" size={15} />} onClick={() => A.addChildToUnion(unionId, "female")} hint="Add daughter" />
      <ToolButton label="Child" icon={<SexIcon sex="unknown" size={15} />} onClick={() => A.addChildToUnion(unionId, "unknown")} hint="Add child, sex unknown" />
      <ToolButton label="" icon={<Ellipsis size={16} />} onClick={() => setMenu((m) => (m ? null : "more"))} active={menu === "more"} hint="Twins, pregnancies and losses">
        {menu === "more" && <Menu items={more} onClose={close} align="right" />}
      </ToolButton>
      <span className="tool-sep" />
      <ToolButton label="" icon={<Trash2 size={16} />} onClick={() => A.deleteUnion(unionId)} danger hint="Remove relationship" />
    </div>
  );
}
