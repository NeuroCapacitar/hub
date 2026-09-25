export interface CertificateTextLayout {
  contentHeight: number;
  lineHeight: number;
  lines: string[];
}

export interface CertificateTextLayoutOptions {
  lineHeight: number;
  measureText: (value: string) => number;
  value: string;
  width: number;
}

export const getCertificateTextVerticalOffset = ({
  contentHeight,
  height,
  verticalAlign,
}: {
  contentHeight: number;
  height: number;
  verticalAlign: "top" | "middle" | "bottom" | undefined;
}): number => {
  if (verticalAlign === "top") {
    return 0;
  }
  if (verticalAlign === "bottom") {
    return Math.max(0, height - contentHeight);
  }
  return Math.max(0, (height - contentHeight) / 2);
};

const graphemeSegmenter =
  typeof Intl.Segmenter === "undefined"
    ? null
    : new Intl.Segmenter(undefined, { granularity: "grapheme" });
const PARAGRAPH_SEPARATOR = /\r\n?|\n/u;
const WHITESPACE_PATTERN = /\s+/u;

const getGraphemes = (value: string): string[] =>
  graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(value), ({ segment }) => segment)
    : Array.from(value);

const breakLongWord = (
  word: string,
  width: number,
  measureText: (value: string) => number
): string[] => {
  const lines: string[] = [];
  let line = "";

  for (const grapheme of getGraphemes(word)) {
    const candidate = line + grapheme;
    if (line && measureText(candidate) > width) {
      lines.push(line);
      line = grapheme;
    } else {
      line = candidate;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
};

const wrapCertificateParagraph = ({
  measureText,
  paragraph,
  width,
}: {
  measureText: (value: string) => number;
  paragraph: string;
  width: number;
}): string[] => {
  const words = paragraph.trim().split(WHITESPACE_PATTERN).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measureText(candidate) > width) {
      lines.push(line);
      line = "";
    }

    if (measureText(word) <= width) {
      line = line ? `${line} ${word}` : word;
      continue;
    }

    const fragments = breakLongWord(word, width, measureText);
    lines.push(...fragments.slice(0, -1));
    line = fragments.at(-1) ?? "";
  }

  if (line) {
    lines.push(line);
  }
  return lines;
};

export const layoutCertificateText = ({
  lineHeight,
  measureText,
  value,
  width,
}: CertificateTextLayoutOptions): CertificateTextLayout => {
  if (!value.trim()) {
    return { contentHeight: 0, lineHeight, lines: [] };
  }

  if (!Number.isFinite(width) || width <= 0) {
    return { contentHeight: lineHeight, lineHeight, lines: [value] };
  }

  const lines = value
    .split(PARAGRAPH_SEPARATOR)
    .flatMap((paragraph) =>
      wrapCertificateParagraph({ measureText, paragraph, width })
    );

  return {
    contentHeight: lines.length * lineHeight,
    lineHeight,
    lines,
  };
};
