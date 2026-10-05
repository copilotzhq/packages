export type TouchSpaceDragSession = {
  pointerId: number;
  threadId: string;
  originalSpaceId: string | null;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
};

/** One gesture, consumed synchronously before any asynchronous host move. */
export class TouchSpaceDrag {
  session: TouchSpaceDragSession | null = null;

  start(pointerId: number, threadId: string, originalSpaceId: string | null, x: number, y: number) {
    if (this.session) return false;
    this.session = { pointerId, threadId, originalSpaceId, startX: x, startY: y, x, y, active: false };
    return true;
  }

  update(pointerId: number, x: number, y: number) {
    const session = this.session;
    if (!session || pointerId !== session.pointerId) return false;
    session.x = x;
    session.y = y;
    if (Math.hypot(x - session.startX, y - session.startY) >= 6) session.active = true;
    return session.active;
  }

  release(pointerId: number, spaceId: string | null, eligibleIds: readonly string[]) {
    const session = this.session;
    if (!session || session.pointerId !== pointerId) return null;
    this.session = null;
    if (!session.active || !spaceId || spaceId === session.originalSpaceId || !eligibleIds.includes(spaceId)) return null;
    return { threadId: session.threadId, spaceId };
  }

  cancel() {
    this.session = null;
  }
}

/** Pixels/second; outside the destination viewport never causes scrolling. */
export function spaceDragScrollSpeed(x: number, y: number, rect: { left: number; right: number; top: number; bottom: number; height: number }) {
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom || rect.height <= 0) return 0;
  const edge = Math.min(44, rect.height / 3);
  if (y < rect.top + edge) return -480 * (1 - (y - rect.top) / edge);
  if (y > rect.bottom - edge) return 480 * (1 - (rect.bottom - y) / edge);
  return 0;
}
