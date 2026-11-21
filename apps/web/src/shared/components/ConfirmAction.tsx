import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Ação que exige confirmação explícita (exclusões e operações irreversíveis).
 * Ao abrir, o foco vai para “Cancelar”, a opção segura. Cancelar devolve o
 * foco ao gatilho; confirmar o devolve quando o gatilho ainda existe.
 */
export function ConfirmAction({
  label,
  detail,
  onConfirm,
  confirmLabel = 'Confirmar exclusão',
  ariaLabel,
  className = 'text-action',
}: {
  /** Texto visível do gatilho. */
  label: string;
  /** Consequência da ação, exibida antes da confirmação. */
  detail: string;
  onConfirm: () => unknown;
  confirmLabel?: string;
  /** Nome acessível quando o rótulo visível se repete numa lista. */
  ariaLabel?: string;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  useLayoutEffect(() => {
    if (confirming) cancel.current?.focus();
    else if (returnFocus.current && trigger.current?.isConnected)
      trigger.current.focus();
    returnFocus.current = false;
  }, [confirming]);
  const close = () => {
    returnFocus.current = true;
    setConfirming(false);
  };
  return confirming ? (
    <div
      className="strength-confirm"
      role="group"
      aria-label={`Confirmar ${(ariaLabel ?? label).toLowerCase()}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pending) close();
      }}
    >
      <p>{detail}</p>
      {error && (
        <p className="record-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="record-primary"
        disabled={pending}
        onClick={() => {
          setError('');
          try {
            const result = onConfirm();
            if (result instanceof Promise) {
              setPending(true);
              void result.then(
                () => {
                  setPending(false);
                  close();
                },
                () => {
                  setPending(false);
                  setError(
                    'A operação não foi confirmada. Os registros anteriores foram preservados.',
                  );
                },
              );
            } else close();
          } catch {
            setError(
              'A operação não foi confirmada. Os registros anteriores foram preservados.',
            );
          }
        }}
      >
        {pending ? 'Aguarde…' : confirmLabel}
      </button>
      <button
        ref={cancel}
        type="button"
        className="filter-button"
        disabled={pending}
        onClick={close}
      >
        Cancelar
      </button>
    </div>
  ) : (
    <button
      ref={trigger}
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={() => setConfirming(true)}
    >
      {label}
    </button>
  );
}
