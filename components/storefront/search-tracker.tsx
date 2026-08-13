"use client";

import { useEffect } from "react";
import { logSearchAction } from "@/actions/analytics";

export function SearchTracker({ term }: { term: string }) {
  useEffect(() => {
    if (term.trim()) void logSearchAction(term);
  }, [term]);
  return null;
}
