import { useState } from 'react';
import type { RecordCommand, RecordPageProps } from './types';
export function useCommand(onCommand: RecordPageProps['onCommand']) {
  const [message, setMessage] = useState('');
  function run(command: RecordCommand) {
    const error = onCommand(command);
    setMessage(error ?? 'Alteração salva.');
    return error;
  }
  return { run, message };
}
