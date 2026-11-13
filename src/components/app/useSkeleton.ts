"use client";
import { useEffect, useState } from "react";

/** Fake 300–500 ms latency on the first view of data-heavy pages (spec 5.5). */
export function useFirstLoad(ms = 380) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return loading;
}
