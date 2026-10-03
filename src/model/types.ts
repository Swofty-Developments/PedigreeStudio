export type Sex = "male" | "female" | "unknown";
export type BirthAssignment = "" | "AMAB" | "AFAB" | "UAAB";
export type Adoption = "none" | "in" | "out";
export type Outcome = "born" | "pregnancy" | "sab" | "top" | "ectopic" | "stillbirth";
export type ArtRole = "none" | "donor" | "surrogate";
export type NoChildren = "none" | "choice" | "infertility";
export type UnionStatus = "partnered" | "separated" | "divorced";
export type Consanguinity = "auto" | "yes" | "no";
export type TwinKind = "mz" | "dz" | "unknown";
export type ConditionStatus = "affected" | "carrier" | "presymptomatic" | "suspected";
export type GeneResult = "pathogenic" | "likely-pathogenic" | "vus" | "likely-benign" | "negative";
export type FillPattern = "solid" | "hatch" | "dots" | "cross" | "stripes";

export interface CancerEntry {
  id: string;
  type: string;
  label?: string;
  age: string;
  note?: string;
}

export interface ConditionEntry {
  id: string;
  traitId: string;
  status: ConditionStatus;
  age: string;
}

export interface GeneEntry {
  id: string;
  gene: string;
  variant: string;
  result: GeneResult;
}

export interface Person {
  id: string;
  sex: Sex;
  assigned: BirthAssignment;
  name: string;
  note: string;
  age: string;
  birth: string;
  deceased: boolean;
  deathAge: string;
  deathCause: string;
  proband: boolean;
  consultand: boolean;
  evaluated: boolean;
  adoption: Adoption;
  outcome: Outcome;
  gestation: string;
  multiple: string;
  art: ArtRole;
  polyps: string;
  cancers: CancerEntry[];
  conditions: ConditionEntry[];
  genes: GeneEntry[];
  ancestry: string[];
  parentUnion: string | null;
  twin: string | null;
  order: number;
  created: number;
}

export interface Union {
  id: string;
  partners: [string, string];
  status: UnionStatus;
  consanguinity: Consanguinity;
  noChildren: NoChildren;
  noChildrenNote: string;
  note: string;
  order: number;
}

export interface TwinGroup {
  id: string;
  kind: TwinKind;
}

export interface Trait {
  id: string;
  name: string;
  color: string;
  pattern: FillPattern;
  inheritance: string;
}

export interface DisplaySettings {
  names: boolean;
  ages: boolean;
  ids: boolean;
  relations: boolean;
  cancers: boolean;
  genes: boolean;
  notes: boolean;
  legend: boolean;
  generations: boolean;
  header: boolean;
}

export interface DocMeta {
  informant: string;
  recordedBy: string;
  date: string;
  reason: string;
  notes: string;
}

export interface PedigreeDoc {
  version: 1;
  id: string;
  title: string;
  created: number;
  updated: number;
  people: Record<string, Person>;
  unions: Record<string, Union>;
  twins: Record<string, TwinGroup>;
  traits: Record<string, Trait>;
  meta: DocMeta;
  display: DisplaySettings;
}

export type Selection = { kind: "person"; id: string } | { kind: "union"; id: string } | null;
