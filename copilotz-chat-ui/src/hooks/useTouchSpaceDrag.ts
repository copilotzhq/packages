import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ChatSpace, ChatThread } from "../types/chatTypes";
import { TouchSpaceDrag, spaceDragScrollSpeed } from "../lib/touchSpaceDrag";

type Options = {
  enabled: boolean;
  threads: readonly ChatThread[];
  spaces: readonly ChatSpace[];
  onMove: (threadId: string, spaceId: string) => void;
  onCancel: () => void;
};

/** Touch is handled only on the dedicated handle; native mouse DnD stays separate. */
export function useTouchSpaceDrag(options: Options) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const model = useRef(new TouchSpaceDrag());
  const capture = useRef<HTMLButtonElement | null>(null);
  const frame = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const targetViewportRef = useRef<HTMLDivElement>(null);
  const targetIdRef = useRef<string | null>(null);
  const initialEligibleIds = useRef<readonly string[]>([]);
  const [drag, setDrag] = useState<{ threadId: string; targetId: string | null } | null>(null);

  const eligibleIds = () => {
    const session = model.current.session;
    const thread = optionsRef.current.threads.find((value) => value.id === session?.threadId);
    if (!session || !thread || (thread.spaceId ?? null) !== session.originalSpaceId || !optionsRef.current.enabled) return [];
    return optionsRef.current.spaces
      .filter((space) => space.status !== "archived" && space.id !== session.originalSpaceId)
      .map((space) => space.id);
  };

  const hitTest = () => {
    const session = model.current.session;
    const viewport = targetViewportRef.current;
    if (!session?.active || !viewport) return null;
    const currentIds = eligibleIds();
    if (currentIds.length !== initialEligibleIds.current.length ||
      currentIds.some((id, index) => id !== initialEligibleIds.current[index])) return null;
    const rect = viewport.getBoundingClientRect();
    if (session.x < rect.left || session.x > rect.right || session.y < rect.top || session.y > rect.bottom) return null;
    const target = document.elementFromPoint(session.x, session.y)?.closest<HTMLElement>("[data-touch-space-target]");
    const id = target?.dataset.touchSpaceTarget;
    return target && viewport.contains(target) && id && currentIds.includes(id) ? id : null;
  };

  const clear = () => {
    const pointerId = model.current.session?.pointerId;
    model.current.cancel();
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    targetIdRef.current = null;
    setDrag(null);
    const element = capture.current;
    capture.current = null;
    if (pointerId !== undefined && element?.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  };

  const cancel = (pointerId?: number) => {
    if (!model.current.session || (pointerId !== undefined && model.current.session.pointerId !== pointerId)) return;
    const active = model.current.session.active;
    suppressClick.current = true;
    clear();
    if (active) optionsRef.current.onCancel();
  };

  useEffect(() => {
    let lastFrame = 0;
    const tick = (now: number) => {
      const session = model.current.session;
      if (!session?.active) return;
      const viewport = targetViewportRef.current;
      if (viewport) {
        const elapsed = Math.min(32, lastFrame ? now - lastFrame : 16);
        viewport.scrollTop += spaceDragScrollSpeed(session.x, session.y, viewport.getBoundingClientRect()) * elapsed / 1000;
      }
      lastFrame = now;
      const targetId = hitTest();
      if (targetId !== targetIdRef.current) {
        targetIdRef.current = targetId;
        setDrag({ threadId: session.threadId, targetId });
      }
      frame.current = requestAnimationFrame(tick);
    };
    const move = (event: PointerEvent) => {
      const session = model.current.session;
      if (!session || event.pointerId !== session.pointerId) return;
      const wasActive = session.active;
      if (!model.current.update(event.pointerId, event.clientX, event.clientY)) return;
      event.preventDefault();
      suppressClick.current = true;
      if (!wasActive) {
        lastFrame = 0;
        setDrag({ threadId: session.threadId, targetId: null });
        frame.current = requestAnimationFrame(tick);
      }
    };
    const up = (event: PointerEvent) => {
      const session = model.current.session;
      if (!session || event.pointerId !== session.pointerId) return;
      session.x = event.clientX;
      session.y = event.clientY;
      const active = session.active;
      const result = model.current.release(event.pointerId, hitTest(), eligibleIds());
      // Consume the model before releasing capture or entering the async host path.
      const element = capture.current;
      clear();
      if (element?.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      if (result) optionsRef.current.onMove(result.threadId, result.spaceId);
      else if (active) optionsRef.current.onCancel();
    };
    const pointerCancel = (event: PointerEvent) => {
      if (event.pointerId === model.current.session?.pointerId) cancel();
    };
    const secondPointer = (event: PointerEvent) => {
      if (model.current.session && event.pointerId !== model.current.session.pointerId) cancel();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && model.current.session) {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    };
    const visibility = () => { if (document.hidden) cancel(); };
    const blur = () => cancel();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", pointerCancel);
    window.addEventListener("pointerdown", secondPointer);
    window.addEventListener("blur", blur);
    document.addEventListener("keydown", key, true);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", pointerCancel);
      window.removeEventListener("pointerdown", secondPointer);
      window.removeEventListener("blur", blur);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("visibilitychange", visibility);
      // Do not set React state or announce cancellation during unmount.
      const pointerId = model.current.session?.pointerId;
      model.current.cancel();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      const element = capture.current;
      capture.current = null;
      if (pointerId !== undefined && element?.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    };
  }, []);

  useEffect(() => {
    if (!model.current.session) return;
    const currentIds = eligibleIds();
    // A disappearing/reordered destination must not silently replace the target
    // underneath a stationary finger. Restart to choose from the new list.
    if (!options.enabled || currentIds.length !== initialEligibleIds.current.length ||
      currentIds.some((id, index) => id !== initialEligibleIds.current[index])) cancel();
  }, [options.enabled, options.threads, options.spaces]);

  return {
    drag,
    targetViewportRef,
    cancel,
    start: (event: ReactPointerEvent<HTMLButtonElement>, thread: ChatThread) => {
      // Explicit activation is never the stale release click of an earlier drag.
      suppressClick.current = false;
      if (!optionsRef.current.enabled || event.pointerType !== "touch" || !event.isPrimary || event.button !== 0) return;
      if (!model.current.start(event.pointerId, thread.id, thread.spaceId ?? null, event.clientX, event.clientY)) return;
      initialEligibleIds.current = eligibleIds();
      if (initialEligibleIds.current.length === 0) {
        model.current.cancel();
        return;
      }
      capture.current = event.currentTarget;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { cancel(); }
    },
    consumeClick: () => {
      const suppressed = suppressClick.current;
      suppressClick.current = false;
      return suppressed;
    },
  };
}
