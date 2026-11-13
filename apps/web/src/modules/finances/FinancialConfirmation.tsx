import { useEffect, useId, useRef, type ReactNode } from 'react';
export function FinancialConfirmation({
  title,
  children,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    cancel.current?.focus();
    return () => {
      if (typeof element.close === 'function') element.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="financial-confirmation"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
      <button
        ref={cancel}
        type="button"
        className="filter-button"
        onClick={onCancel}
      >
        Cancelar
      </button>
    </dialog>
  );
}
