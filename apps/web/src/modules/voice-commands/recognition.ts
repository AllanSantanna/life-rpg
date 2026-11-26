/**
 * Camada fina sobre a Web Speech API (`SpeechRecognition` ou
 * `webkitSpeechRecognition`). Só transforma fala em texto: não interpreta,
 * não grava áudio e não guarda transcrições. Um comando por vez, apenas
 * resultados finais, sem escuta contínua.
 */

/** Subconjunto usado da interface do navegador (os tipos do DOM não a trazem). */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult:
    | ((event: {
        results: ArrayLike<
          ArrayLike<{ transcript: string }> & { isFinal?: boolean }
        >;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function speechRecognitionConstructor(
  scope: object = globalThis,
): SpeechRecognitionConstructor | null {
  const candidate = scope as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return (
    candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null
  );
}

export type RecognitionError =
  | 'permission'
  | 'microphone'
  | 'no-speech'
  | 'timeout'
  | 'network'
  | 'unsupported'
  | 'interrupted';

export const recognitionMessages: Record<RecognitionError, string> = {
  permission:
    'O acesso ao microfone foi negado. Libere o microfone nas permissões do navegador ou digite o comando.',
  microphone:
    'Nenhum microfone disponível. Verifique o aparelho ou digite o comando.',
  'no-speech': 'Nenhuma fala foi detectada. Tente de novo, perto do microfone.',
  timeout: 'O tempo de escuta terminou sem um comando. Tente de novo.',
  network:
    'O serviço de reconhecimento de fala do navegador não respondeu. Verifique a conexão ou digite o comando.',
  unsupported: 'O reconhecimento de voz não está disponível neste navegador.',
  interrupted: 'O reconhecimento foi interrompido. Tente de novo.',
};

/** Códigos da especificação → erros apresentados. */
export function recognitionError(code: string): RecognitionError {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission';
    case 'audio-capture':
      return 'microphone';
    case 'no-speech':
      return 'no-speech';
    case 'network':
      return 'network';
    case 'language-not-supported':
      return 'unsupported';
    default:
      return 'interrupted';
  }
}

export interface ListenHandlers {
  /** O navegador começou a ouvir (permissão concedida). */
  onListening: () => void;
  onTranscript: (text: string) => void;
  onError: (error: RecognitionError) => void;
}

/**
 * Inicia uma escuta única. Deve ser chamada a partir de uma interação do
 * usuário. Devolve `cancel`, que interrompe e libera o microfone. Sem
 * resultado em `timeoutMs`, a escuta é encerrada com erro de tempo esgotado.
 */
export function listenOnce(
  Recognition: SpeechRecognitionConstructor,
  handlers: ListenHandlers,
  timeoutMs = 12000,
): () => void {
  const recognition = new Recognition();
  recognition.lang = 'pt-BR';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  let settled = false;
  let transcript = '';
  let failure: RecognitionError | null = null;
  const finish = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    if (failure) handlers.onError(failure);
    else if (transcript.trim()) handlers.onTranscript(transcript.trim());
    else handlers.onError('no-speech');
  };
  const timer = window.setTimeout(() => {
    failure ??= 'timeout';
    recognition.abort();
    finish();
  }, timeoutMs);
  recognition.onstart = () => {
    if (!settled) handlers.onListening();
  };
  recognition.onresult = (event) => {
    const parts: string[] = [];
    for (let index = 0; index < event.results.length; index++) {
      const result = event.results[index]!;
      if (result.isFinal !== false && result[0])
        parts.push(result[0].transcript);
    }
    transcript = parts.join(' ');
  };
  recognition.onerror = (event) => {
    // “aborted” vem do próprio cancelamento; os demais são falhas reais.
    if (event.error !== 'aborted') failure ??= recognitionError(event.error);
  };
  recognition.onend = finish;
  try {
    recognition.start();
  } catch {
    failure = 'interrupted';
    finish();
  }
  return () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    recognition.onstart = recognition.onresult = recognition.onerror = null;
    recognition.onend = null;
    recognition.abort();
  };
}
