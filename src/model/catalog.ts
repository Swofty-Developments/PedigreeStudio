import type { ConditionStatus, FillPattern, GeneResult } from "./types";

export interface CancerType {
  id: string;
  name: string;
  short: string;
  color: string;
}

export const CANCERS: CancerType[] = [
  { id: "breast", name: "Breast", short: "Breast", color: "#d9488f" },
  { id: "breast-bilateral", name: "Breast (bilateral)", short: "Bilat. breast", color: "#a8306b" },
  { id: "ovarian", name: "Ovarian / fallopian tube", short: "Ovarian", color: "#1f9e93" },
  { id: "colorectal", name: "Colorectal", short: "Colorectal", color: "#8a5634" },
  { id: "endometrial", name: "Endometrial / uterine", short: "Endometrial", color: "#e07b22" },
  { id: "pancreatic", name: "Pancreatic", short: "Pancreatic", color: "#6a4fc2" },
  { id: "prostate", name: "Prostate", short: "Prostate", color: "#2f66d0" },
  { id: "stomach", name: "Stomach / gastric", short: "Gastric", color: "#c49a12" },
  { id: "melanoma", name: "Melanoma", short: "Melanoma", color: "#3b3548" },
  { id: "brain", name: "Brain / CNS", short: "Brain", color: "#4f7f2a" },
  { id: "kidney", name: "Kidney / renal", short: "Renal", color: "#b33a3a" },
  { id: "thyroid", name: "Thyroid", short: "Thyroid", color: "#2aa3cf" },
  { id: "lung", name: "Lung", short: "Lung", color: "#62748c" },
  { id: "liver", name: "Liver", short: "Liver", color: "#7a3d1c" },
  { id: "bladder", name: "Bladder / urinary tract", short: "Urinary", color: "#c9b02c" },
  { id: "small-bowel", name: "Small bowel", short: "Small bowel", color: "#a87a4a" },
  { id: "leukemia", name: "Leukaemia", short: "Leukaemia", color: "#d1475e" },
  { id: "lymphoma", name: "Lymphoma", short: "Lymphoma", color: "#9c3f8f" },
  { id: "sarcoma", name: "Sarcoma", short: "Sarcoma", color: "#3e8f6b" },
  { id: "testicular", name: "Testicular", short: "Testicular", color: "#4c5fb0" },
  { id: "cervical", name: "Cervical", short: "Cervical", color: "#e05f6f" },
  { id: "esophageal", name: "Oesophageal", short: "Oesophageal", color: "#9a7b2f" },
  { id: "head-neck", name: "Head & neck", short: "Head & neck", color: "#53808a" },
  { id: "other", name: "Other cancer", short: "Cancer", color: "#5c6070" },
];

export const CANCER_BY_ID: Record<string, CancerType> = Object.fromEntries(CANCERS.map((c) => [c.id, c]));

export function cancerInfo(type: string): CancerType {
  return CANCER_BY_ID[type] ?? CANCER_BY_ID.other;
}

export const GENES = [
  "APC", "ATM", "AXIN2", "BAP1", "BARD1", "BMPR1A", "BRCA1", "BRCA2", "BRIP1", "CDH1", "CDK4", "CDKN2A",
  "CHEK2", "CTNNA1", "DICER1", "EPCAM", "FH", "FLCN", "GREM1", "HOXB13", "MEN1", "MET", "MITF", "MLH1",
  "MSH2", "MSH3", "MSH6", "MUTYH", "NBN", "NF1", "NTHL1", "PALB2", "PMS2", "POLD1", "POLE", "PTEN",
  "RAD51C", "RAD51D", "RET", "RNF43", "SDHA", "SDHB", "SDHC", "SDHD", "SMAD4", "STK11", "TP53", "TSC1",
  "TSC2", "VHL", "CFTR", "HBB", "HTT", "DMD", "FMR1", "F8", "F9", "FBN1", "HFE", "SMN1", "GJB2", "HEXA",
  "LDLR", "APOB", "PCSK9", "MYH7", "MYBPC3", "KCNQ1", "KCNH2", "SCN5A", "PKD1", "PKD2", "COL4A5",
];

