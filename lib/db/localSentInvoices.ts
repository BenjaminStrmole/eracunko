import "server-only";

import { Prisma, type LocalSentInvoice } from "@prisma/client";
import { prisma } from "./prisma";
import { getActiveCompany, type StoredActiveCompany } from "./userSettings";

type SentPayload = {
  number?: string;
  docId?: string;
  profile?: string;
  buyer?: {
    name?: string;
    vat?: string;
    taxId?: string;
  };
  seller?: {
    name?: string;
    vat?: string;
    taxId?: string;
    eLocation?: string;
    eAddress?: string;
    address?: string;
    postCode?: string;
    city?: string;
    country?: string;
  };
  totals?: {
    gross?: number;
    payable?: number;
  };
  currency?: string;
  status?: string;
  sentAt?: string;
};

function normalizeTaxId(value?: string | null) {
  return String(value || "").replace(/\s/g, "").toUpperCase();
}

function decimalOrUndefined(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return new Prisma.Decimal(value);
}

function jsonData(data: Record<string, unknown>): Prisma.InputJsonObject {
  return data as Prisma.InputJsonObject;
}

function companyFromInvoice(activeCompany: StoredActiveCompany | null, invoice: SentPayload) {
  const seller = invoice.seller || {};
  const taxId = normalizeTaxId(activeCompany?.vatNumber || activeCompany?.taxId || seller.vat || seller.taxId);

  return {
    name: activeCompany?.name || seller.name || "Neznano podjetje",
    vatNumber: activeCompany?.vatNumber || seller.vat || taxId || undefined,
    taxId: activeCompany?.taxId || seller.taxId || taxId || undefined,
    eLocation: activeCompany?.eLocation || seller.eLocation || undefined,
    eAddress: activeCompany?.eAddress || seller.eAddress || undefined,
    address: activeCompany?.address || seller.address || undefined,
    postCode: activeCompany?.postCode || seller.postCode || undefined,
    city: activeCompany?.city || seller.city || undefined,
    country: activeCompany?.country || seller.country || "SI",
  };
}

async function getOrCreateSentCompany(userId: string, invoice: SentPayload) {
  const activeCompany = await getActiveCompany().catch(() => null);
  const companyData = companyFromInvoice(activeCompany, invoice);
  const taxId = normalizeTaxId(companyData.taxId || companyData.vatNumber);

  const existingCompany = taxId
    ? await prisma.company.findFirst({
        where: {
          OR: [{ taxId }, { vatNumber: taxId }],
        },
      })
    : null;

  const company =
    existingCompany ||
    (await prisma.company.create({
      data: companyData,
    }));

  await prisma.userCompany.upsert({
    where: {
      userId_companyId: {
        userId,
        companyId: company.id,
      },
    },
    update: {},
    create: {
      userId,
      companyId: company.id,
      role: "owner",
    },
  });

  return company;
}

export function serializeLocalSentInvoice(invoice: LocalSentInvoice) {
  const data =
    typeof invoice.data === "object" && invoice.data !== null && !Array.isArray(invoice.data)
      ? (invoice.data as Record<string, unknown>)
      : {};

  return {
    ...data,
    dbId: invoice.id,
    number: (data.number as string | undefined) || invoice.documentNumber || "",
    docId: (data.docId as string | undefined) || invoice.bizboxDocumentId || "",
    status: invoice.status || (data.status as string | undefined) || "",
    sentAt: invoice.sentAt?.toISOString() || (data.sentAt as string | undefined) || "",
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

export async function saveLocalSentInvoice(userId: string, data: SentPayload & Record<string, unknown>) {
  const company = await getOrCreateSentCompany(userId, data);
  const documentNumber = data.number || null;
  const existing = documentNumber
    ? await prisma.localSentInvoice.findFirst({
        where: {
          userId,
          companyId: company.id,
          documentNumber,
        },
      })
    : null;

  const payload = {
    userId,
    companyId: company.id,
    documentNumber,
    bizboxDocumentId: data.docId || null,
    profile: data.profile || null,
    buyerName: data.buyer?.name || null,
    buyerVat: data.buyer?.vat || data.buyer?.taxId || null,
    grossAmount: decimalOrUndefined(data.totals?.gross || data.totals?.payable),
    currency: data.currency || "EUR",
    status: data.status || null,
    sentAt: data.sentAt ? new Date(data.sentAt) : new Date(),
    data: jsonData(data),
  };

  if (existing) {
    return prisma.localSentInvoice.update({
      where: { id: existing.id },
      data: payload,
    });
  }

  return prisma.localSentInvoice.create({ data: payload });
}
