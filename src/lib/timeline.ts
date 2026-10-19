import { dayStart } from './engine';
import type { ClassifiedEvent } from './types';

export const SHORT_CHANGE_MS = 5 * 60_000;

export interface TimelineBlock {
  id: string;
  start: number;
  end: number;
  events: ClassifiedEvent[];
  anchor: ClassifiedEvent | null;
}

function sameScreen(a: ClassifiedEvent, b: ClassifiedEvent): boolean {
  return (
    a.app === b.app &&
    a.title === b.title &&
    a.domain === b.domain &&
    a.activityId === b.activityId &&
    a.categoryId === b.categoryId &&
    a.projectId === b.projectId
  );
}

/** Presentation only: accounting and edits continue to use the original event IDs. */
export function buildTimeline(
  events: readonly ClassifiedEvent[],
  condensed = true,
): TimelineBlock[] {
  const fragments = events.flatMap((event) => {
    const parts: ClassifiedEvent[] = [];
    let start = event.start;
    while (start < event.end) {
      // Local calendar boundaries also work on days with a daylight-saving transition.
      const midnight = new Date(dayStart(new Date(start)));
      midnight.setDate(midnight.getDate() + 1);
      const end = Math.min(event.end, midnight.getTime());
      parts.push({ ...event, start, end });
      start = end;
    }
    return parts;
  });
  fragments.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const blocks: TimelineBlock[] = [];
  for (const event of fragments) {
    const previous = blocks.at(-1);
    const sustained = event.end - event.start >= SHORT_CHANGE_MS;
    const canJoin =
      condensed &&
      previous &&
      event.kind === 'active' &&
      previous.events[0].kind === 'active' &&
      previous.end === event.start &&
      dayStart(new Date(previous.start)) === dayStart(new Date(event.start)) &&
      (!sustained || !previous.anchor || sameScreen(previous.anchor, event));

    if (canJoin) {
      previous.events.push(event);
      previous.end = event.end;
      if (sustained && !previous.anchor) previous.anchor = event;
    } else {
      blocks.push({
        id: `${event.id}:${event.start}`,
        start: event.start,
        end: event.end,
        events: [event],
        anchor: event.kind === 'active' && sustained ? event : null,
      });
    }
  }
  return blocks.reverse();
}
