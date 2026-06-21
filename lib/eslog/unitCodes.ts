const UNIT_ALIASES: Record<string, string> = {
  KOS: "H87",
  PCS: "H87",
  PIECE: "H87",
  KOM: "H87",
  KOMAD: "H87",
};

const COMMON_UNECE_UNIT_CODES = new Set([
  "C62",
  "DAY",
  "E48",
  "GRM",
  "H87",
  "HUR",
  "KGM",
  "KWH",
  "LTR",
  "MIN",
  "MON",
  "MTR",
  "MTK",
  "MTQ",
  "MWH",
  "SET",
  "TNE",
  "XPK",
]);

export const INVALID_UNIT_CODE_MESSAGE =
  "Enota mere mora biti veljavna UN/ECE Rec 20/21 koda. Za kos uporabite H87.";

export function normalizeUnitCode(value: string | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "H87";
  return UNIT_ALIASES[normalized] || normalized;
}

export function isKnownUneceUnitCode(value: string | undefined) {
  return COMMON_UNECE_UNIT_CODES.has(normalizeUnitCode(value));
}

export function unitCodeWarning(value: string | undefined) {
  if (!String(value || "").trim()) return "";
  return isKnownUneceUnitCode(value) ? "" : INVALID_UNIT_CODE_MESSAGE;
}
