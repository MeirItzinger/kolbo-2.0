import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

const SETTINGS_ID = "singleton";

async function getOrCreateSettings() {
  let row = await prisma.advertiserPlatformSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (!row) {
    row = await prisma.advertiserPlatformSettings.create({
      data: {
        id: SETTINGS_ID,
        defaultPricePerViewUsd: new Prisma.Decimal("0.01"),
      },
    });
  }
  return row;
}

export const getPlatformSettings = asyncHandler(
  async (_req: Request, res: Response) => {
    const settings = await getOrCreateSettings();
    res.json({
      status: "success",
      data: {
        defaultPricePerViewUsd: settings.defaultPricePerViewUsd.toString(),
      },
    });
  },
);

export const updatePlatformSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const { defaultPricePerViewUsd } = req.body as {
      defaultPricePerViewUsd?: string | number;
    };
    if (defaultPricePerViewUsd === undefined || defaultPricePerViewUsd === "") {
      throw ApiError.badRequest("defaultPricePerViewUsd is required");
    }
    const dec = new Prisma.Decimal(String(defaultPricePerViewUsd));
    if (dec.lt(0)) {
      throw ApiError.badRequest("defaultPricePerViewUsd must be >= 0");
    }

    const settings = await prisma.advertiserPlatformSettings.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        defaultPricePerViewUsd: dec,
      },
      update: { defaultPricePerViewUsd: dec },
    });

    res.json({
      status: "success",
      data: {
        defaultPricePerViewUsd: settings.defaultPricePerViewUsd.toString(),
      },
    });
  },
);

export const listAdvertisers = asyncHandler(
  async (_req: Request, res: Response) => {
    const advertisers = await prisma.advertiser.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        campaigns: {
          orderBy: { createdAt: "desc" },
          include: {
            geoTargets: true,
            creatives: true,
            _count: { select: { dailyCharges: true } },
          },
        },
        _count: { select: { campaigns: true } },
      },
    });

    res.json({ status: "success", data: advertisers });
  },
);

export const getAdvertiser = asyncHandler(async (req: Request, res: Response) => {
  const advertiser = await prisma.advertiser.findUnique({
    where: { id: req.params.id },
    include: {
      campaigns: {
        orderBy: { createdAt: "desc" },
        include: {
          geoTargets: true,
          creatives: true,
          dailyCharges: { orderBy: { date: "desc" }, take: 14 },
          _count: { select: { dailyCharges: true } },
        },
      },
    },
  });

  if (!advertiser) throw ApiError.notFound("Advertiser not found");

  res.json({ status: "success", data: advertiser });
});
