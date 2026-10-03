import type { Sex } from "../model/types";

export function SexIcon({ sex, size = 14, filled = false }: { sex: Sex | "loss" | "pregnancy" | "stillbirth" | "top"; size?: number; filled?: boolean }) {
  const s = size;
  const sw = 1.6;
  const fill = filled ? "currentColor" : "none";
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true" className="sex-icon">
      {sex === "male" && <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1.2" fill={fill} stroke="currentColor" strokeWidth={sw} />}
      {sex === "female" && <circle cx="8" cy="8" r="6" fill={fill} stroke="currentColor" strokeWidth={sw} />}
      {sex === "unknown" && <path d="M8 1.6L14.4 8L8 14.4L1.6 8Z" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />}
      {sex === "loss" && <path d="M8 3L14 13H2Z" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />}
      {sex === "top" && (
        <>
          <path d="M8 3L14 13H2Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
          <path d="M2 15L14 1" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
        </>
      )}
      {sex === "pregnancy" && (
        <>
          <path d="M8 1.6L14.4 8L8 14.4L1.6 8Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
          <text x="8" y="10.6" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor">
            P
          </text>
        </>
      )}
      {sex === "stillbirth" && (
        <>
          <path d="M8 1.6L14.4 8L8 14.4L1.6 8Z" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinejoin="round" />
          <path d="M1.5 14.5L14.5 1.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function TwinIcon({ kind, size = 14 }: { kind: "mz" | "dz"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2L3 14M8 2L13 14" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {kind === "mz" && <path d="M5.5 8H10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
    </svg>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2.5" y="3.5" width="10" height="10" rx="1.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="24" cy="8.5" r="5.3" fill="var(--accent)" stroke="currentColor" strokeWidth="2" />
      <path d="M12.5 8.5H18.7M15.6 8.5V18.5M9 18.5H22.5M9 18.5V21.5M22.5 18.5V21.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="9" cy="26" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="18.3" y="21.8" width="8.4" height="8.4" rx="1.2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
