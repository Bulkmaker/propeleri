"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";

interface NavigableCardLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
}

function hasInteractiveAncestor(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'a,button,input,select,textarea,[role="button"],[data-prevent-card-nav="true"]'
    )
  );
}

export function NavigableCardLink({ href, className, children }: NavigableCardLinkProps) {
  const router = useRouter();

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || hasInteractiveAncestor(event.target)) return;
    router.push(href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || hasInteractiveAncestor(event.target)) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    router.push(href);
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={className}
    >
      {children}
    </div>
  );
}
