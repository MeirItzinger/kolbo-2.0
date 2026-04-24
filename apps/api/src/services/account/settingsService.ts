import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/apiError";

export async function getAccountSettings(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, requirePinForPurchases: true },
  });

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return {
    requirePinForPurchases: user.requirePinForPurchases,
  };
}

export async function updateAccountSettings(
  userId: string,
  patch: { requirePinForPurchases?: boolean }
) {
  const data: { requirePinForPurchases?: boolean } = {};
  if (typeof patch.requirePinForPurchases === "boolean") {
    data.requirePinForPurchases = patch.requirePinForPurchases;
  }

  if (Object.keys(data).length === 0) {
    return getAccountSettings(userId);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, requirePinForPurchases: true },
  });

  return {
    requirePinForPurchases: updated.requirePinForPurchases,
  };
}
