import type { RecipientCheck, RecipientCheckStatus } from "../../types/invoice";

type RecipientLookupResponse = {
  success?: boolean;
  status?: string;
  message?: string;
  customer?: {
    eLocation?: string;
    eAddress?: string;
  };
};

function compact(value: unknown) {
  return String(value ?? "").trim().replace(/\s/g, "").toUpperCase();
}

export function recipientLookupIdentifier({
  vatNumber,
  eLocation,
  country,
}: {
  vatNumber?: string;
  eLocation?: string;
  country?: string;
}) {
  const source = compact(vatNumber || eLocation).replace(/^C:/, "").replace(/^\d{4}:/, "");
  if (/^[A-Z]{2}/.test(source)) return source;
  if (compact(country) === "HR" && /^\d{11}$/.test(source)) return `HR${source}`;
  if (compact(country || "SI") === "SI" && /^\d{8}$/.test(source)) return `SI${source}`;
  return source;
}

export function mapRecipientLookupResponse(
  data: RecipientLookupResponse,
  identifier: string
): RecipientCheck {
  if (data.success && data.status === "READY") {
    return {
      status: "enabled",
      identifier,
      message: "Prejemnik sprejema eRačune",
      checkedAt: new Date().toISOString(),
      eLocation: data.customer?.eLocation,
      eAddress: data.customer?.eAddress,
    };
  }

  if (data.status === "NOT_REGISTERED" || /ni najdeno|ne prejema/i.test(data.message || "")) {
    return {
      status: "disabled",
      identifier,
      message: "Prejemnik ni registriran za prejem eRačunov",
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    status: "unavailable",
    identifier,
    message: "Preverjanje ni uspelo / ni mogoče preveriti",
    checkedAt: new Date().toISOString(),
  };
}

export async function checkRecipientEligibility(input: {
  vatNumber?: string;
  eLocation?: string;
  country?: string;
}): Promise<RecipientCheck> {
  const identifier = recipientLookupIdentifier(input);
  if (!identifier) {
    return mapRecipientLookupResponse(
      { success: false, status: "INVALID_INPUT" },
      identifier
    );
  }

  try {
    const response = await fetch(
      `/api/bizbox/search-company?vatNumber=${encodeURIComponent(identifier)}`,
      { cache: "no-store" }
    );
    const data = (await response.json()) as RecipientLookupResponse;
    return mapRecipientLookupResponse(data, identifier);
  } catch {
    return mapRecipientLookupResponse({ success: false }, identifier);
  }
}

export function recipientStatusMeta(status: RecipientCheckStatus) {
  if (status === "enabled") return { icon: "🟢", className: "text-emerald-600" };
  if (status === "disabled") return { icon: "🔴", className: "text-red-500" };
  if (status === "checking") return { icon: "🟡", className: "text-amber-600" };
  if (status === "unavailable") return { icon: "🟡", className: "text-amber-600" };
  return { icon: "", className: "app-muted" };
}
