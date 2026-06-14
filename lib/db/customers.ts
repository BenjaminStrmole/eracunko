import "server-only";

import type { Customer, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getActiveCompany } from "./userSettings";

export type CustomerInput = {
  name?: string;
  vatNumber?: string;
  status?: string;
  eLocation?: string;
  eAddress?: string;
  eAddress1?: string;
  address?: string;
  postCode?: string;
  city?: string;
  country?: string;
  format?: string;
  isFavorite?: boolean;
  [key: string]: unknown;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeVat(value: unknown) {
  return clean(value).replace(/\s/g, "").toUpperCase();
}

function jsonData(data: CustomerInput): Prisma.InputJsonObject {
  return data as Prisma.InputJsonObject;
}

async function findActiveCompanyId() {
  const activeCompany = await getActiveCompany().catch(() => null);
  const taxId = normalizeVat(activeCompany?.vatNumber || activeCompany?.taxId);

  if (!taxId) return null;

  const company = await prisma.company.findFirst({
    where: {
      OR: [{ vatNumber: taxId }, { taxId }],
    },
    select: { id: true },
  });

  return company?.id || null;
}

export function serializeCustomer(customer: Customer) {
  const data =
    typeof customer.data === "object" && customer.data !== null && !Array.isArray(customer.data)
      ? (customer.data as Record<string, unknown>)
      : {};

  return {
    ...data,
    dbId: customer.id,
    name: customer.name,
    vatNumber: customer.vatNumber,
    status: customer.status || "NOT_READY",
    eLocation: customer.eLocation || "",
    eAddress: customer.eAddress || "",
    address: customer.address || "",
    postCode: customer.postCode || "",
    city: customer.city || "",
    country: customer.country || "",
    format: customer.format || "",
    isFavorite: customer.isFavorite,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export async function listCustomers(userId: string) {
  return prisma.customer.findMany({
    where: { userId },
    orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
  });
}

export async function upsertCustomer(userId: string, input: CustomerInput) {
  const vatNumber = normalizeVat(input.vatNumber);

  if (!vatNumber) {
    throw new Error("CUSTOMER_VAT_REQUIRED");
  }

  const companyId = await findActiveCompanyId();
  const data = {
    ...input,
    vatNumber,
  };

  return prisma.customer.upsert({
    where: {
      userId_vatNumber: {
        userId,
        vatNumber,
      },
    },
    update: {
      companyId,
      name: clean(input.name) || vatNumber,
      status: clean(input.status),
      eLocation: clean(input.eLocation),
      eAddress: clean(input.eAddress || input.eAddress1),
      address: clean(input.address),
      postCode: clean(input.postCode),
      city: clean(input.city),
      country: clean(input.country),
      format: clean(input.format),
      isFavorite: Boolean(input.isFavorite),
      data: jsonData(data),
    },
    create: {
      userId,
      companyId,
      name: clean(input.name) || vatNumber,
      vatNumber,
      status: clean(input.status),
      eLocation: clean(input.eLocation),
      eAddress: clean(input.eAddress || input.eAddress1),
      address: clean(input.address),
      postCode: clean(input.postCode),
      city: clean(input.city),
      country: clean(input.country),
      format: clean(input.format),
      isFavorite: Boolean(input.isFavorite),
      data: jsonData(data),
    },
  });
}

export async function deleteCustomer(userId: string, vatNumber: string) {
  return prisma.customer.delete({
    where: {
      userId_vatNumber: {
        userId,
        vatNumber: normalizeVat(vatNumber),
      },
    },
  });
}
