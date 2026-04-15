"use client";

import * as React from "react";

export interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export interface AccordionProps {
  items: AccordionItemProps[];
  className?: string;
}

function AccordionItem({
  title,
  children,
  isOpen,
  onToggle,
}: AccordionItemProps & {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[var(--loop-border)] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-4 text-left text-[var(--loop-text)] hover:text-[var(--loop-primary)] transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-medium pr-4">{title}</span>
        <span
          className={`shrink-0 text-xl text-[var(--loop-text-muted)] transition-transform ${isOpen ? "rotate-45" : ""}`}
          aria-hidden
        >
          +
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <p className="pb-4 text-[var(--loop-text-muted)]">{children}</p>
      </div>
    </div>
  );
}

export function Accordion({ items, className = "" }: AccordionProps) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(() => {
    const idx = items.findIndex((i) => i.defaultOpen);
    return idx >= 0 ? idx : 0;
  });

  return (
    <div className={className}>
      {items.map((item, index) => (
        <AccordionItem
          key={index}
          title={item.title}
          isOpen={openIndex === index}
          onToggle={() => setOpenIndex(openIndex === index ? null : index)}
        >
          {item.children}
        </AccordionItem>
      ))}
    </div>
  );
}
