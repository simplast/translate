import { streamText } from "ai";
import { maas } from "./client";
import { MAAS_MODEL } from "./config";

const SYSTEM_PROMPT =
  "你是一个专业翻译助手。自动识别用户输入语言，中文翻译成英文，英文翻译成中文。只返回翻译结果，不要解释，不要输出词性或例句。";

export function translateStream(text: string) {
  const result = streamText({
    model: maas.chat(MAAS_MODEL),
    system: SYSTEM_PROMPT,
    prompt: text,
  });
  return result.textStream;
}
