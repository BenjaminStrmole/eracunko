import type { InvoiceProfile, VatCategory } from "../types/invoice";

const ZERO_RATE_CATEGORIES = new Set<VatCategory>(["Z", "E", "AE", "G", "O", "K", "IC"]);

export type ELocationSuggestion = {
  value: string;
  schemeId: "9934" | "9949";
};

function compact(value: unknown) {
  return String(value ?? "").trim().replace(/\s/g, "").toUpperCase();
}

export function suggestELocation(
  taxIdentifier: string,
  country?: string
): ELocationSuggestion | null {
  const normalized = compact(taxIdentifier).replace(/^C:/, "");
  const countryCode = compact(country);

  if (/^SI\d{8}$/.test(normalized) || (/^\d{8}$/.test(normalized) && countryCode !== "HR")) {
    const digits = normalized.replace(/^SI/, "");
    return { value: `SI${digits}`, schemeId: "9949" };
  }

  if (/^HR\d{11}$/.test(normalized) || (/^\d{11}$/.test(normalized) && countryCode !== "SI")) {
    return { value: normalized.replace(/^HR/, ""), schemeId: "9934" };
  }

  return null;
}

export function applyELocationSuggestion(
  currentValue: string,
  suggestion: ELocationSuggestion | null,
  confirmed = false
) {
  if (currentValue.trim() && !confirmed) return currentValue;
  return suggestion?.value || currentValue;
}

export function suggestVatRate({
  profile,
  category,
  currentRate,
  manuallyChanged,
}: {
  profile: InvoiceProfile;
  category: VatCategory;
  currentRate: number;
  manuallyChanged: boolean;
}) {
  if (manuallyChanged) return currentRate;
  if (ZERO_RATE_CATEGORIES.has(category)) return 0;
  if (category === "S") return profile === "hr" ? 25 : 22;
  return currentRate;
}

export function vatRateWarning(
  profile: InvoiceProfile,
  category: VatCategory,
  rate: number
) {
  if (!Number.isFinite(rate)) return "";
  if (ZERO_RATE_CATEGORIES.has(category) && rate !== 0) {
    return `Kategorija ${category} običajno uporablja 0 % DDV.`;
  }
  if (category === "S" && profile === "hr" && rate !== 25) {
    return "Za Hrvaško standardno stopnjo DDV običajno uporabite 25 %.";
  }
  if (category === "S" && profile !== "hr" && rate !== 22) {
    return "Za Slovenijo standardno stopnjo DDV običajno uporabite 22 %.";
  }
  return "";
}
