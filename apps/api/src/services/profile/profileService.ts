import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/apiError";

export const MAX_PROFILES_PER_USER = 5;

const PROFILE_SELECT = {
  id: true,
  userId: true,
  name: true,
  avatarUrl: true,
  maturitySettings: true,
  isKidsProfile: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listProfiles(userId: string) {
  return prisma.profile.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: PROFILE_SELECT,
  });
}

export async function getProfileForUser(userId: string, profileId: string) {
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
    select: PROFILE_SELECT,
  });
  if (!profile) throw ApiError.notFound("Profile not found");
  return profile;
}

export async function createProfile(
  userId: string,
  input: {
    name: string;
    avatarUrl?: string | null;
    maturitySettings?: string | null;
    isKidsProfile?: boolean;
  },
) {
  const count = await prisma.profile.count({ where: { userId } });
  if (count >= MAX_PROFILES_PER_USER) {
    throw ApiError.badRequest(
      `Maximum of ${MAX_PROFILES_PER_USER} profiles allowed`,
    );
  }

  return prisma.profile.create({
    data: {
      userId,
      name: input.name.trim(),
      avatarUrl: input.avatarUrl ?? null,
      maturitySettings: input.maturitySettings ?? null,
      isKidsProfile: input.isKidsProfile ?? false,
    },
    select: PROFILE_SELECT,
  });
}

export async function updateProfile(
  userId: string,
  profileId: string,
  patch: {
    name?: string;
    avatarUrl?: string | null;
    maturitySettings?: string | null;
    isKidsProfile?: boolean;
  },
) {
  await getProfileForUser(userId, profileId);

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.avatarUrl !== undefined) data.avatarUrl = patch.avatarUrl;
  if (patch.maturitySettings !== undefined)
    data.maturitySettings = patch.maturitySettings;
  if (patch.isKidsProfile !== undefined) data.isKidsProfile = patch.isKidsProfile;

  if (Object.keys(data).length === 0) {
    return getProfileForUser(userId, profileId);
  }

  return prisma.profile.update({
    where: { id: profileId },
    data,
    select: PROFILE_SELECT,
  });
}

export async function deleteProfile(userId: string, profileId: string) {
  await getProfileForUser(userId, profileId);

  const remaining = await prisma.profile.count({ where: { userId } });
  if (remaining <= 1) {
    throw ApiError.badRequest(
      "You must keep at least one profile on your account.",
    );
  }

  await prisma.profile.delete({ where: { id: profileId } });
}
