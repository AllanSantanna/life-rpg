import { useEffect, useRef, type RefObject } from 'react';

/** Distância mínima, em px, para que um gesto deixe de ser clique. */
export const DRAG_THRESHOLD = 6;

/**
 * Arraste horizontal com mouse sobre uma área com `overflow-x: auto`.
 *
 * Toque e caneta usam a rolagem nativa: o navegador já distingue toque de
 * deslize, mantém inércia e libera gestos verticais para a página. Para o
 * mouse, a posição é aplicada diretamente em `scrollLeft`, sem estado React
 * durante o movimento. Depois de um arraste, o clique seguinte é descartado
 * para não selecionar um dia acidentalmente.
 *
 * Retorna uma ref que indica se há arraste em andamento, para que
 * reposicionamentos automáticos não disputem a posição com o usuário.
 */
export function useDragScroll(target: RefObject<HTMLElement | null>) {
  const dragging = useRef(false);
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const area = element;
    let gesture: {
      id: number;
      x: number;
      y: number;
      left: number;
      moved: boolean;
    } | null = null;
    let suppressClick = false;
    function down(event: PointerEvent) {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      gesture = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: area.scrollLeft,
        moved: false,
      };
    }
    function move(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x;
      if (!gesture.moved) {
        const dy = event.clientY - gesture.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_THRESHOLD) return;
        // Movimento predominantemente vertical não é arraste do calendário.
        if (Math.abs(dy) > Math.abs(dx)) {
          gesture = null;
          return;
        }
        gesture.moved = true;
        dragging.current = true;
        area.classList.add('is-dragging');
        try {
          area.setPointerCapture(event.pointerId);
        } catch {
          // Captura indisponível: o arraste continua enquanto o ponteiro estiver na área.
        }
      }
      event.preventDefault();
      area.scrollLeft = gesture.left - dx;
    }
    function end(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.id) return;
      if (gesture.moved) {
        suppressClick = true;
        // O clique, quando existe, é despachado logo após o pointerup.
        window.setTimeout(() => {
          suppressClick = false;
        }, 0);
        area.classList.remove('is-dragging');
        dragging.current = false;
        if (area.hasPointerCapture?.(event.pointerId))
          area.releasePointerCapture(event.pointerId);
      }
      gesture = null;
    }
    function click(event: MouseEvent) {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }
    function nativeDrag(event: DragEvent) {
      event.preventDefault();
    }
    area.addEventListener('pointerdown', down);
    area.addEventListener('pointermove', move);
    area.addEventListener('pointerup', end);
    area.addEventListener('pointercancel', end);
    area.addEventListener('click', click, true);
    area.addEventListener('dragstart', nativeDrag);
    return () => {
      area.removeEventListener('pointerdown', down);
      area.removeEventListener('pointermove', move);
      area.removeEventListener('pointerup', end);
      area.removeEventListener('pointercancel', end);
      area.removeEventListener('click', click, true);
      area.removeEventListener('dragstart', nativeDrag);
      area.classList.remove('is-dragging');
      dragging.current = false;
    };
  }, [target]);
  return dragging;
}
