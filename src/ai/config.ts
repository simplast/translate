// Centralized provider configuration.
// All three external calls (translate / examples / image) read from env vars
// so users can swap to any OpenAI-compatible endpoint without touching code.

export type ChatProviderConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
};

export type ImageProviderConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  // Path appended to baseURL. Defaults to OpenAI standard "/images/generations".
  // Tencent uses "/api/image/lite".
  endpoint: string;
  // Vendor-specific response/request shape.
  // "openai" -> standard OpenAI images API
  // "tencent-lite" -> Tencent HY-Image-Lite
  vendor: "openai" | "tencent-lite";
};

export const config = {
  translate: {
    baseURL: process.env.TRANSLATE_BASE_URL ?? "",
    apiKey: process.env.TRANSLATE_API_KEY ?? "",
    model: process.env.TRANSLATE_MODEL ?? "",
  },
  examples: {
    baseURL: process.env.EXAMPLES_BASE_URL ?? "",
    apiKey: process.env.EXAMPLES_API_KEY ?? "",
    model: process.env.EXAMPLES_MODEL ?? "",
  },
  image: {
    baseURL: process.env.IMAGE_BASE_URL ?? "",
    apiKey: process.env.IMAGE_API_KEY ?? "",
    model: process.env.IMAGE_MODEL ?? "",
    endpoint: process.env.IMAGE_ENDPOINT ?? "/images/generations",
    vendor:
      (process.env.IMAGE_VENDOR as "openai" | "tencent-lite" | undefined) ??
      "openai",
  },
} satisfies {
  translate: ChatProviderConfig;
  examples: ChatProviderConfig;
  image: ImageProviderConfig;
};

export function assertChatConfig(
  cfg: ChatProviderConfig,
  name: string,
): void {
  if (!cfg.baseURL || !cfg.apiKey || !cfg.model) {
    throw new Error(
      `Missing ${name} provider config. Check TRANSLATE_* / EXAMPLES_* env vars.`,
    );
  }
}
