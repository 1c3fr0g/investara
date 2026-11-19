"use client";

import React from "react";
import Link from "next/link";

interface ChatMessageRendererProps {
  content: string;
  isUser?: boolean;
}

/**
 * Parses inline markdown:
 * - [label](url) -> <a> or <Link>
 * - **bold** -> <strong>
 * - *italic* or _italic_ -> <em>
 * - `code` -> <code>
 * - Converts arrows & strips stray slashes
 */
export function parseInlineMarkdown(text: string, isUser = false): React.ReactNode[] {
  if (!text) return [];

  // Pre-clean text:
  let cleaned = text
    .replace(/\$\\rightarrow\$/g, "→")
    .replace(/\$\\leftarrow\$/g, "←")
    .replace(/\\rightarrow/g, "→")
    .replace(/->/g, "→")
    // Clean file:/// links to relative web routes
    .replace(/file:\/\/\/[^)]*\/web\/app\/([a-zA-Z0-9_-]+)\/page\.tsx/g, "/$1")
    .replace(/file:\/\/\/[^)]*/g, "");

  // Clean double-slash comment markers at line/phrase start
  cleaned = cleaned.replace(/^(\s*)\/\/\s*/gm, "$1• ");
  // Clean double slashes used as separators into elegant middle dots
  cleaned = cleaned.replace(/([^\s:])\s*\/\/\s*([^\s/])/g, "$1 · $2");

  // Regex tokenizer matching:
  // 1. links: [label](url)
  // 2. bold: **text**
  // 3. inline code: `code`
  // 4. italic: *text* (single asterisk) or _text_
  const regex = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  const parts = cleaned.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Check link: [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      const isInternal = url.startsWith("/") || url.startsWith("#");
      if (isInternal) {
        return (
          <Link
            key={index}
            href={url}
            className={`font-bold underline underline-offset-2 transition ${
              isUser
                ? "text-white underline"
                : "text-[#9A83FF] hover:text-[#7C5DFA] dark:text-[#9A83FF] dark:hover:text-[#B6A4FF]"
            }`}
          >
            {label}
          </Link>
        );
      }
      return (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`font-bold underline underline-offset-2 inline-flex items-center gap-0.5 transition ${
            isUser
              ? "text-white underline"
              : "text-[#9A83FF] hover:text-[#7C5DFA] dark:text-[#9A83FF] dark:hover:text-[#B6A4FF]"
          }`}
        >
          <span>{label}</span>
          <span className="text-[10px]">↗</span>
        </a>
      );
    }

    // Check bold: **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong
          key={index}
          className={`font-black ${
            isUser ? "text-white font-extrabold" : "text-zinc-950 dark:text-white"
          }`}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Check inline code: `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
            isUser
              ? "bg-white/20 text-white"
              : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200"
          }`}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Check italic: *text* or _text_
    if (
      ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) &&
      part.length >= 2
    ) {
      return (
        <em key={index} className="italic opacity-90">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Fallback: cleanup any lone accidental "**" or "//"
    const safeText = part.replace(/\*\*/g, "").replace(/\/\//g, "");
    return <span key={index}>{safeText}</span>;
  });
}

/**
 * Full Markdown Document Renderer for Chat Bubbles:
 * Supports headings, bullet lists, numbered lists, markdown tables, callout quotes, dividers, and paragraphs.
 */
