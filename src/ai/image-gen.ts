// Image generation API client.
// Supports two vendor shapes via IMAGE_VENDOR env var:
//   - "openai"        : standard OpenAI /v1/images/generations
//   - "tencent-lite"  : Tencent HY-Image-Lite at /v1/api/image/lite

import { config } from "./config";

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1500;

export async function generateImage(
  prompt: string,
  negativePrompt?: string,
): Promise<string> {
  const { baseURL, apiKey, model, endpoint, vendor } = config.image;
  if (!baseURL || !apiKey || !model) {
    throw new Error(
      "Missing image provider config. Check IMAGE_* env vars.",
    );
  }
  const url = `${baseURL}${endpoint}`;

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const body =
        vendor === "tencent-lite"
          ? buildTencentBody(model, prompt, negativePrompt)
          : buildOpenAIBody(model, prompt);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        // 4xx (auth, schema, content policy) won't be fixed by retrying.
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Image API ${response.status}: ${text.slice(0, 200)}`);
        }
        // 5xx / network — retry.
        throw new Error(`Image API ${response.status}: ${text.slice(0, 200)}`);
      }

      const data = (await response.json()) as { data?: { url?: string }[] };
      const imageUrl = data.data?.[0]?.url;
      if (!imageUrl) {
        // Tencent occasionally returns 200 with empty data (rate-limit / transient).
        // Retry after a short backoff.
        throw new Error(
          `Empty image data (attempt ${attempt}/${MAX_RETRIES})`,
        );
      }
      return imageUrl;
    } catch (err: any) {
      lastError = err;
      // 4xx errors are not retryable — bail out immediately.
      const msg = err.message || "";
      if (/Image API 4\d\d:/.test(msg)) break;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }
  throw lastError ?? new Error("Image generation failed");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildOpenAIBody(model: string, prompt: string) {
  return {
    model,
    prompt,
    n: 1,
    response_format: "url",
  };
}

function buildTencentBody(
  model: string,
  prompt: string,
  negativePrompt?: string,
) {
  const body: Record<string, unknown> = {
    model,
    prompt,
    rsp_img_type: "url",
  };
  if (negativePrompt) body.negative_prompt = negativePrompt;
  return body;
}

// Word-specific prompt builder used by the app.
export const IMAGE_PROMPT_TEMPLATE = (word: string) =>
  `A vibrant cartoon illustration showing the concept of "${word}". The main subject fills the entire frame, close-up view, no empty borders or margins. Rich colors, clear details, strong visual impact. Do not draw any text, letters, words, numbers, labels, watermarks, or blank white margins.`;

export const IMAGE_NEGATIVE_PROMPT =
  "white background, empty space, blank margins, borders, padding, white edges, text, letters, words, numbers, watermark";
