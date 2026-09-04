import DOMPurify from "dompurify";
import { marked } from "marked";

const ALLOWED_TAGS = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "kbd",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
];

type RenderMarkdownOptions = {
  codeCopyButtons?: boolean;
  onCopyResult?: (success: boolean) => void;
};

export function renderMarkdown(
  element: HTMLElement,
  source: string,
  options: RenderMarkdownOptions = {},
): void {
  const html = marked.parse(source, {
    async: false,
    breaks: true,
    gfm: true,
  });

  element.innerHTML = DOMPurify.sanitize(html, {
    ALLOWED_ATTR: ["href", "title"],
    ALLOWED_TAGS,
  });

  for (const link of element.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  if (options.codeCopyButtons === false) return;

  for (const code of element.querySelectorAll<HTMLElement>("pre > code")) {
    const pre = code.parentElement;
    if (!pre) continue;

    const copyButton = document.createElement("button");
    copyButton.className = "code-copy-button";
    copyButton.type = "button";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", () => {
      void navigator.clipboard
        .writeText(code.textContent ?? "")
        .then(
          () => {
            copyButton.textContent = "Copied";
            options.onCopyResult?.(true);
          },
          () => {
            copyButton.textContent = "Failed";
            options.onCopyResult?.(false);
          },
        )
        .finally(() => {
          window.setTimeout(() => {
            if (copyButton.isConnected) copyButton.textContent = "Copy";
          }, 1200);
        });
    });
    pre.prepend(copyButton);
  }
}
