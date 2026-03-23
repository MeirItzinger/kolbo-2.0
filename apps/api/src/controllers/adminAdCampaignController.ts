import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { status, advertiserId } = req.query;

  const where: Record<string, unknown> = {};
  if (status) where.status = status as string;
  if (advertiserId) where.advertiserId = advertiserId as string;

  const campaigns = await prisma.adCampaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      advertiser: {
        select: {
          id: true,
          email: true,
          companyName: true,
          contactName: true,
          phone: true,
        },
      },
      geoTargets: true,
      creatives: true,
      _count: { select: { dailyCharges: true } },
    },
  });

  res.json({ status: "success", data: campaigns });
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: req.params.id },
    include: {
      advertiser: {
        select: {
          id: true,
          email: true,
          companyName: true,
          contactName: true,
          phone: true,
        },
      },
      geoTargets: true,
      creatives: true,
      dailyCharges: { orderBy: { date: "desc" }, take: 30 },
    },
  });

  if (!campaign) throw ApiError.notFound("Campaign not found");

  res.json({ status: "success", data: campaign });
});

export const patch = asyncHandler(async (req: Request, res: Response) => {
  const { pricePerViewUsd } = req.body as {
    pricePerViewUsd?: string | number | null;
  };

  const existing = await prisma.adCampaign.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) throw ApiError.notFound("Campaign not found");

  const data: { pricePerViewUsd?: Prisma.Decimal | null } = {};

  if (pricePerViewUsd !== undefined) {
    if (pricePerViewUsd === null || pricePerViewUsd === "") {
      data.pricePerViewUsd = null;
    } else {
      const dec = new Prisma.Decimal(String(pricePerViewUsd));
      if (dec.lt(0)) throw ApiError.badRequest("pricePerViewUsd must be >= 0");
      data.pricePerViewUsd = dec;
    }
  }

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest("No updatable fields provided");
  }

  const updated = await prisma.adCampaign.update({
    where: { id: req.params.id },
    data,
    include: {
      advertiser: {
        select: {
          id: true,
          email: true,
          companyName: true,
          contactName: true,
          phone: true,
        },
      },
      geoTargets: true,
      creatives: true,
      _count: { select: { dailyCharges: true } },
    },
  });

  res.json({ status: "success", data: updated });
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await prisma.adCampaign.findUnique({
    where: { id: req.params.id },
  });

  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (campaign.status !== "PENDING_REVIEW") {
    throw ApiError.badRequest("Can only approve campaigns in PENDING_REVIEW");
  }

  const updated = await prisma.adCampaign.update({
    where: { id: req.params.id },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedBy: req.user!.id,
      rejectionReason: null,
    },
    include: {
      advertiser: {
        select: { id: true, email: true, companyName: true },
      },
      geoTargets: true,
      creatives: true,
    },
  });

  res.json({ status: "success", data: updated });
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: req.params.id },
  });

  if (!campaign) throw ApiError.notFound("Campaign not found");
  if (campaign.status !== "PENDING_REVIEW") {
    throw ApiError.badRequest("Can only reject campaigns in PENDING_REVIEW");
  }

  const updated = await prisma.adCampaign.update({
    where: { id: req.params.id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedBy: req.user!.id,
      rejectionReason: reason || null,
    },
    include: {
      advertiser: {
        select: { id: true, email: true, companyName: true },
      },
      geoTargets: true,
      creatives: true,
    },
  });

  res.json({ status: "success", data: updated });
});
