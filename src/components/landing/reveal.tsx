import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "figure" | "span";
};

export function Reveal({
  children,
  className = "",
  delay = 0,
  as = "div",
}: RevealProps) {
  const Tag = as;

  return (
    <Tag
      className={`reveal ${className}`}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
