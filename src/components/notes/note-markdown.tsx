import ReactMarkdown, { type UrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

const allowedElements = [
  "a", "blockquote", "br", "code", "del", "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
  "li", "ol", "p", "pre", "strong", "table", "tbody", "td", "th", "thead", "tr", "ul", "input",
] as const;

/** Keep rendered Note links inert unless they use an explicitly supported protocol. */
export const safeNoteUrl: UrlTransform = (value) => {
  if (value.startsWith("https://") || value.startsWith("mailto:")) return value;
  return "";
};

/** Render student-authored Markdown without raw HTML or network-fetching elements. */
export function NoteMarkdown({ children }: { readonly children: string }) {
  return (
    <div className="typeset typeset-note max-w-[70ch] overflow-wrap-anywhere">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        allowedElements={allowedElements}
        urlTransform={safeNoteUrl}
        components={{
          a: ({ children: linkChildren, href, ...props }) => href ? <a {...props} href={href} rel="noreferrer noopener">{linkChildren}</a> : <span>{linkChildren}</span>,
          h1: ({ children: headingChildren }) => <h2>{headingChildren}</h2>,
          h2: ({ children: headingChildren }) => <h3>{headingChildren}</h3>,
          h3: ({ children: headingChildren }) => <h4>{headingChildren}</h4>,
          table: ({ children: tableChildren }) => <div className="typeset-scroll"><table>{tableChildren}</table></div>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
