import React, { useEffect, useRef, useState } from "react";

/** Desktop split panel. The containing row determines the available width. */
export function ResizablePanel({
  initialWidth,
  storageKey,
  children,
}: {
  initialWidth: number;
  storageKey?: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initialWidth);
  const [available, setAvailable] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const min = Math.min(240, available / 2);
  const max = Math.max(min, available - 320);
  const bounded = available ? Math.max(min, Math.min(max, width)) : width;
  useEffect(() => {
    let saved = initialWidth;
    try {
      const value = storageKey ? Number(localStorage.getItem(storageKey)) : 0;
      if (Number.isFinite(value) && value > 0) saved = value;
    } catch {
      /* Storage is optional. */
    }
    setWidth(saved);
  }, [initialWidth, storageKey]);
  useEffect(() => {
    const parent = panel.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => setAvailable(parent.clientWidth));
    setAvailable(parent.clientWidth);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  const save = (value: number) => {
    setWidth(value);
    try {
      if (storageKey) localStorage.setItem(storageKey, String(value));
    } catch {
      /* Storage is optional. */
    }
  };
  const finish = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    save(bounded);
  };
  return (
    <div
      ref={panel}
      className="relative h-full shrink-0 border-l bg-background"
      style={{ width: bounded, userSelect: dragging ? "none" : undefined }}
    >
      <div
        role="separator"
        aria-label="Resize custom panel"
        aria-orientation="vertical"
        aria-valuemin={Math.round(min)}
        aria-valuemax={Math.round(max)}
        aria-valuenow={Math.round(bounded)}
        tabIndex={0}
        className="absolute -left-1 top-0 z-20 h-full w-2 cursor-col-resize touch-none focus-visible:bg-primary/30 hover:bg-primary/20"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, width: bounded };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setWidth(
            Math.max(
              min,
              Math.min(max, drag.current.width + drag.current.x - event.clientX)
            )
          );
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 40 : 10;
          const next =
            event.key === "ArrowLeft"
              ? bounded + step
              : event.key === "ArrowRight"
              ? bounded - step
              : event.key === "Home"
              ? min
              : event.key === "End"
              ? max
              : null;
          if (next === null) return;
          event.preventDefault();
          save(Math.max(min, Math.min(max, next)));
        }}
      />
      <div className="h-full overflow-hidden">{children}</div>
    </div>
  );
}
