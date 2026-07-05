import { createOpenAI } from "@ai-sdk/openai";

export const sentenceClient = createOpenAI({
  baseURL: "https://tokenhub.tencentmaas.com/v1",
  apiKey: process.env.SENTENCE_API_KEY,
});
