import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2, X } from "lucide-react";
import type { ConditionStatus, GeneResult, PedigreeDoc, Person, Trait, Union } from "../model/types";
import { useStore } from "../store/store";
import * as A from "../store/actions";
import { uid, setTwinKind } from "../model/ops";
import { ANCESTRIES, CANCERS, cancerInfo, CONDITION_STATUS, GENE_RESULTS, GENES, OUTCOMES, PATTERNS, TRAIT_COLORS, TRAIT_PRESETS } from "../model/catalog";
import { capitalise, coupleRelation } from "../model/kinship";
import { probandOf, sharesAncestor } from "../model/graph";
import { relationMap } from "../model/kinship";
import { Glyph } from "../render/Glyph";
import { Field, Section, Seg, Toggle } from "./Fields";
import { SexIcon } from "./Icons";

function usePersonCommit(id: string) {
  const commit = useStore((s) => s.commit);
  return (fn: (p: Person, d: PedigreeDoc) => void, key?: string) =>
    commit((d) => {
      const p = d.people[id];
      if (p) fn(p as Person, d as PedigreeDoc);
    }, key ? `${key}:${id}` : undefined);
}

function GlyphPreview({ doc, person }: { doc: PedigreeDoc; person: Person }) {
  return (
    <svg className="insp-glyph" viewBox="-40 -38 80 80" width={64} height={64} aria-hidden="true">
      <Glyph doc={doc} person={{ ...person, proband: false, consultand: false }} prefix="ip-" />
    </svg>
  );
}

export function Inspector() {
  const selection = useStore((s) => s.selection);
  const doc = useStore((s) => s.doc);
  const select = useStore((s) => s.select);
  const person = selection?.kind === "person" ? doc.people[selection.id] : null;
  const union = selection?.kind === "union" ? doc.unions[selection.id] : null;
  return (
    <aside className="inspector" aria-label="Details">
      {person ? (
        <PersonPanel key={person.id} person={person} doc={doc} onClose={() => select(null)} />
      ) : union ? (
        <UnionPanel key={union.id} union={union} doc={doc} onClose={() => select(null)} />
      ) : (
        <DocPanel doc={doc} />
      )}
    </aside>
  );
}

