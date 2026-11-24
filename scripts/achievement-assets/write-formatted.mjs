/** Grava arquivos gerados já formatados pelo Prettier do repositório. */
import { writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';

export async function writeFormatted(path, content) {
  const options = (await resolveConfig(path)) ?? {};
  writeFileSync(path, await format(content, { ...options, filepath: path }));
}
