import { useEffect, useState } from 'react';
import { localDate } from './dates';
export function useToday() {
  const [today, setToday] = useState(() => localDate());
  useEffect(() => {
    const update = () => setToday(localDate());
    const interval = window.setInterval(update, 60000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return today;
}
