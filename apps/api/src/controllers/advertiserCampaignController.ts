import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as campaignService from "../services/advertiser/campaignService";

export const adEligibleChannels = asyncHandler(async (_req: Request, res: Response) => {
  const channels = await campaignService.getAdEligibleChannels();
  res.json({ status: "success", data: channels });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const campaigns = await campaignService.listCampaigns(req.advertiser!.id);
  res.json({ status: "success", data: campaigns });
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await campaignService.getCampaign(
    req.params.id,
    req.advertiser!.id
  );
  res.json({ status: "success", data: campaign });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await campaignService.createCampaign(
    req.advertiser!.id,
    req.body
  );
  res.status(201).json({ status: "success", data: campaign });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await campaignService.updateCampaign(
    req.params.id,
    req.advertiser!.id,
    req.body
  );
  res.json({ status: "success", data: campaign });
});

export const submit = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await campaignService.submitForReview(
    req.params.id,
    req.advertiser!.id
  );
  res.json({ status: "success", data: campaign });
});

export const upload = asyncHandler(async (req: Request, res: Response) => {
  const corsOrigin =
    req.body.corsOrigin ||
    req.headers.origin ||
    "http://localhost:5173";

  const result = await campaignService.createAdUpload(
    req.params.id,
    req.advertiser!.id,
    corsOrigin,
    req.body.fileName
  );
  res.json({ status: "success", data: result });
});