export const GENE_RESULTS: { id: GeneResult; label: string; short: string; color: string; bg: string }[] = [
  { id: "pathogenic", label: "Pathogenic", short: "+", color: "#b42318", bg: "#fdecea" },
  { id: "likely-pathogenic", label: "Likely pathogenic", short: "LP", color: "#c4400e", bg: "#fdeee5" },
  { id: "vus", label: "Uncertain significance (VUS)", short: "VUS", color: "#8a6100", bg: "#fbf3dc" },
  { id: "likely-benign", label: "Likely benign", short: "LB", color: "#3d6b4f", bg: "#e8f3ec" },
  { id: "negative", label: "Negative / benign", short: "−", color: "#2f6b45", bg: "#e6f2ea" },
];

export const GENE_RESULT_BY_ID = Object.fromEntries(GENE_RESULTS.map((r) => [r.id, r])) as Record<
  GeneResult,
  (typeof GENE_RESULTS)[number]
>;

export const CONDITION_STATUS: { id: ConditionStatus; label: string; hint: string }[] = [
  { id: "affected", label: "Affected", hint: "Filled symbol" },
  { id: "carrier", label: "Carrier", hint: "Dot in the centre" },
  { id: "presymptomatic", label: "Presymptomatic", hint: "Vertical line" },
  { id: "suspected", label: "Suspected", hint: "Question mark" },
];

export const TRAIT_PRESETS: { name: string; inheritance: string }[] = [
  { name: "Cystic fibrosis", inheritance: "AR" },
  { name: "Sickle cell disease", inheritance: "AR" },
  { name: "Huntington disease", inheritance: "AD" },
  { name: "Haemophilia A", inheritance: "XLR" },
  { name: "Duchenne muscular dystrophy", inheritance: "XLR" },
  { name: "Marfan syndrome", inheritance: "AD" },
  { name: "Familial hypercholesterolaemia", inheritance: "AD" },
  { name: "Hereditary haemochromatosis", inheritance: "AR" },
  { name: "Fragile X syndrome", inheritance: "XL" },
  { name: "Polycystic kidney disease", inheritance: "AD" },
  { name: "Hypertrophic cardiomyopathy", inheritance: "AD" },
  { name: "Long QT syndrome", inheritance: "AD" },
  { name: "Spinal muscular atrophy", inheritance: "AR" },
  { name: "Tay-Sachs disease", inheritance: "AR" },
  { name: "Hearing loss", inheritance: "" },
  { name: "Intellectual disability", inheritance: "" },
  { name: "Diabetes", inheritance: "" },
  { name: "Heart disease", inheritance: "" },
];

export const TRAIT_COLORS = [
  "#2f66d0", "#1f9e93", "#d9488f", "#e07b22", "#6a4fc2", "#4f7f2a", "#b33a3a", "#c49a12", "#3b3548", "#2aa3cf",
];

export const PATTERNS: { id: FillPattern; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "hatch", label: "Hatched" },
  { id: "cross", label: "Cross-hatched" },
  { id: "dots", label: "Dotted" },
  { id: "stripes", label: "Striped" },
];

export const ANCESTRIES = [
  "Ashkenazi Jewish",
  "Sephardi Jewish",
  "African",
  "East Asian",
  "South Asian",
  "Southeast Asian",
  "Middle Eastern",
  "Hispanic / Latino",
  "European",
  "Indigenous",
  "Pacific Islander",
  "Mixed / other",
];

export const OUTCOMES = [
  { id: "born", label: "Born" },
  { id: "pregnancy", label: "Pregnancy" },
  { id: "sab", label: "Miscarriage (SAB)" },
  { id: "top", label: "Termination (TOP)" },
  { id: "ectopic", label: "Ectopic (ECT)" },
  { id: "stillbirth", label: "Stillbirth (SB)" },
] as const;
