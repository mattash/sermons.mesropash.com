import { createHash } from "node:crypto";
import { createSatteriMarkdownProcessor } from "@astrojs/markdown-satteri";
import { parseFragment, serialize, type DefaultTreeAdapterMap } from "parse5";

export const PASSAGE_VERSION = "1";
export interface SermonPassage { id: string; text: string }
interface HtmlNode {
  nodeName: string; tagName?: string; value?: string; namespaceURI?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: HtmlNode[]; parentNode?: HtmlNode;
}
const renderer = createSatteriMarkdownProcessor({});
const textOf = (node: HtmlNode): string => node.nodeName === "#text" ? node.value ?? "" : node.tagName === "br" ? "\n" : (node.childNodes ?? []).map(textOf).join("");

export function passageRanges(text: string): { start: number; end: number }[] {
  const sentences = [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)].map(({ index, segment }) => index + segment.length);
  const ranges: { start: number; end: number }[] = [];
  let start = 0;
  while (text.length - start > 900) {
    const candidates = sentences.filter((end) => end > start + 250 && end <= start + 900);
    let end = candidates[candidates.length - 1] ?? text.lastIndexOf(" ", start + 850) + 1;
    if (end <= start + 100) end = start + 850;
    ranges.push({ start, end }); start = end;
  }
  if (start < text.length) ranges.push({ start, end: text.length });
  return ranges;
}

// Clone the exact inline content intersecting a text range. Formatting, links,
// entities and whitespace survive even when a long paragraph needs several anchors.
function sliceChildren(nodes: HtmlNode[], start: number, end: number): HtmlNode[] {
  let offset = 0;
  const slice = (node: HtmlNode): HtmlNode | null => {
    const length = textOf(node).length, from = offset, to = offset + length;
    if (length && (to <= start || from >= end)) { offset = to; return null; }
    if (!length && (from < start || from >= end)) return null;
    const { parentNode: _parent, childNodes: children, ...properties } = node;
    const copy: HtmlNode = { ...properties, attrs: node.attrs?.map((attr) => ({ ...attr })) };
    if (node.nodeName === "#text") { copy.value = (node.value ?? "").slice(Math.max(0, start - from), Math.min(length, end - from)); offset = to; }
    else if (node.tagName === "br") offset = to;
    else if (children) {
      copy.childNodes = children.flatMap((child) => { const result = slice(child); return result ? [result] : []; });
      for (const child of copy.childNodes) child.parentNode = copy;
    }
    return copy;
  };
  return nodes.flatMap((node) => { const result = slice(node); return result ? [result] : []; });
}

export async function prepareSermon(body: string): Promise<{ html: string; passages: SermonPassage[] }> {
  const rendered = await (await renderer).render(body);
  const tree = parseFragment(rendered.code) as unknown as HtmlNode;
  const passages: SermonPassage[] = [], occurrences = new Map<string, number>();
  const visit = (node: HtmlNode) => {
    if (node.tagName === "p" && textOf(node).trim()) {
      const text = textOf(node), original = node.childNodes ?? [];
      node.childNodes = passageRanges(text).map(({ start, end }) => {
        const source = text.slice(start, end);
        const base = "passage-" + createHash("sha256").update(source).digest("hex").slice(0, 16);
        const count = (occurrences.get(base) ?? 0) + 1; occurrences.set(base, count);
        const id = base + (count > 1 ? "-" + count : "");
        const span: HtmlNode = {
          nodeName: "span", tagName: "span", namespaceURI: "http://www.w3.org/1999/xhtml",
          attrs: [{ name: "id", value: id }, { name: "class", value: "sermon-passage" }, { name: "tabindex", value: "-1" }],
          childNodes: sliceChildren(original, start, end), parentNode: node
        };
        for (const child of span.childNodes!) child.parentNode = span;
        passages.push({ id, text: source.trim() });
        return span;
      });
    } else for (const child of node.childNodes ?? []) visit(child);
  };
  visit(tree);
  return { html: serialize(tree as unknown as DefaultTreeAdapterMap["documentFragment"]), passages };
}
