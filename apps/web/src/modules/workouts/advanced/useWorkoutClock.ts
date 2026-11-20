import { useEffect, useState } from 'react';
/** Minute resolution while visible, plus immediate refresh when returning to the app. */
export function useWorkoutClock(active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const update = () => {
      if (!document.hidden) setNow(Date.now());
    };
    update();
    const timer = window.setInterval(update, 60000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, [active]);
  return now;
}
