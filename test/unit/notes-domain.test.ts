import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NoteMarkdown, safeNoteUrl } from "../../src/components/notes/note-markdown";
import { markdownByteLength, normalizeMarkdown, notePreview, validateNote } from "../../src/server/notes/domain";

describe("Note domain", () => {
  it("normalizes line endings and enforces the UTF-8 byte limit", () => {
    expect(normalizeMarkdown("one\r\ntwo\rthree")).toBe("one\ntwo\nthree");
    expect(markdownByteLength("é")).toBe(2);
    expect(validateNote({ title: "Note", bodyMarkdown: "é".repeat(100_001) })).toContainEqual({ field: "bodyMarkdown", message: "Markdown must be 200 KB or less" });
    expect(validateNote({ title: "   ", bodyMarkdown: "" })).toContainEqual({ field: "title", message: "Enter a title" });
    expect(validateNote({ title: "a".repeat(161), bodyMarkdown: "" })).toContainEqual({ field: "title", message: "Title must be 160 characters or less" });
  });

  it("produces bounded plain-text previews", () => {
    const preview = notePreview("# Heading\n\n[Course](https://example.com) and `code` <script>alert(1)</script>");
    expect(preview).toBe("Heading Course and code alert(1)");
    expect(preview).not.toContain("<script>");
    expect(notePreview("a".repeat(300))).toHaveLength(240);
  });

  it("renders GFM while excluding raw HTML, images, and unsafe protocols", () => {
    const html = renderToStaticMarkup(createElement(NoteMarkdown, { children: "# Heading\n\n- [x] Done\n\n<script>alert(1)</script>\n\n![track](https://example.com/a.png)\n\n[unsafe](javascript:alert(1))\n\n[safe](https://example.com)" }));
    expect(html).toContain("<h2>Heading</h2>");
    expect(html).toContain("type=\"checkbox\"");
    expect(html).not.toContain("script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("href=\"\"");
    expect(html).toContain("href=\"https://example.com\"");
    expect(html).toContain("rel=\"noreferrer noopener\"");
    expect(safeNoteUrl("mailto:student@example.com", "href", { type: "element", tagName: "a", properties: {}, children: [] })).toBe("mailto:student@example.com");
    expect(safeNoteUrl("/relative", "href", { type: "element", tagName: "a", properties: {}, children: [] })).toBe("");
  });
});
