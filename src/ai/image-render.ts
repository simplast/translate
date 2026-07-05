// Terminal-side image utilities (download, trim, render to ASCII/pixel blocks, open).
// These are vendor-agnostic and work with any image URL or buffer.

import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import sharp from "sharp";
import { RGBA, StyledText } from "@opentui/core";

const IMG_DIR = path.join(process.cwd(), "img");

export async function downloadImage(
  url: string,
  word: string,
  buffer?: Buffer,
): Promise<string> {
  const imgBuffer = buffer || Buffer.from(await (await fetch(url)).arrayBuffer());
  if (!imgBuffer || imgBuffer.length === 0) {
    throw new Error("Empty image buffer");
  }
  const trimmed = await sharp(imgBuffer)
    .trim({ threshold: 20, background: "white" })
    .toBuffer();
  await fs.mkdir(IMG_DIR, { recursive: true });
  const filePath = path.join(IMG_DIR, `${word}-${Date.now()}.jpg`);
  await fs.writeFile(filePath, trimmed);
  return filePath;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export async function renderImageToTerminal(
  input: string | Buffer,
  maxColumns: number,
): Promise<StyledText> {
  let buffer: Buffer;
  if (typeof input === "string") {
    const response = await fetch(input);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    buffer = input;
  }

  const trimmed = await sharp(buffer)
    .trim({ threshold: 20, background: "white" })
    .toBuffer();

  const metadata = await sharp(trimmed).metadata();
  const originalWidth = metadata.width || 1;
  const originalHeight = metadata.height || 1;

  const targetWidth = Math.min(maxColumns, originalWidth);
  const targetHeight = Math.max(
    2,
    Math.round((targetWidth * originalHeight) / originalWidth),
  );
  const evenHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1;

  const { data, info } = await sharp(trimmed)
    .resize(targetWidth, evenHeight, { fit: "fill" })
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const chunks: { __isChunk: true; text: string; fg?: RGBA; bg?: RGBA }[] = [];
  // Clamp to even height so the half-block loop never reads past the buffer.
  const renderHeight = info.height - (info.height % 2);
  for (let y = 0; y < renderHeight; y += 2) {
    for (let x = 0; x < info.width; x++) {
      const upperIdx = (y * info.width + x) * 4;
      const lowerIdx = ((y + 1) * info.width + x) * 4;

      const upper = rgbToHex(
        data[upperIdx]!,
        data[upperIdx + 1]!,
        data[upperIdx + 2]!,
      );
      const lower = rgbToHex(
        data[lowerIdx]!,
        data[lowerIdx + 1]!,
        data[lowerIdx + 2]!,
      );

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
  spawn(command, [filePath], { detached: true, stdio: "ignore" });
}
