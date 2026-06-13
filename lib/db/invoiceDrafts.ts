import "server-only";

import { Prisma, type InvoiceDraft } from "@prisma/client";
import { prisma } from "./prisma";
import { getActiveCompany, type StoredActiveCompany } from "./userSettings";

type DraftParty = {
  name?: string;
  vat?: string;
  taxId?: string;
  address?: string;
  postCode?: string;
  city?: string;
  country?: string;
  eLocation?: string;
  eAddress?: string;
  registrationNumber?: string;
};

type DraftPayload = {
  id?: string | number;
  number?: string;
  profile?: string;
  buyer?: DraftParty;
  seller?: DraftParty;
  totals?: {
    gross?: number;
    payable?: number;
  };
  currency?: string;
};

type SaveInvoiceDraftInput = {
  id?: string;
  userId: string;
  companyId?: string;
  data: DraftPayload & Record<string, unknown>;
};

function normalizeTaxId(value?: string | null) {
  return String(value || "").replace(/\s/g, "").toUpperCase();
}

function jsonData(data: Record<string, unknown>): Prisma.InputJsonObject {
  return data as Prisma.InputJsonObject;
}

function decimalOrUndefined(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return new Prisma.Decimal(value);
}

function companyFromDraft(
  activeCompany: StoredActiveCompany | null,
  draft: DraftPayload
) {
  const seller = draft.seller || {};
  const taxId = normalizeTaxId(
    activeCompany?.vatNumber ||
      activeCompany?.taxId ||
      seller.vat ||
      seller.taxId
  );

  return {
    name: activeCompany?.name || seller.name || "Neznano podjetje",
    vatNumber: activeCompany?.vatNumber || seller.vat || taxId || undefined,
    taxId: activeCompany?.taxId || seller.taxId || taxId || undefined,
    registrationNumber: seller.registrationNumber || undefined,
    eLocation: activeCompany?.eLocation || seller.eLocation || undefined,
    eAddress: activeCompany?.eAddress || seller.eAddress || undefined,
    address: activeCompany?.address || seller.address || undefined,
    postCode: activeCompany?.postCode || seller.postCode || undefined,
    city: activeCompany?.city || seller.city || undefined,
    country: activeCompany?.country || seller.country || "SI",
  };
}

async function getOrCreateDraftCompany(
  userId: string,
  draft: DraftPayload,
  companyId?: string
) {
  if (companyId) {
    return prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  }

  const activeCompany = await getActiveCompany().catch(() => null);
  const companyData = companyFromDraft(activeCompany, draft);
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

export async function listInvoiceDrafts(userId: string, companyId?: string) {
  return prisma.invoiceDraft.findMany({
    where: {
      userId,
      ...(companyId ? { companyId } : {}),
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getInvoiceDraft(id: string) {
  return prisma.invoiceDraft.findUnique({
    where: { id },
  });
}

export async function saveInvoiceDraft({
  id,
  userId,
  companyId,
  data,
}: SaveInvoiceDraftInput): Promise<InvoiceDraft> {
  const company = await getOrCreateDraftCompany(userId, data, companyId);
  const grossAmount = decimalOrUndefined(data.totals?.gross || data.totals?.payable);
  const payload = jsonData(data);

  const draftData = {
    userId,
    companyId: company.id,
    documentNumber: data.number || null,
    profile: data.profile || null,
    buyerName: data.buyer?.name || null,
    buyerVat: data.buyer?.vat || data.buyer?.taxId || null,
    grossAmount,
    currency: data.currency || "EUR",
    data: payload,
  };

  if (id) {
    return prisma.invoiceDraft.update({
      where: { id },
      data: draftData,
    });
  }

  return prisma.invoiceDraft.create({
    data: draftData,
  });
}

export async function deleteInvoiceDraft(id: string) {
  return prisma.invoiceDraft.delete({
    where: { id },
  });
}
