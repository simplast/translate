import { createOpenAI } from "@ai-sdk/openai";
import { config, assertChatConfig } from "./config";

// Reusable OpenAI-compatible chat providers (one per endpoint).
// Both translate and examples use streamText from Vercel AI SDK,
// so we just need to expose ready-made chat models.

function makeChat(baseURL: string, apiKey: string, model: string) {
  const provider = createOpenAI({ baseURL, apiKey });
  return provider.chat(model);
}

let translateModel: ReturnType<typeof makeChat> | null = null;
let examplesModel: ReturnType<typeof makeChat> | null = null;

export function getTranslateModel() {
  if (translateModel) return translateModel;
  assertChatConfig(config.translate, "translate");
  translateModel = makeChat(
    config.translate.baseURL,
    config.translate.apiKey,
    config.translate.model,
  );
  return translateModel;
}

export function getExamplesModel() {
  if (examplesModel) return examplesModel;
  assertChatConfig(config.examples, "examples");
  examplesModel = makeChat(
    config.examples.baseURL,
    config.examples.apiKey,
    config.examples.model,
  );
  return examplesModel;
}
