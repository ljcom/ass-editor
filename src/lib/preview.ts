import type { CSSProperties } from "react";
export function assColor(value: string): string {
  const hex = value.replace(/^&H/i, "").replace(/&$/, "").padStart(8, "0");
  if (!/^[\da-f]{8}$/i.test(hex)) return "#fff";
  return `rgba(${parseInt(hex.slice(6, 8), 16)},${parseInt(hex.slice(4, 6), 16)},${parseInt(hex.slice(2, 4), 16)},${(255 - parseInt(hex.slice(0, 2), 16)) / 255})`;
}
export function previewRuns(text: string) {
  const runs: {
    text: string;
    bold: boolean;
    italic: boolean;
    color?: string;
  }[] = [];
  let color: string | undefined;
  let bold = false,
    italic = false;
  for (const part of text.split(/(\{[^}]*\})/g)) {
    if (part.startsWith("{")) {
      // Ignore parenthesized effects (including \t transforms). Their tags
      // must not be applied as static formatting to the whole text.
      let depth = 0;
      const tags = [...part]
        .filter((char) => {
          if (char === "(") {
            depth++;
            return false;
          }
          if (char === ")") {
            depth = Math.max(0, depth - 1);
            return false;
          }
          return depth === 0;
        })
        .join("");
      for (const match of tags.matchAll(/\\([^\\{}]*)/g)) {
        const tag = match[1].trim();
        const formatting = /^([bi])([01])$/.exec(tag);
        const primary = /^(?:c|1c)(?:&H([\da-f]{1,6})&?)?$/i.exec(tag);
        if (formatting) {
          if (formatting[1] === "b") bold = formatting[2] === "1";
          else italic = formatting[2] === "1";
        } else if (primary) {
          color = primary[1] ? assColor("&H" + primary[1]) : undefined;
        } else if (tag.startsWith("r")) {
          bold = false;
          italic = false;
          color = undefined;
        }
      }
    } else if (part)
      runs.push({
        text: part.replace(/\\[Nn]/g, "\n").replace(/\\h/g, "\u00a0"),
        bold,
        italic,
        ...(color ? { color } : {}),
      });
  }
  return runs;
}
export function styleCss(
  style: Record<string, string> | undefined,
  scale: number,
): CSSProperties {
  const outline = Math.min(6, Math.max(0, Number(style?.outline ?? 2) * scale));
  const color = assColor(style?.outlinecolour ?? "&H00000000");
  const shadow = Math.min(8, Math.max(0, Number(style?.shadow ?? 1) * scale));
  return {
    fontFamily: style?.fontname || "Arial",
    fontSize: Math.max(10, Number(style?.fontsize ?? 32) * scale),
    color: assColor(style?.primarycolour ?? "&H00FFFFFF"),
    fontWeight: style?.bold === "-1" ? "bold" : "normal",
    fontStyle: style?.italic === "-1" ? "italic" : "normal",
    textShadow: [
      `${outline}px 0 ${color}`,
      `${-outline}px 0 ${color}`,
      `0 ${outline}px ${color}`,
      `0 ${-outline}px ${color}`,
      `${shadow}px ${shadow}px 2px ${assColor(style?.backcolour ?? "&H80000000")}`,
    ].join(","),
  };
}
