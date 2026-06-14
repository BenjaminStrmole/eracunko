import "server-only";

import { createHash } from "crypto";
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
  street?: string;
  postCode?: string;
  city?: string;
  country?: string;
  registrationNumber?: string;
  iban?: string;
  bic?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
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

function devLog(message: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[db:userSettings] ${message}`, meta || {});
}

async function getCurrentUserIdentity() {
  const cookieStore = await cookies();
  const username = cookieStore.get("bizbox_username")?.value?.trim();
  if (username) {
    return {
      bizboxUsername: username,
      email: username.includes("@") ? username : undefined,
      source: "bizbox_username",
    };
  }

  const guid = cookieStore.get("bizbox_guid")?.value?.trim();
  if (!guid) return null;

  return {
    bizboxUsername: `bizbox-session:${createHash("sha256")
      .update(guid)
      .digest("hex")
      .slice(0, 32)}`,
    email: undefined,
    source: "bizbox_guid",
  };
}

export async function getOrCreateCurrentUser(): Promise<User> {
  const identity = await getCurrentUserIdentity();

  if (!identity) {
    devLog("no auth identity found");
    throw new Error("UNAUTHENTICATED");
  }

  const existingUser = await prisma.user.findFirst({
    where: { bizboxUsername: identity.bizboxUsername },
  });

  if (existingUser) {
    devLog("user found", { userId: existingUser.id, source: identity.source });
    return existingUser;
  }

  const user = await prisma.user.create({
    data: {
      bizboxUsername: identity.bizboxUsername,
      email: identity.email,
    },
  });

  devLog("user created", { userId: user.id, source: identity.source });
  return user;
}

export async function getUserSettings(): Promise<UserSettings> {
  const user = await getOrCreateCurrentUser();
  const existingSettings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
  });

  if (existingSettings) {
    devLog("settings found", { userId: user.id, settingsId: existingSettings.id });
    return existingSettings;
  }

  const settings = await prisma.userSettings.create({
    data: {
      userId: user.id,
      data: {},
    },
  });

  devLog("settings created", { userId: user.id, settingsId: settings.id });
  return settings;
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

  const updatedSettings = await prisma.userSettings.update({
    where: { id: settings.id },
    data: {
      data: settingsDataToJson(nextData),
    },
  });

  devLog("active company saved", {
    settingsId: settings.id,
    hasActiveCompany: Boolean(activeCompany),
    activeCompanyTaxId: activeCompany?.taxId || activeCompany?.vatNumber || null,
  });

  return updatedSettings;
}
