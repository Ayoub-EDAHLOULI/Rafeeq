import { Fragment } from "react";

interface MessageContentProps {
  content: string;
}

interface TextBlock {
  type: "text";
  lines: string[];
}

interface CodeBlock {
  type: "code";
  lang: string;
  value: string;
}

function splitBlocks(content: string): (TextBlock | CodeBlock)[] {
  const blocks: (TextBlock | CodeBlock)[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: "text",
        lines: content.slice(lastIndex, match.index).split("\n"),
      });
    }
    blocks.push({
      type: "code",
      lang: match[1],
      value: match[2].replace(/\n$/, ""),
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    blocks.push({ type: "text", lines: content.slice(lastIndex).split("\n") });
  }

  return blocks;
}

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={key}
          className="rounded bg-inputBg px-1 py-0.5 font-mono text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

function TextLines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, i) => {
        const heading = line.match(/^(#{1,3})\s+(.*)/);
        const node = heading ? (
          <span
            className={
              heading[1].length === 1
                ? "text-base font-semibold"
                : heading[1].length === 2
                  ? "text-[0.95em] font-semibold"
                  : "font-semibold"
            }
          >
            {renderInline(heading[2], `h-${i}`)}
          </span>
        ) : (
          renderInline(line, `l-${i}`)
        );

        return (
          <span key={i} className="whitespace-pre-wrap">
            {node}
            {i < lines.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

export default function MessageContent({ content }: MessageContentProps) {
  const blocks = splitBlocks(content);

  return (
    <>
      {blocks.map((block, i) =>
        block.type === "code" ? (
          <pre
            key={i}
            className="my-2 overflow-x-auto rounded-lg border border-border bg-inputBg px-3 py-2 font-mono text-xs text-text"
          >
            <code>{block.value}</code>
          </pre>
        ) : (
          <TextLines key={i} lines={block.lines} />
        ),
      )}
    </>
  );
}