function PersonPanel({ person, doc, onClose }: { person: Person; doc: PedigreeDoc; onClose: () => void }) {
  const update = usePersonCommit(person.id);
  const focus = useStore((s) => s.inspectorFocus);
  const nameRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const proband = probandOf(doc);
  const relation = useMemo(() => (proband ? relationMap(doc, proband.id).get(person.id) ?? "" : ""), [doc, proband, person.id]);
  const twinKind = person.twin ? doc.twins[person.twin]?.kind : undefined;

  useEffect(() => {
    if (!focus || Date.now() - focus.tick > 1500) return;
    if (focus.section === "name") {
      nameRef.current?.focus();
      nameRef.current?.select();
      return;
    }
    const sec = rootRef.current?.querySelector(`[data-section="${focus.section}"]`);
    sec?.scrollIntoView({ behavior: "smooth", block: "start" });
    const inputs = sec?.querySelectorAll<HTMLElement>("select, input");
    inputs?.[focus.section === "cancer" ? Math.max(0, inputs.length - 2) : Math.max(0, inputs.length - 3)]?.focus();
  }, [focus]);

  const sexLabel = person.sex === "male" ? "Male" : person.sex === "female" ? "Female" : "Unknown sex";

  return (
    <div className="insp" ref={rootRef}>
      <div className="insp-hero">
        <GlyphPreview doc={doc} person={person} />
        <div className="insp-hero-text">
          <input
            ref={nameRef}
            className="name-input"
            value={person.name}
            placeholder={relation && relation !== "self" ? capitalise(relation) : `Name this person`}
            onChange={(e) => update((p) => void (p.name = e.target.value), "name")}
            aria-label="Name"
          />
          <p className="insp-sub">
            {[sexLabel, relation === "self" ? "Proband" : relation && capitalise(relation)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close (Esc)">
          <X size={16} />
        </button>
      </div>

      <Section title="Person">
        <Seg
          label="Sex"
          value={person.sex}
          onChange={(v) =>
            update((p, d) => {
              p.sex = v;
              if (p.twin && d.twins[p.twin]?.kind === "mz") for (const o of Object.values(d.people)) if (o.twin === p.twin) o.sex = v;
            })
          }
          options={[
            { value: "male", label: <><SexIcon sex="male" /> Male</> },
            { value: "female", label: <><SexIcon sex="female" /> Female</> },
            { value: "unknown", label: <><SexIcon sex="unknown" /> Unknown</> },
          ]}
        />
        <div className="grid2">
          <Field label="Age">
            <input value={person.age} placeholder="e.g. 42y" onChange={(e) => update((p) => void (p.age = e.target.value), "age")} />
          </Field>
          <Field label="Born">
            <input value={person.birth} placeholder="year or date" onChange={(e) => update((p) => void (p.birth = e.target.value), "birth")} />
          </Field>
        </div>
        <Field label="Sex assigned at birth" hint="when clinically relevant">
          <select value={person.assigned} onChange={(e) => update((p) => void (p.assigned = e.target.value as Person["assigned"]))}>
            <option value="">Not recorded</option>
            <option value="AMAB">AMAB · assigned male</option>
            <option value="AFAB">AFAB · assigned female</option>
            <option value="UAAB">UAAB · unassigned</option>
          </select>
        </Field>
        <Seg
          label="Vital status"
          value={person.deceased ? "dead" : "alive"}
          onChange={(v) => update((p) => void (p.deceased = v === "dead"))}
          options={[
            { value: "alive", label: "Living" },
            { value: "dead", label: "Deceased" },
          ]}
        />
        {person.deceased && (
          <div className="grid2 reveal">
            <Field label="Age at death">
              <input value={person.deathAge} placeholder="e.g. 67y" onChange={(e) => update((p) => void (p.deathAge = e.target.value), "dage")} />
            </Field>
            <Field label="Cause">
              <input value={person.deathCause} placeholder="optional" onChange={(e) => update((p) => void (p.deathCause = e.target.value), "dcause")} />
            </Field>
          </div>
        )}
      </Section>

      <Section
        id="cancer"
        title="Cancer history"
        action={
          <button className="btn btn-ghost btn-sm" onClick={() => update((p) => void p.cancers.push({ id: uid("c"), type: "breast", age: "" }))}>
            <Plus size={14} /> Add
          </button>
        }
      >
        {person.cancers.length === 0 && <p className="muted-line">No cancers recorded.</p>}
        {person.cancers.map((c, i) => (
          <div key={c.id} className="row-entry">
            <span className="swatch" style={{ background: cancerInfo(c.type).color }} />
            <select value={c.type} onChange={(e) => update((p) => void (p.cancers[i].type = e.target.value))} aria-label="Cancer type">
              {CANCERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input className="age-in" value={c.age} placeholder="Age dx" onChange={(e) => update((p) => void (p.cancers[i].age = e.target.value), `cage${i}`)} aria-label="Age at diagnosis" />
            <button className="icon-btn icon-btn-sm" title="Remove" onClick={() => update((p) => void p.cancers.splice(i, 1))}>
              <X size={14} />
            </button>
            {c.type === "other" && (
              <input className="row-full" value={c.label ?? ""} placeholder="Which cancer?" onChange={(e) => update((p) => void (p.cancers[i].label = e.target.value), `clabel${i}`)} />
            )}
          </div>
        ))}
        <Field label="Colon polyps" hint="count, or ‘yes’">
          <input value={person.polyps} placeholder="none" onChange={(e) => update((p) => void (p.polyps = e.target.value), "polyps")} />
        </Field>
      </Section>

      <Section
        id="genes"
        title="Genetic testing"
        action={
          <button className="btn btn-ghost btn-sm" onClick={() => update((p) => void p.genes.push({ id: uid("g"), gene: "", variant: "", result: "pathogenic" }))}>
            <Plus size={14} /> Add
          </button>
        }
      >
        {person.genes.length === 0 && <p className="muted-line">No results recorded.</p>}
        <datalist id="gene-list">
          {GENES.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        {person.genes.map((g, i) => (
          <div key={g.id} className="row-entry gene-entry">
            <input className="gene-in" list="gene-list" value={g.gene} placeholder="Gene" onChange={(e) => update((p) => void (p.genes[i].gene = e.target.value.toUpperCase()), `gene${i}`)} aria-label="Gene" />
            <select value={g.result} onChange={(e) => update((p) => void (p.genes[i].result = e.target.value as GeneResult))} aria-label="Result">
              {GENE_RESULTS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <button className="icon-btn icon-btn-sm" title="Remove" onClick={() => update((p) => void p.genes.splice(i, 1))}>
              <X size={14} />
            </button>
            <input className="row-full" value={g.variant} placeholder="Variant, e.g. c.68_69delAG" onChange={(e) => update((p) => void (p.genes[i].variant = e.target.value), `var${i}`)} />
          </div>
        ))}
      </Section>

      <ConditionsSection person={person} doc={doc} />

      <Section title="Clinical role">
        <Toggle checked={person.proband} onChange={() => A.toggleProband(person.id)} label="Proband" hint="Arrow with P; relationships are labelled from them" />
        <Toggle checked={person.consultand} onChange={(v) => update((p) => void (p.consultand = v))} label="Consultand" hint="The person seeking counselling" />
        <Toggle checked={person.evaluated} onChange={(v) => update((p) => void (p.evaluated = v))} label="Documented evaluation" hint="Asterisk beside the symbol" />
      </Section>

      <Section title="Birth & family">
        <Field label="Pregnancy outcome">
          <select value={person.outcome} onChange={(e) => update((p) => void (p.outcome = e.target.value as Person["outcome"]))}>
            {OUTCOMES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {person.outcome !== "born" && (
          <Field label="Gestational age">
            <input value={person.gestation} placeholder="e.g. 12 wk" onChange={(e) => update((p) => void (p.gestation = e.target.value), "gest")} />
          </Field>
        )}
        <Field label="Adoption">
          <Seg
            size="sm"
            value={person.adoption}
            onChange={(v) => update((p) => void (p.adoption = v))}
            options={[
              { value: "none", label: "No" },
              { value: "in", label: "Adopted in", title: "Dashed line to adoptive parents" },
              { value: "out", label: "Adopted out" },
            ]}
          />
        </Field>
        {person.twin && (
          <Field label="Twin">
            <Seg
              size="sm"
              value={twinKind ?? "dz"}
              onChange={(v) => useStore.getState().commit((d) => setTwinKind(d, person.id, v))}
              options={[
                { value: "mz", label: "Identical" },
                { value: "dz", label: "Fraternal" },
                { value: "unknown", label: "Unknown" },
              ]}
            />
            <button className="link-btn" onClick={() => useStore.getState().commit((d) => setTwinKind(d, person.id, "none"))}>
              Not a twin
            </button>
          </Field>
        )}
        <div className="grid2">
          <Field label="Represents" hint="several people">
            <input value={person.multiple} placeholder="1" onChange={(e) => update((p) => void (p.multiple = e.target.value), "multi")} />
          </Field>
          <Field label="Reproductive role">
            <select value={person.art} onChange={(e) => update((p) => void (p.art = e.target.value as Person["art"]))}>
              <option value="none">None</option>
              <option value="donor">Donor (D)</option>
              <option value="surrogate">Surrogate (S)</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Ancestry">
        <div className="chips">
          {ANCESTRIES.map((a) => {
            const on = person.ancestry.includes(a);
            return (
              <button
                key={a}
                className={`chip${on ? " is-on" : ""}`}
                onClick={() =>
                  update((p) => {
                    p.ancestry = on ? p.ancestry.filter((x) => x !== a) : [...p.ancestry, a];
                  })
                }
              >
                {a}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Notes">
        <textarea rows={3} value={person.note} placeholder="Shown under the symbol" onChange={(e) => update((p) => void (p.note = e.target.value), "note")} />
      </Section>

      <div className="insp-footer">
        {person.parentUnion && (
          <div className="order-btns">
            <button className="btn btn-ghost btn-sm" onClick={() => A.moveSibling(person.id, -1)} title="Move left among siblings ([)">
              <ArrowLeft size={14} /> Older
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => A.moveSibling(person.id, 1)} title="Move right among siblings (])">
              Younger <ArrowRight size={14} />
            </button>
          </div>
        )}
        <button className="btn btn-danger btn-sm" onClick={() => A.deletePerson(person.id)}>
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
}

function ConditionsSection({ person, doc }: { person: Person; doc: PedigreeDoc }) {
  const commit = useStore((s) => s.commit);
  const update = usePersonCommit(person.id);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const traits = Object.values(doc.traits);

  const attach = (traitId: string) => update((p) => void p.conditions.push({ id: uid("k"), traitId, status: "affected", age: "" }));
  const create = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const existing = traits.find((t) => t.name.toLowerCase() === clean.toLowerCase());
    if (existing) attach(existing.id);
    else {
      const preset = TRAIT_PRESETS.find((t) => t.name.toLowerCase() === clean.toLowerCase());
      const id = uid("tr");
      commit((d) => {
        d.traits[id] = { id, name: clean, color: TRAIT_COLORS[Object.keys(d.traits).length % TRAIT_COLORS.length], pattern: "solid", inheritance: preset?.inheritance ?? "" };
        d.people[person.id].conditions.push({ id: uid("k"), traitId: id, status: "affected", age: "" });
      });
    }
    setDraft("");
    setAdding(false);
  };

  return (
    <Section
      id="conditions"
      title="Other conditions"
      action={
        <button className="btn btn-ghost btn-sm" onClick={() => setAdding((v) => !v)}>
          <Plus size={14} /> Add
        </button>
      }
    >
      {person.conditions.length === 0 && !adding && <p className="muted-line">Genetic conditions, carrier status, other diagnoses.</p>}
      {person.conditions.map((c, i) => {
        const t = doc.traits[c.traitId];
        if (!t) return null;
        return (
          <div key={c.id} className="row-entry">
            <span className="swatch" style={{ background: c.status === "affected" ? t.color : "transparent", borderColor: t.color }} />
            <span className="cond-name">{t.name}</span>
            <select value={c.status} onChange={(e) => update((p) => void (p.conditions[i].status = e.target.value as ConditionStatus))} aria-label="Status">
              {CONDITION_STATUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button className="icon-btn icon-btn-sm" title="Remove" onClick={() => update((p) => void p.conditions.splice(i, 1))}>
              <X size={14} />
            </button>
          </div>
        );
      })}
      {adding && (
        <div className="cond-add reveal">
          <datalist id="trait-presets">
            {TRAIT_PRESETS.map((t) => (
              <option key={t.name} value={t.name} />
            ))}
          </datalist>
          {traits.filter((t) => !person.conditions.some((c) => c.traitId === t.id)).length > 0 && (
            <div className="chips">
              {traits
                .filter((t) => !person.conditions.some((c) => c.traitId === t.id))
                .map((t) => (
                  <button key={t.id} className="chip" onClick={() => (attach(t.id), setAdding(false))}>
                    <span className="swatch swatch-sm" style={{ background: t.color }} /> {t.name}
                  </button>
                ))}
            </div>
          )}
          <div className="row-entry">
            <input
              autoFocus
              list="trait-presets"
              value={draft}
              placeholder="New condition, e.g. Cystic fibrosis"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create(draft);
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <button className="btn btn-primary btn-sm" onClick={() => create(draft)}>
              Add
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function UnionPanel({ union, doc, onClose }: { union: Union; doc: PedigreeDoc; onClose: () => void }) {
  const commit = useStore((s) => s.commit);
  const select = useStore((s) => s.select);
  const [a, b] = union.partners.map((id) => doc.people[id]);
  const kids = Object.values(doc.people)
    .filter((p) => p.parentUnion === union.id)
    .sort((x, y) => x.order - y.order);
  const related = sharesAncestor(doc, union.partners[0], union.partners[1]);
  const relText = related ? coupleRelation(doc, union.partners[0], union.partners[1]) : "";
  const set = (fn: (u: Union) => void, key?: string) =>
    commit((d) => {
      fn(d.unions[union.id] as Union);
    }, key ? `${key}:${union.id}` : undefined);
  const nm = (p?: Person) => p?.name || (p?.sex === "male" ? "Male" : p?.sex === "female" ? "Female" : "Person");

  return (
    <div className="insp">
      <div className="insp-hero">
        <div className="couple-glyph" aria-hidden="true">
          <SexIcon sex={a?.sex ?? "unknown"} size={22} />
          <span className={`couple-line${related || union.consanguinity === "yes" ? " is-double" : ""}`} />
          <SexIcon sex={b?.sex ?? "unknown"} size={22} />
        </div>
        <div className="insp-hero-text">
          <h2 className="insp-title">
            {nm(a)} &amp; {nm(b)}
          </h2>
          <p className="insp-sub">
            Relationship · {kids.length ? `${kids.length} ${kids.length === 1 ? "child" : "children"}` : "no children"}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close (Esc)">
          <X size={16} />
        </button>
      </div>

      <Section title="Status">
        <Seg
          value={union.status}
          onChange={(v) => set((u) => void (u.status = v))}
          options={[
            { value: "partnered", label: "Together" },
            { value: "separated", label: "Separated", title: "Single slash" },
            { value: "divorced", label: "Divorced", title: "Double slash" },
          ]}
        />
        <Field label="Consanguinity" hint={related ? relText || "Shared ancestor found" : "No shared ancestor in the chart"}>
          <Seg
            size="sm"
            value={union.consanguinity}
            onChange={(v) => set((u) => void (u.consanguinity = v))}
            options={[
              { value: "auto", label: related ? "Auto · yes" : "Auto · no" },
              { value: "yes", label: "Related" },
              { value: "no", label: "Not related" },
            ]}
          />
        </Field>
      </Section>

      <Section title="Children">
        {kids.length > 0 && (
          <ol className="kid-list">
            {kids.map((k, i) => (
              <li key={k.id}>
                <button className="kid" onClick={() => select({ kind: "person", id: k.id })}>
                  <span className="kid-n">{i + 1}</span>
                  <SexIcon sex={k.outcome === "sab" || k.outcome === "top" || k.outcome === "ectopic" ? "loss" : k.sex} size={14} />
                  <span>{k.name || (k.outcome !== "born" ? OUTCOMES.find((o) => o.id === k.outcome)?.label : k.sex === "male" ? "Son" : k.sex === "female" ? "Daughter" : "Child")}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="btn-row">
          <button className="btn btn-sm btn-add" onClick={() => A.addChildToUnion(union.id, "male")}>
            <Plus size={13} /> Son
          </button>
          <button className="btn btn-sm btn-add" onClick={() => A.addChildToUnion(union.id, "female")}>
            <Plus size={13} /> Daughter
          </button>
          <button className="btn btn-sm btn-add" onClick={() => A.addChildToUnion(union.id, "unknown")}>
            <Plus size={13} /> Child
          </button>
        </div>
        {kids.length === 0 && (
          <>
            <Field label="No children">
              <Seg
                size="sm"
                value={union.noChildren}
                onChange={(v) => set((u) => void (u.noChildren = v))}
                options={[
                  { value: "none", label: "Not noted" },
                  { value: "choice", label: "By choice" },
                  { value: "infertility", label: "Infertility" },
                ]}
              />
            </Field>
            {union.noChildren !== "none" && (
              <Field label="Reason" hint="shown under the line">
                <input value={union.noChildrenNote} placeholder="e.g. azoospermia" onChange={(e) => set((u) => void (u.noChildrenNote = e.target.value), "ncnote")} />
              </Field>
            )}
          </>
        )}
      </Section>

      <div className="insp-footer">
        <span />
        <button className="btn btn-danger btn-sm" onClick={() => A.deleteUnion(union.id)}>
          <Trash2 size={14} /> Remove relationship
        </button>
      </div>
    </div>
  );
}

function DocPanel({ doc }: { doc: PedigreeDoc }) {
  const commit = useStore((s) => s.commit);
  const people = Object.values(doc.people);
  const affected = people.filter((p) => p.cancers.length || p.conditions.some((c) => c.status === "affected")).length;
  const carriers = people.filter((p) => p.genes.some((g) => g.result === "pathogenic" || g.result === "likely-pathogenic")).length;
  const setMeta = (k: keyof PedigreeDoc["meta"], v: string) => commit((d) => void (d.meta[k] = v), `meta-${k}`);
  const setDisplay = (k: keyof PedigreeDoc["display"], v: boolean) => commit((d) => void (d.display[k] = v));
  const display: [keyof PedigreeDoc["display"], string][] = [
    ["names", "Names"],
    ["relations", "Relationship labels"],
    ["ages", "Ages & dates"],
    ["cancers", "Diagnoses"],
    ["genes", "Genetic results"],
    ["notes", "Notes"],
    ["ids", "Individual numbers"],
    ["generations", "Generation numerals"],
    ["header", "Title block"],
    ["legend", "Key"],
  ];
  return (
    <div className="insp">
      <div className="insp-doc-head">
        <p className="eyebrow">Chart</p>
        <input className="title-input" value={doc.title} onChange={(e) => commit((d) => void (d.title = e.target.value), "title")} aria-label="Chart title" />
        <dl className="stats">
          <div>
            <dt>People</dt>
            <dd>{people.length}</dd>
          </div>
          <div>
            <dt>Affected</dt>
            <dd>{affected}</dd>
          </div>
          <div>
            <dt>Variant carriers</dt>
            <dd>{carriers}</dd>
          </div>
        </dl>
        <p className="muted-line">Select a person or a relationship line to edit it.</p>
      </div>

      <Section title="Record">
        <div className="grid2">
          <Field label="Date taken">
            <input value={doc.meta.date} onChange={(e) => setMeta("date", e.target.value)} />
          </Field>
          <Field label="Recorded by">
            <input value={doc.meta.recordedBy} placeholder="Clinician" onChange={(e) => setMeta("recordedBy", e.target.value)} />
          </Field>
        </div>
        <Field label="Informant">
          <input value={doc.meta.informant} placeholder="Who gave the history" onChange={(e) => setMeta("informant", e.target.value)} />
        </Field>
        <Field label="Reason for referral">
          <input value={doc.meta.reason} placeholder="Indication" onChange={(e) => setMeta("reason", e.target.value)} />
        </Field>
      </Section>

      <Section title="Show on chart">
        <div className="toggle-grid">
          {display.map(([k, label]) => (
            <Toggle key={k} checked={doc.display[k]} onChange={(v) => setDisplay(k, v)} label={label} />
          ))}
        </div>
      </Section>

      <TraitsManager doc={doc} />
    </div>
  );
}

function TraitsManager({ doc }: { doc: PedigreeDoc }) {
  const commit = useStore((s) => s.commit);
  const traits = Object.values(doc.traits);
  const usage = (t: Trait) => Object.values(doc.people).filter((p) => p.conditions.some((c) => c.traitId === t.id)).length;
  const setT = (id: string, fn: (t: Trait) => void, key?: string) => commit((d) => fn(d.traits[id] as Trait), key);
  return (
    <Section
      title="Conditions key"
      action={
        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            commit((d) => {
              const id = uid("tr");
              d.traits[id] = { id, name: "New condition", color: TRAIT_COLORS[Object.keys(d.traits).length % TRAIT_COLORS.length], pattern: "solid", inheritance: "" };
            })
          }
        >
          <Plus size={14} /> Add
        </button>
      }
    >
      {traits.length === 0 && <p className="muted-line">Cancers are built in. Add other conditions here or from a person’s panel.</p>}
      {traits.map((t) => (
        <div key={t.id} className="trait-row">
          <label className="color-dot" style={{ background: t.color }} title="Colour">
            <input type="color" value={t.color} onChange={(e) => setT(t.id, (x) => void (x.color = e.target.value), `tc-${t.id}`)} />
          </label>
          <input className="trait-name" value={t.name} onChange={(e) => setT(t.id, (x) => void (x.name = e.target.value), `tn-${t.id}`)} />
          <select value={t.pattern} onChange={(e) => setT(t.id, (x) => void (x.pattern = e.target.value as Trait["pattern"]))} title="Fill pattern for print">
            {PATTERNS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <input className="inh-in" value={t.inheritance} placeholder="AD/AR" title="Inheritance" onChange={(e) => setT(t.id, (x) => void (x.inheritance = e.target.value), `ti-${t.id}`)} />
          <button
            className="icon-btn icon-btn-sm"
            title={usage(t) ? `Used by ${usage(t)} — removing clears it from them` : "Remove"}
            onClick={() =>
              commit((d) => {
                delete d.traits[t.id];
                for (const p of Object.values(d.people)) p.conditions = p.conditions.filter((c) => c.traitId !== t.id);
              })
            }
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </Section>
  );
}
