import { useEffect, useRef, useState } from 'react';

/** Feedback transitório de apresentação; não altera o progresso recebido. */
export function useProgressFeedback(value: number) {
  const previous = useRef(value);
  const sequence = useRef(0);
  const [feedback, setFeedback] = useState({ delta: 0, sequence: 0 });

  useEffect(() => {
    const delta = value - previous.current;
    previous.current = value;
    if (delta <= 0) {
      setFeedback({ delta: 0, sequence: sequence.current });
      return;
    }
    sequence.current += 1;
    setFeedback({ delta, sequence: sequence.current });
    const timeout = window.setTimeout(() => {
      setFeedback((current) => ({ ...current, delta: 0 }));
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [value]);

  return feedback;
}
