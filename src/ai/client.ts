import { createOpenAI } from "@ai-sdk/openai";
import { MAAS_BASE_URL } from "./config";

export const maas = createOpenAI({
  baseURL: MAAS_BASE_URL,
  apiKey: process.env.MAAS_API_KEY,
});
