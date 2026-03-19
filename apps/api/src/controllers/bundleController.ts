import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { active } = req.query;

  const where: Record<string, unknown> = {};
  if (active !== undefined) where.isActive = active === "true";

  const bundles = await prisma.bundle.findMany({
    where,
    orderBy: { price: "asc" },
    include: {
      bundleChannels: {
        include: {
          channel: { select: { id: true, slug: true, name: true, logoUrl: true } },
        },
      },
    },
  });

  res.json({ status: "success", data: bundles });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const {
    slug,
    name,
    description,
    billingInterval,
    concurrencyTier,
    adTier,
    price,
    currency,
    stripeProductId,
    stripePriceId,
    channelIds,
  } = req.body;

  const existing = await prisma.bundle.findUnique({ where: { slug } });
  if (existing) throw ApiError.conflict("A bundle with this slug already exists");

  const bundle = await prisma.$transaction(async (tx) => {
    const created = await tx.bundle.create({
      data: {
        slug,
        name,
        description,
        billingInterval,
        concurrencyTier: concurrencyTier || "STREAMS_3",
        adTier: adTier || "WITHOUT_ADS",
        price,
        currency: currency || "usd",
        stripeProductId,
        stripePriceId,
      },
    });

    if (channelIds?.length) {
      await tx.bundleChannel.createMany({
        data: channelIds.map((channelId: string) => ({
          bundleId: created.id,
          channelId,
        })),
      });
    }

    return created;
  });

  const full = await prisma.bundle.findUnique({
    where: { id: bundle.id },
    include: {
      bundleChannels: {
        include: { channel: { select: { id: true, slug: true, name: true } } },
      },
    },
  });

  res.status(201).json({ status: "success", data: full });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name,
    description,
    concurrencyTier,
    adTier,
    price,
    isActive,
    stripeProductId,
    stripePriceId,
    channelIds,
  } = req.body;

  const bundle = await prisma.bundle.findUnique({ where: { id } });
  if (!bundle) throw ApiError.notFound("Bundle not found");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.bundle.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(concurrencyTier !== undefined && { concurrencyTier }),
        ...(adTier !== undefined && { adTier }),
        ...(price !== undefined && { price }),
        ...(isActive !== undefined && { isActive }),
        ...(stripeProductId !== undefined && { stripeProductId }),
        ...(stripePriceId !== undefined && { stripePriceId }),
      },
    });

    if (channelIds !== undefined) {
      await tx.bundleChannel.deleteMany({ where: { bundleId: id } });
      if (channelIds.length) {
        await tx.bundleChannel.createMany({
          data: channelIds.map((channelId: string) => ({
            bundleId: id,
            channelId,
          })),
        });
      }
    }

    return result;
  });

  const full = await prisma.bundle.findUnique({
    where: { id },
    include: {
      bundleChannels: {
        include: { channel: { select: { id: true, slug: true, name: true } } },
      },
    },
  });

  res.json({ status: "success", data: full });
});
