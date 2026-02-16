"use client";

import type { MouseEvent } from "react";

export function SkipToContentLink() {
  function handleActivate(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    const mainContent = document.getElementById("main-content");
    if (!mainContent) return;

    mainContent.focus();
    mainContent.scrollIntoView({ block: "start" });

    if (window.location.hash !== "#main-content") {
      window.history.replaceState(null, "", "#main-content");
    }
  }

  return (
    <a
      href="#main-content"
      onClick={handleActivate}
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-100 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
    >
      Skip to content
    </a>
  );
}
