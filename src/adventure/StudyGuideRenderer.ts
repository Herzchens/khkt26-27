import { createElement, type ReactNode } from "react";
import { parseStudyGuideMarkdown, type StudyGuideBlock, type StudyGuideInlineNode, type StudyGuideMathPart } from "./studyGuideMarkdown.ts";

function renderMathPart(part: StudyGuideMathPart, key: string): ReactNode {
  if (part.type === "subscript") return createElement("sub", { key }, part.text);
  if (part.type === "superscript") return createElement("sup", { key }, part.text);
  return part.text;
}

function renderInline(nodes: StudyGuideInlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "text": return node.text;
      case "code": return createElement("code", { key }, node.text);
      case "strong": return createElement("strong", { key }, renderInline(node.children, key));
      case "emphasis": return createElement("em", { key }, renderInline(node.children, key));
      case "link": return createElement("a", { key, href: node.href, target: "_blank", rel: "noopener noreferrer" }, renderInline(node.children, key));
      case "math": return createElement("span", { key, className: "study-guide__notation" }, node.parts.map((part, partIndex) => renderMathPart(part, `${key}-math-${partIndex}`)));
    }
  });
}

function renderBlock(block: StudyGuideBlock, key: string): ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = `h${Math.min(block.level + 1, 6)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return createElement(Tag, { key }, renderInline(block.children, key));
    }
    case "paragraph": return createElement("p", { key }, renderInline(block.children, key));
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return createElement(Tag, { key }, block.items.map((item, index) => createElement("li", { key: `${key}-item-${index}` }, renderInline(item, `${key}-item-${index}`))));
    }
    case "table": return createElement("div", { key, className: "study-guide__table-wrap", role: "region", "aria-label": "Bảng ôn tập", tabIndex: 0 },
      createElement("table", null,
        createElement("thead", null, createElement("tr", null, block.headers.map((cell, index) => createElement("th", { key: `${key}-header-${index}`, scope: "col" }, renderInline(cell, `${key}-header-${index}`))))),
        createElement("tbody", null, block.rows.map((row, rowIndex) => createElement("tr", { key: `${key}-row-${rowIndex}` }, row.map((cell, cellIndex) => createElement("td", { key: `${key}-cell-${rowIndex}-${cellIndex}` }, renderInline(cell, `${key}-cell-${rowIndex}-${cellIndex}`))))))));
    case "quote": return createElement("blockquote", { key }, renderInline(block.children, key));
    case "code": return createElement("pre", { key }, createElement("code", null, block.text));
    case "math-block": return createElement("div", { key, className: "study-guide__notation study-guide__notation--display", role: "math" }, block.parts.map((part, index) => renderMathPart(part, `${key}-math-${index}`)));
    case "rule": return createElement("hr", { key });
  }
}

export function StudyGuideArticle({ title, text }: { title: string; text: string }) {
  const blocks = parseStudyGuideMarkdown(text);
  return createElement("article", { className: "study-guide__article", "aria-label": `Bản xem trước: ${title}`, tabIndex: 0 },
    createElement("h2", null, title),
    createElement("div", { className: "study-guide__article-body" }, blocks.map((block, index) => renderBlock(block, `guide-block-${index}`))));
}
