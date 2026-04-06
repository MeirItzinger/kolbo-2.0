import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/vtt/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const track = await prisma.subtitleTrack.findUnique({
    where: { id },
    select: { vttContent: true, languageCode: true },
  });

  if (!track || !track.vttContent) {
    res.status(404).send("Not found");
    return;
  }

  res.setHeader("Content-Type", "text/vtt; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(track.vttContent);
});

export default router;