export function ChatMessageRenderer({ content, isUser = false }: ChatMessageRendererProps) {
  if (!content) return null;

  // Clean raw content
  const normalized = content
    .replace(/\r\n/g, "\n")
    .replace(/\$\\rightarrow\$/g, "→")
    .replace(/file:\/\/\/[^)]*\/web\/app\/([a-zA-Z0-9_-]+)\/page\.tsx/g, "/$1")
    .replace(/file:\/\/\/[^)]*/g, "")
    .replace(/^(\s*)\/\/\s*/gm, "$1• ")
    .replace(/([^\s:])\s*\/\/\s*([^\s/])/g, "$1 · $2");

  // Split into raw blocks (double newlines or markdown sections)
  const lines = normalized.split("\n");
  const blocks: React.ReactNode[] = [];
  let currentList: { type: "bullet" | "number"; items: string[] } | null = null;
  let currentTable: string[] | null = null;

  const flushList = () => {
    if (!currentList || currentList.items.length === 0) return;
    const items = currentList.items;
    const isNum = currentList.type === "number";

    blocks.push(
      <div key={`list-${blocks.length}`} className="my-2 space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 leading-relaxed">
            {isNum ? (
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                  isUser
                    ? "bg-white/25 text-white"
                    : "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {i + 1}
              </span>
            ) : (
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  isUser ? "bg-white" : "bg-[#9A83FF] dark:bg-[#9A83FF]"
                }`}
              />
            )}
            <div className="min-w-0 flex-1 text-xs leading-relaxed wrap-anywhere">
              {parseInlineMarkdown(item, isUser)}
            </div>
          </div>
        ))}
      </div>
    );
    currentList = null;
  };

  const flushTable = () => {
    if (!currentTable || currentTable.length < 2) return;
    const rawRows = currentTable
      .map((r) => r.trim())
      .filter((r) => r.startsWith("|") && r.endsWith("|"));

    if (rawRows.length < 2) {
      currentTable = null;
      return;
    }

    const parseCells = (rowStr: string) =>
      rowStr
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());

    const headerCells = parseCells(rawRows[0]);
    // Skip divider row (row 1, e.g. |:---|:---|)
    const bodyRows = rawRows.slice(2).map(parseCells);

    blocks.push(
      <div
        key={`table-${blocks.length}`}
        className="my-3 table-scroll rounded-xl border border-zinc-200/80 bg-zinc-50/50 shadow-2xs dark:border-white/10 dark:bg-zinc-900/50"
      >
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-200/80 bg-zinc-100/70 text-zinc-800 dark:border-white/10 dark:bg-zinc-800/60 dark:text-zinc-200">
            <tr>
              {headerCells.map((h, i) => (
                <th key={i} className="px-3 py-2 font-black">
                  {parseInlineMarkdown(h, isUser)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/60 dark:divide-white/[0.05]">
            {bodyRows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="hover:bg-zinc-100/50 transition dark:hover:bg-zinc-800/40"
              >
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className="px-3 py-2 text-zinc-800 dark:text-zinc-200"
                  >
                    {parseInlineMarkdown(cell, isUser)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    currentTable = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Empty line flushes lists/tables
    if (!line) {
      flushList();
      flushTable();
      continue;
    }

    // Table line
    if (line.startsWith("|") && line.endsWith("|")) {
      flushList();
      if (!currentTable) currentTable = [];
      currentTable.push(line);
      continue;
    } else if (currentTable) {
      flushTable();
    }

    // Horizontal Rule
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushList();
      blocks.push(
        <hr
          key={`hr-${blocks.length}`}
          className={`my-3 border-t ${
            isUser ? "border-white/20" : "border-zinc-200/80 dark:border-white/10"
          }`}
        />
      );
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      flushList();
      blocks.push(
        <h3
          key={`h3-${blocks.length}`}
          className={`mt-3.5 mb-1 text-sm font-black tracking-tight flex items-center gap-1.5 ${
            isUser ? "text-white" : "text-zinc-950 dark:text-white"
          }`}
        >
          {parseInlineMarkdown(line.replace(/^###\s*/, ""), isUser)}
        </h3>
      );
      continue;
    }

    if (line.startsWith("#### ")) {
      flushList();
      blocks.push(
        <h4
          key={`h4-${blocks.length}`}
          className={`mt-2.5 mb-1 text-xs font-bold ${
            isUser ? "text-white/95" : "text-[#9A83FF] dark:text-[#9A83FF]"
          }`}
        >
          {parseInlineMarkdown(line.replace(/^####\s*/, ""), isUser)}
        </h4>
      );
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      blocks.push(
        <h2
          key={`h2-${blocks.length}`}
          className={`mt-4 mb-1 text-base font-black ${
            isUser ? "text-white" : "text-zinc-950 dark:text-white"
          }`}
        >
          {parseInlineMarkdown(line.replace(/^##\s*/, ""), isUser)}
        </h2>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushList();
      blocks.push(
        <div
          key={`quote-${blocks.length}`}
          className={`my-2 rounded-xl border-l-3 px-3.5 py-2 text-xs leading-relaxed ${
            isUser
              ? "border-white/50 bg-white/10 text-white"
              : "border-[#9A83FF] bg-[#9A83FF]/8 text-zinc-800 dark:text-zinc-200"
          }`}
        >
          {parseInlineMarkdown(line.replace(/^>\s*/, ""), isUser)}
        </div>
      );
      continue;
    }

    // Unordered List Items (*, -, •)
    const bulletMatch = line.match(/^(\*|-|•|\+)\s+(.+)$/);
    if (bulletMatch) {
      if (currentList && currentList.type !== "bullet") flushList();
      if (!currentList) currentList = { type: "bullet", items: [] };
      currentList.items.push(bulletMatch[2]);
      continue;
    }

    // Ordered List Items (1., 2., etc.)
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      if (currentList && currentList.type !== "number") flushList();
      if (!currentList) currentList = { type: "number", items: [] };
      currentList.items.push(numMatch[2]);
      continue;
    }

    // If previously in a list and this is just a regular line, flush list
    flushList();

    // Standard Paragraph
    blocks.push(
      <p
        key={`p-${blocks.length}`}
        className={`leading-relaxed my-1.5 ${
          isUser ? "text-white" : "text-zinc-800 dark:text-zinc-200"
        }`}
      >
        {parseInlineMarkdown(line, isUser)}
      </p>
    );
  }

  // Final flush
  flushList();
  flushTable();

  return <div className="min-w-0 space-y-0.5 wrap-anywhere">{blocks}</div>;
}
