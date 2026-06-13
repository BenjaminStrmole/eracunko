import "server-only";

import { cookies } from "next/headers";
import type { Prisma, User, UserSettings } from "@prisma/client";
import { prisma } from "./prisma";

export type StoredActiveCompany = {
  name?: string;
  taxId?: string;
  vatNumber?: string;
  locationName?: string;
  locationId?: string;
  eLocation?: string;
  eAddress?: string;
  address?: string;
  postCode?: string;
  city?: string;
  country?: string;
  canSendInvoices?: boolean;
};

type UserSettingsData = {
  activeCompany?: StoredActiveCompany | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSettingsData(data: Prisma.JsonValue | null): UserSettingsData {
  if (!isObject(data)) return {};

  const activeCompany = isObject(data.activeCompany)
    ? (data.activeCompany as StoredActiveCompany)
    : null;

  return {
    ...data,
    activeCompany,
  };
}

function settingsDataToJson(data: UserSettingsData): Prisma.InputJsonObject {
  return data as Prisma.InputJsonObject;
}

async function getCurrentBizboxUsername() {
  const cookieStore = await cookies();
  return cookieStore.get("bizbox_username")?.value?.trim() || null;
}

export async function getOrCreateCurrentUser(): Promise<User> {
  const bizboxUsername = await getCurrentBizboxUsername();

  if (!bizboxUsername) {
    throw new Error("UNAUTHENTICATED");
  }

  const existingUser = await prisma.user.findFirst({
    where: { bizboxUsername },
  });

  if (existingUser) return existingUser;

  return prisma.user.create({
    data: {
      bizboxUsername,
      email: bizboxUsername.includes("@") ? bizboxUsername : undefined,
    },
  });
}

export async function getUserSettings(): Promise<UserSettings> {
  const user = await getOrCreateCurrentUser();

  return prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      data: {},
    },
  });
}

export async function getActiveCompany() {
  const settings = await getUserSettings();
  const data = normalizeSettingsData(settings.data);

  return data.activeCompany || null;
}

export async function updateActiveCompany(activeCompany: StoredActiveCompany | null) {
  const settings = await getUserSettings();
  const currentData = normalizeSettingsData(settings.data);
  const nextData: UserSettingsData = {
    ...currentData,
    activeCompany,
  };

  return prisma.userSettings.update({
    where: { id: settings.id },
    data: {
      data: settingsDataToJson(nextData),
    },
  });
}
