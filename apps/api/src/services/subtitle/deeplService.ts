import * as deepl from "deepl-node";
import { env } from "../../config/env";

let translator: deepl.Translator | null = null;

function getTranslator(): deepl.Translator {
  if (!translator) {
    if (!env.DEEPL_API_KEY) {
      throw new Error("DEEPL_API_KEY is not configured");
    }
    translator = new deepl.Translator(env.DEEPL_API_KEY);
  }
  return translator;
}

interface VttBlock {
  index: string;
  timestamp: string;
  text: string;
}

function parseVtt(vtt: string): { header: string; blocks: VttBlock[] } {
  const lines = vtt.replace(/\r\n/g, "\n").split("\n");
  const headerLines: string[] = [];
  let i = 0;

  // Collect header (WEBVTT line + any metadata before the first cue)
  while (i < lines.length) {
    if (/^\d+$/.test(lines[i].trim()) && i + 1 < lines.length && lines[i + 1].includes("-->")) {
      break;
    }
    if (lines[i].includes("-->")) {
      break;
    }
    headerLines.push(lines[i]);
    i++;
  }

  const blocks: VttBlock[] = [];

  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === "") i++;
    if (i >= lines.length) break;

    let index = "";
    if (/^\d+$/.test(lines[i].trim()) && i + 1 < lines.length && lines[i + 1].includes("-->")) {
      index = lines[i].trim();
      i++;
    }

    if (i >= lines.length || !lines[i].includes("-->")) {
      i++;
      continue;
    }

    const timestamp = lines[i];
    i++;

    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      textLines.push(lines[i]);
      i++;
    }

    blocks.push({ index, timestamp, text: textLines.join("\n") });
  }

  return { header: headerLines.join("\n"), blocks };
}

function assembleVtt(header: string, blocks: VttBlock[]): string {
  const parts = [header, ""];

  for (const block of blocks) {
    if (block.index) parts.push(block.index);
    parts.push(block.timestamp);
    parts.push(block.text);
    parts.push("");
  }

  return parts.join("\n");
}

const BATCH_SIZE = 50;

export async function translateVtt(
  vttContent: string,
  targetLang: deepl.TargetLanguageCode = "fr",
): Promise<string> {
  const { header, blocks } = parseVtt(vttContent);

  if (blocks.length === 0) {
    return vttContent;
  }

  const t = getTranslator();
  const translatedBlocks = [...blocks];

  for (let start = 0; start < blocks.length; start += BATCH_SIZE) {
    const batch = blocks.slice(start, start + BATCH_SIZE);
    const textsToTranslate = batch.map((b) => b.text);

    const results = await t.translateText(textsToTranslate, "en", targetLang);

    for (let j = 0; j < results.length; j++) {
      translatedBlocks[start + j] = {
        ...translatedBlocks[start + j],
        text: results[j].text,
      };
    }
  }

  return assembleVtt(header, translatedBlocks);
}
