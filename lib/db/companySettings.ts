import "server-only";

import type { Company, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  getActiveCompany,
  getOrCreateCurrentUser,
  updateActiveCompany,
  type StoredActiveCompany,
} from "./userSettings";
import { normalizePartyAddress } from "../eslog/normalizeInvoice";

export type CompanySettingsInput = {
  name?: string;
  vatNumber?: string;
  taxId?: string;
  registrationNumber?: string;
  address?: string;
  street?: string;
  postCode?: string;
  city?: string;
  country?: string;
  eLocation?: string;
  eAddress?: string;
  iban?: string;
  bic?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeTaxId(value: unknown) {
  return clean(value).replace(/\s/g, "").toUpperCase();
}

function firstFilled(...values: Array<unknown>) {
  for (const value of values) {
    const cleaned = clean(value);
    if (cleaned) return cleaned;
  }

  return "";
}

function companyKey(input: StoredActiveCompany | CompanySettingsInput | null | undefined) {
  if (!input) return "";
  return normalizeTaxId(input.vatNumber || input.taxId);
}

function toCompanyResponse(company: Company | null, activeCompany: StoredActiveCompany | null) {
  const raw = {
    name: firstFilled(company?.name, activeCompany?.name),
    vatNumber: firstFilled(company?.vatNumber, activeCompany?.vatNumber, activeCompany?.taxId),
    taxId: firstFilled(company?.taxId, activeCompany?.taxId, activeCompany?.vatNumber),
    registrationNumber: firstFilled(company?.registrationNumber, activeCompany?.registrationNumber),
    address: firstFilled(company?.address, activeCompany?.street, activeCompany?.address),
    street: firstFilled(company?.address, activeCompany?.street, activeCompany?.address),
    postCode: firstFilled(company?.postCode, activeCompany?.postCode),
    city: firstFilled(company?.city, activeCompany?.city),
    country: firstFilled(company?.country, activeCompany?.country, "SI"),
    eLocation: firstFilled(company?.eLocation, activeCompany?.eLocation),
    eAddress: firstFilled(company?.eAddress, activeCompany?.eAddress),
    iban: firstFilled(company?.iban, activeCompany?.iban),
    bic: firstFilled(company?.bic, activeCompany?.bic),
    contactName: firstFilled(company?.contactName, activeCompany?.contactName),
    contactEmail: firstFilled(company?.contactEmail, activeCompany?.contactEmail),
    contactPhone: firstFilled(company?.contactPhone, activeCompany?.contactPhone),
    sourceCompanyId: company?.id || null,
  };
  const normalizedAddress = normalizePartyAddress({
    name: raw.name,
    vat: raw.vatNumber,
    taxId: raw.taxId,
    address: raw.address,
    street: raw.street,
    postCode: raw.postCode,
    city: raw.city,
    country: raw.country,
    eLocation: raw.eLocation,
  });
  const merged = {
    ...raw,
    street: normalizedAddress.street || raw.street,
    postCode: normalizedAddress.postCode || raw.postCode,
    city: normalizedAddress.city || raw.city,
    country: normalizedAddress.country || raw.country,
  };

  return {
    ...merged,
    completeForEslog:
      Boolean(merged.name) &&
      Boolean(merged.vatNumber || merged.taxId) &&
      Boolean(merged.street || merged.address) &&
      Boolean(merged.postCode) &&
      Boolean(merged.city) &&
      Boolean(merged.country) &&
      Boolean(merged.eLocation),
  };
}

async function findCompanyForActiveCompany(activeCompany: StoredActiveCompany | null) {
  const taxKey = companyKey(activeCompany);
  if (!taxKey) return null;

  return prisma.company.findFirst({
    where: {
      OR: [
        { vatNumber: taxKey },
        { taxId: taxKey },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCompanySettings() {
  await getOrCreateCurrentUser();
  const activeCompany = await getActiveCompany();
  const company = await findCompanyForActiveCompany(activeCompany);

  return toCompanyResponse(company, activeCompany);
}

export async function updateCompanySettings(input: CompanySettingsInput) {
  const user = await getOrCreateCurrentUser();
  const activeCompany = await getActiveCompany();
  const taxKey = companyKey(input) || companyKey(activeCompany);

  if (!taxKey) {
    throw new Error("COMPANY_TAX_ID_REQUIRED");
  }

  const data: Prisma.CompanyUncheckedCreateInput = {
    name: firstFilled(input.name, activeCompany?.name, "Neznano podjetje"),
    vatNumber: normalizeTaxId(input.vatNumber || activeCompany?.vatNumber || taxKey),
    taxId: normalizeTaxId(input.taxId || input.vatNumber || activeCompany?.taxId || taxKey),
    registrationNumber: clean(input.registrationNumber),
    address: clean(input.street || input.address),
    postCode: clean(input.postCode),
    city: clean(input.city),
    country: clean(input.country || "SI").toUpperCase(),
    eLocation: clean(input.eLocation),
    eAddress: clean(input.eAddress),
    iban: clean(input.iban).replace(/\s/g, "").toUpperCase(),
    bic: clean(input.bic).toUpperCase(),
    contactName: clean(input.contactName),
    contactEmail: clean(input.contactEmail),
    contactPhone: clean(input.contactPhone),
  };

  const existing = await findCompanyForActiveCompany({
    ...activeCompany,
    vatNumber: data.vatNumber || taxKey,
    taxId: data.taxId || taxKey,
  });

  const company = existing
    ? await prisma.company.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.company.create({
        data: {
          ...data,
          users: {
            create: {
              userId: user.id,
              role: "owner",
              isActive: true,
            },
          },
        },
      });

  const mergedActiveCompany: StoredActiveCompany = {
    ...(activeCompany || {}),
    name: data.name,
    vatNumber: data.vatNumber || undefined,
    taxId: data.taxId || data.vatNumber || undefined,
    registrationNumber: data.registrationNumber || undefined,
    address: data.address || undefined,
    street: data.address || undefined,
    postCode: data.postCode || undefined,
    city: data.city || undefined,
    country: data.country || undefined,
    eLocation: data.eLocation || undefined,
    eAddress: data.eAddress || undefined,
    iban: data.iban || undefined,
    bic: data.bic || undefined,
    contactName: data.contactName || undefined,
    contactEmail: data.contactEmail || undefined,
    contactPhone: data.contactPhone || undefined,
  };

  await updateActiveCompany(mergedActiveCompany);

  return toCompanyResponse(company, mergedActiveCompany);
}
