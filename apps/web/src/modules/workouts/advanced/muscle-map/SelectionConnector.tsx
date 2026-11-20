import { useLayoutEffect, useState, type RefObject } from 'react';
import type { Selection } from './anatomy';
/** Screen-space connector; recalculated for container resizing, never intercepts input. */
export function SelectionConnector({
  container,
  selection,
}: {
  container: RefObject<HTMLDivElement | null>;
  selection: Selection;
}) {
  const [line, setLine] = useState<{
    width: number;
    height: number;
    d: string;
  } | null>(null);
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    function update() {
      if (!root) return;
      const region = root.querySelector<SVGPathElement>(
        '.muscle-v2-surface[aria-pressed="true"]',
      );
      const detail = root.querySelector<HTMLElement>('.muscle-v2-details');
      if (!region || !detail) {
        setLine(null);
        return;
      }
      const frame = root.getBoundingClientRect();
      const source = region.getBoundingClientRect();
      const target = detail.getBoundingClientRect();
      // Stacked layouts retain the local callout; a long line would cross readable text.
      if (target.left <= source.right) {
        setLine(null);
        return;
      }
      const x = source.right - frame.left;
      const y = source.top + source.height / 2 - frame.top;
      const endX = target.left - frame.left;
      const endY = target.top + 45 - frame.top;
      const bendX = endX - 16;
      setLine({
        width: frame.width,
        height: frame.height,
        d: `M${x} ${y} H${bendX} V${endY} H${endX}`,
      });
    }
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, [container, selection]);
  return line ? (
    <svg
      className="muscle-v2-connector"
      viewBox={`0 0 ${line.width} ${line.height}`}
      aria-hidden="true"
    >
      <path d={line.d} />
    </svg>
  ) : null;
}
