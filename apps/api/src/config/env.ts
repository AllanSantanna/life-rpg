export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.PORT ?? '3001');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um inteiro entre 1 e 65535.');
  }
  const webOrigin = env.WEB_ORIGIN ?? 'http://localhost:5173';
  const url = new URL(webOrigin);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== webOrigin) {
    throw new Error('WEB_ORIGIN deve ser uma origem HTTP(S) sem caminho.');
  }
  return { port, webOrigin };
}
