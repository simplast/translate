import { createSignal, createEffect } from "solid-js";
import { TextAttributes } from "@opentui/core";
import type { InputRenderable } from "@opentui/core";
import { render, useKeyboard, useRenderer } from "@opentui/solid";
import { translateStream } from "./ai/translate";
import { generateExamplesStream } from "./ai/examples";
import { StyledText, TextRenderable } from "@opentui/core";
import {
  generateImage,
  IMAGE_PROMPT_TEMPLATE,
  IMAGE_NEGATIVE_PROMPT,
  downloadImage,
  openImage,
  renderImageToTerminal,
} from "./ai/image";

type Message = {
  type: "user" | "translation" | "image" | "image-hint" | "image-error";
  text: string | StyledText;
};

function isWord(input: string): boolean {
  return /^[a-zA-Z-]+$/.test(input.trim());
}

function groupMessages(messages: Message[]): Message[][] {
  const groups: Message[][] = [];
  let currentGroup: Message[] = [];
  for (const msg of messages) {
    if (msg.type === "user" && currentGroup.length > 0) {
      groups.push(currentGroup);
      currentGroup = [];
    }
    currentGroup.push(msg);
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  return groups;
}

function TerminalImage(props: { styledText: StyledText }) {
  let textRef: TextRenderable | undefined;
  const applyContent = () => {
    if (textRef) {
      textRef.content = props.styledText;
    }
  };
  createEffect(applyContent);
  return <text ref={(el) => { textRef = el; applyContent(); }} wrapMode="none" />;
}

const THEME = {
  primary: "#a882ff",
  secondary: "#50c8c8",
  muted: "#888888",
  text: "#e0e0e0",
  bg: "#0a0a0a",
};

function App() {
  const [history, setHistory] = createSignal<Message[]>([]);
  const [isTranslating, setIsTranslating] = createSignal(false);
  const [resultParts, setResultParts] = createSignal({ translation: "", examples: "" });
  const [currentQuery, setCurrentQuery] = createSignal("");
  const [imageState, setImageState] = createSignal<{ loading: boolean; done: boolean }>({
    loading: false,
    done: false,
  });
  const [lastImagePath, setLastImagePath] = createSignal<string>("");
  const renderer = useRenderer();
  let inputRef: InputRenderable | undefined;

  createEffect(() => {
    const { translation, examples } = resultParts();
    const text = [translation, examples].filter(Boolean).join("\n");
    if (!text) return;
    setHistory((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.type === "translation") {
        next[next.length - 1] = { ...last, text };
      }
      return next;
    });
  });

  createEffect(() => {
    const query = currentQuery();

    if (!query || !isWord(query)) return;
    if (imageState().loading || imageState().done) return;

    setImageState({ loading: true, done: false });

    generateImage(IMAGE_PROMPT_TEMPLATE(query), IMAGE_NEGATIVE_PROMPT)
      .then(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to download image: ${response.status}`);
          }
          const buffer = Buffer.from(await response.arrayBuffer());
          const [filePath, styledText] = await Promise.all([
            downloadImage(url, query, buffer),
            renderImageToTerminal(buffer, 50),
          ]);
          setLastImagePath(filePath);
          const lineCount = styledText.chunks.filter((c) => c.text === "\n").length;
          setHistory((prev) => [
            ...prev,
            { type: "image", text: styledText },
            { type: "image-hint", text: `[${lineCount} lines · 按 ⌃o 查看原图]` },
          ]);
        } catch (err: any) {
          setHistory((prev) => [
            ...prev,
            { type: "image-error", text: `图片渲染失败: ${err.message || String(err)}` },
          ]);
        }
        setImageState({ loading: false, done: true });
      })
      .catch((err: any) => {
        setHistory((prev) => [
          ...prev,
          { type: "image-error", text: `图片生成失败: ${err.message || String(err)}` },
        ]);
        setImageState({ loading: false, done: true });
      });
  });

  const handleSubmit = async (value: string) => {
    const text = value.trim();
    if (!text || isTranslating()) return;

    setIsTranslating(true);
    setResultParts({ translation: "", examples: "" });
    setCurrentQuery(text);
    setImageState({ loading: false, done: false });
    setLastImagePath("");
    setHistory((prev) => [...prev, { type: "user", text }, { type: "translation", text: "" }]);

    if (inputRef) {
      inputRef.value = "";
    }

    const translateTask = async () => {
      try {
        const stream = translateStream(text);
        let translatedText = "";
        for await (const chunk of stream) {
          translatedText += chunk;
          setResultParts((prev) => ({ ...prev, translation: translatedText }));
        }
        if (!translatedText.trim()) {
          setResultParts((prev) => ({ ...prev, translation: "(no translation returned)" }));
        }
      } catch (err: any) {
        setResultParts((prev) => ({ ...prev, translation: `翻译失败: ${err.message || String(err)}` }));
      }
    };

    const examplesTask = async () => {
      try {
        const stream = generateExamplesStream(text);
        let examplesText = "";
        for await (const chunk of stream) {
          examplesText += chunk;
          setResultParts((prev) => ({ ...prev, examples: examplesText }));
        }
        if (!examplesText.trim()) {
          setResultParts((prev) => ({ ...prev, examples: "(no examples returned)" }));
        }
      } catch (err: any) {
        setResultParts((prev) => ({ ...prev, examples: `例句失败: ${err.message || String(err)}` }));
      }
    };

    await Promise.all([translateTask(), examplesTask()]);
    setIsTranslating(false);
  };

  useKeyboard((key) => {
    if (key.name === "escape" || (key.name === "c" && key.ctrl)) {
      renderer.destroy();
      process.exit(0);
    }
    if (key.name === "o" && key.ctrl && lastImagePath()) {
      openImage(lastImagePath());
    }
  });

  const renderContent = (item: Message) => {
    if (item.type === "user") {
      return (
        <text attributes={TextAttributes.BOLD} fg={THEME.text}>
          {item.text as string}
        </text>
      );
    }

    if (item.type === "image") {
      return <TerminalImage styledText={item.text as StyledText} />;
    }

    if (item.type === "image-hint") {
      return (
        <text fg={THEME.muted}>
          {item.text as string}
        </text>
      );
    }

    if (item.type === "image-error") {
      return (
        <text fg="#ff6666">
          {item.text as string}
        </text>
      );
    }

    const fullText = item.text as string;
    const firstLineBreak = fullText.indexOf("\n");
    const transPart = firstLineBreak === -1 ? fullText : fullText.slice(0, firstLineBreak);
    const restPart = firstLineBreak === -1 ? "" : fullText.slice(firstLineBreak + 1);

    if (!restPart.trim()) {
      return (
        <text fg={THEME.text}>
          {transPart}
        </text>
      );
    }

    const restLines = restPart.split("\n").filter((l) => l.trim().length > 0);
    const metaLine = restLines[0] || "";
    const exampleLines = restLines.slice(1);

    return (
      <box flexDirection="column" gap={0}>
        <box flexDirection="row" gap={1}>
          <text fg={THEME.text}>{transPart}</text>
          <text fg={THEME.muted}>{metaLine}</text>
        </box>
        <text>{" "}</text>
        <box flexDirection="column" gap={0}>
          {exampleLines.map((line) => (
            <text fg={THEME.text}>
              {line}
            </text>
          ))}
        </box>
      </box>
    );
  };

  return (
    <box
      flexDirection="column"
      padding={1}
      gap={0}
      height="100%"
      backgroundColor={THEME.bg}
    >
      {/* Header */}
      <box flexDirection="column" padding={1} gap={1} backgroundColor="#1a1a1a">
        <text fg={THEME.primary} attributes={TextAttributes.BOLD}>
          Translate Terminal
        </text>
        <text fg={THEME.muted}>
          Type text and press Enter to translate. ESC or Ctrl+C to quit.
        </text>
      </box>

      {/* Top accent line */}
      <box width="100%" height={1} backgroundColor={THEME.primary} />

      {/* History */}
      <scrollbox
        flexGrow={1}
        scrollY={true}
        stickyScroll={true}
        stickyStart="bottom"
      >
        <box
          flexDirection="column"
          gap={1}
          paddingY={1}
        >
          {history().length === 0 ? (
            <box
              flexGrow={1}
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              gap={1}
            >
              <text fg={THEME.secondary} attributes={TextAttributes.BOLD}>
                Ready
              </text>
              <text fg={THEME.muted}>Type something to translate...</text>
            </box>
          ) : (
            groupMessages(history()).map((group, groupIndex) => (
              <box
                id={`group-${groupIndex}`}
                flexDirection="column"
                gap={0}
              >
                {group.map((item, itemIndex) => {
                  const isPlainImage =
                    item.type === "image" ||
                    item.type === "image-hint" ||
                    item.type === "image-error";
                  const bgColor = item.type === "user"
                    ? "#1a1025"
                    : isPlainImage
                    ? undefined
                    : "#0f2626";
                  const hasPadding = !isPlainImage;
                  return (
                    <box
                      id={`msg-${groupIndex}-${itemIndex}`}
                      flexDirection="column"
                      paddingX={hasPadding ? 1 : 0}
                      paddingY={hasPadding ? 1 : 0}
                      gap={0}
                      backgroundColor={bgColor}
                    >
                      {renderContent(item)}
                    </box>
                  );
                })}
              </box>
            ))
          )}
        </box>
      </scrollbox>

      {/* Image loading hint */}
      {imageState().loading && (
        <box flexDirection="row" gap={1} paddingX={1} paddingY={0} backgroundColor="#1a1a1a">
          <text fg={THEME.secondary}>◌</text>
          <text fg={THEME.muted}>生成联想图片...</text>
        </box>
      )}

      {/* Input */}
      <box
        flexDirection="row"
        gap={1}
        backgroundColor="#1a1a1a"
        paddingX={1}
        paddingY={0}
      >
        <text fg={THEME.secondary}>➜</text>
        <input
          ref={(el) => {
            inputRef = el;
            el.focus();
          }}
          value=""
          placeholder={isTranslating() ? "Translating..." : "Type here..."}
          onInput={() => {}}
          // @ts-expect-error OpenTUI InputProps onSubmit type is intersected with Textarea's SubmitEvent handler
          onSubmit={handleSubmit}
          flexGrow={1}
          backgroundColor="#111111"
          focusedBackgroundColor="#1a1a1a"
          textColor="#FFFFFF"
          cursorColor="#00FF00"
        />
      </box>
    </box>
  );
}

export default App;

if (import.meta.main) {
  await render(() => <App />);
}
