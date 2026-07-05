import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { RGBA, StyledText } from "@opentui/core";

const IMAGE_API_URL = "https://tokenhub.tencentmaas.com/v1/api/image/lite";
const IMG_DIR = path.join(process.cwd(), "img");

export async function generateWordImage(
  word: string,
  translation: string
): Promise<string> {
  const response = await fetch(IMAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SENTENCE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "hy-image-lite",
      prompt: `A minimalist cartoon illustration that visually represents the concept of "${word}" (meaning: ${translation}). Use clear visual elements, objects and symbols to show the meaning. Clean composition, simple shapes, bright colors, white or light background. Do not draw any text, letters, words, numbers, labels, or watermarks.`,
      rsp_img_type: "url",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Image API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { data?: { url?: string }[] };
  const url = data.data?.[0]?.url;
  if (!url) {
    throw new Error("No image URL returned");
  }
  return url;
}

export async function downloadImage(url: string, word: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(IMG_DIR, { recursive: true });
  const filePath = path.join(IMG_DIR, `${word}-${Date.now()}.jpg`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export async function renderImageToTerminal(
  url: string,
  maxColumns: number
): Promise<StyledText> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  const img = sharp(buffer);
  const metadata = await img.metadata();
  const originalWidth = metadata.width || 1;
  const originalHeight = metadata.height || 1;

  const targetWidth = Math.min(maxColumns, originalWidth);
  // 终端字符高宽比约 2:1，半块字符每格显示上下两个像素，所以高度按 1:1 换算
  const targetHeight = Math.max(2, Math.round((targetWidth * originalHeight) / originalWidth));
  const evenHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1;

  const { data, info } = await img
    .resize(targetWidth, evenHeight, { fit: "fill" })
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const chunks: { __isChunk: true; text: string; fg?: RGBA; bg?: RGBA }[] = [];
  for (let y = 0; y < info.height; y += 2) {
    for (let x = 0; x < info.width; x++) {
      const upperIdx = (y * info.width + x) * 4;
      const lowerIdx = ((y + 1) * info.width + x) * 4;

      const upper = rgbToHex(data[upperIdx]!, data[upperIdx + 1]!, data[upperIdx + 2]!);
      const lower = rgbToHex(data[lowerIdx]!, data[lowerIdx + 1]!, data[lowerIdx + 2]!);

      chunks.push({
        __isChunk: true,
        text: "▀",
        fg: RGBA.fromHex(upper),
        bg: RGBA.fromHex(lower),
      });
    }
    chunks.push({ __isChunk: true, text: "\n" });
  }

  return new StyledText(chunks);
}

export function openImage(filePath: string) {
  const platform = process.platform;
  const command =
    platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  const { spawn } = require("child_process");
  spawn(command, [filePath], { detached: true, stdio: "ignore" });
}
