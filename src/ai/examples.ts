import { streamText } from "ai";
import { getExamplesModel } from "./providers";

const EXAMPLE_PROMPT = `请判断用户输入是单词/短语还是完整句子，并按对应格式返回。

如果是单词或短语：
<词性英文缩写>
<原文例句> → <例句翻译>
<原文例句> → <例句翻译>

如果是完整句子：
<句子骨架，用 [词性] 占位符替换核心词汇，保留语法结构>
<按同样语法结构再造一个类似例句> → <翻译>

严格按格式返回，不要添加额外解释，不要输出 label。

示例1：用户输入 "hello"
interj
Hello, nice to meet you. → 你好，很高兴见到你。
Hello, is anyone there? → 你好，有人在吗？

示例2：用户输入 "Hello, nice to meet you."
Hello, [adj] to [v] you.
Goodbye, glad to see you. → 再见，很高兴见到你。`;

export function generateExamplesStream(sourceText: string) {
  const result = streamText({
    model: getExamplesModel(),
    system: EXAMPLE_PROMPT,
    prompt: sourceText,
  });
  return result.textStream;
}
