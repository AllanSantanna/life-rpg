import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

interface Options<Panel extends HTMLElement> {
  panelRef?: RefObject<Panel | null>;
  minimumWidth?: number;
  maximumWidth?: number;
  preferredHeight?: number;
  maximumHeight?: number;
  beforeClose?: () => void;
}

/** Posicionamento, fechamento e animação compartilhados pelos controles flutuantes. */
export function useAnchoredPopover<Panel extends HTMLElement = HTMLDivElement>({
  panelRef,
  minimumWidth = 0,
  maximumWidth = Infinity,
  preferredHeight = 180,
  maximumHeight = 300,
  beforeClose,
}: Options<Panel> = {}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const ownPanel = useRef<Panel>(null);
  const panel = panelRef ?? ownPanel;
  const exitTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [position, setPosition] = useState({
    left: 8,
    top: 0 as number | undefined,
    bottom: undefined as number | undefined,
    width: minimumWidth,
    maxHeight: maximumHeight,
  });
  const show = useCallback(() => {
    if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    setExiting(false);
    setOpen(true);
  }, []);
  const close = useCallback(
    (restoreFocus = false) => {
      beforeClose?.();
      setOpen(false);
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        setExiting(false);
      else {
        setExiting(true);
        exitTimer.current = window.setTimeout(() => {
          setExiting(false);
          exitTimer.current = null;
        }, 120);
      }
      if (restoreFocus) anchor.current?.focus({ preventScroll: true });
    },
    [beforeClose],
  );
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      if (!anchor.current) return;
      const rect = anchor.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0,
        top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth,
        height = viewport?.height ?? window.innerHeight;
      const anchorTop = Math.max(top + 8, Math.min(rect.top, top + height - 8));
      const anchorBottom = Math.max(
        top + 8,
        Math.min(rect.bottom, top + height - 8),
      );
      const below = Math.max(0, top + height - anchorBottom - 14),
        above = Math.max(0, anchorTop - top - 14);
      const upwards = below < preferredHeight && above > below;
      const panelWidth = Math.min(
        Math.max(rect.width, minimumWidth),
        maximumWidth,
        Math.max(0, width - 16),
      );
      const next = {
        width: panelWidth,
        left: Math.max(
          left + 8,
          Math.min(rect.left, left + width - panelWidth - 8),
        ),
        top: upwards ? undefined : anchorBottom + 6,
        bottom: upwards ? window.innerHeight - anchorTop + 6 : undefined,
        maxHeight: Math.min(maximumHeight, upwards ? above : below),
      };
      setPosition((old) =>
        old.left === next.left &&
        old.top === next.top &&
        old.bottom === next.bottom &&
        old.width === next.width &&
        old.maxHeight === next.maxHeight
          ? old
          : next,
      );
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [open, minimumWidth, maximumWidth, preferredHeight, maximumHeight]);
  useEffect(() => {
    if (!open) return;
    function outside(event: Event) {
      if (
        event.target instanceof Node &&
        !anchor.current?.contains(event.target) &&
        !panel.current?.contains(event.target)
      )
        close();
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('click', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('click', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open, close, panel]);
  useEffect(
    () => () => {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    },
    [],
  );
  return {
    anchor,
    panel,
    open,
    mounted: open || exiting,
    position,
    show,
    close,
  };
}
