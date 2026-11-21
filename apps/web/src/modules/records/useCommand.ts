import { useState } from 'react';
import type { RecordCommand, RecordPageProps } from './types';
export function useCommand(onCommand: RecordPageProps['onCommand']) {
  const [message, setMessage] = useState('');
  function run(command: RecordCommand) {
    const error = onCommand(command);
    // O comando aplica o estado da sessão; a persistência é confirmada depois
    // pelo hook do jogador. O rodapé/aviso informa se houve gravação local.
    setMessage(error ?? 'Alteração aplicada.');
    return error;
  }
  return { run, message };
}
