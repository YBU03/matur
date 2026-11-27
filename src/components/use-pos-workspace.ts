"use client";
import { useEffect, useRef, useState } from "react";

/** Measure the actual POS space; phone landscape keeps the existing bottom sheet.
 * Resize changes layout only, never keys/remounts the cart or performs a request. */
export function usePosWorkspace() {
  const ref = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      // Enough room for two touch-friendly columns. Short phone landscape stays mobile.
      const next = rect.width >= 720 && (window.innerHeight >= 440 || rect.width >= 960);
      const top = Math.max(0, rect.top - (viewport?.offsetTop ?? 0));
      const available = `${Math.max(240, Math.floor(height - top - 12))}px`;
      if (node.style.getPropertyValue("--pos-workspace-height") !== available)
        node.style.setProperty("--pos-workspace-height", available);
      setWide(next);
    };
    const queue = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(queue) : null;
    observer?.observe(node);
    if (node.parentElement) observer?.observe(node.parentElement);
    const header = document.querySelector("header");
    if (header) observer?.observe(header);
    window.addEventListener("resize", queue);
    window.visualViewport?.addEventListener("resize", queue);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", queue);
      window.visualViewport?.removeEventListener("resize", queue);
    };
  }, []);
  return { ref, wide };
}
