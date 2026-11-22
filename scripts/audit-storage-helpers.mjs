/** Helpers exclusively for disposable audit contexts, never a real profile. */
export async function resetFixtureDatabase(page) {
  await page.locator('.app-shell').waitFor();
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase('life-rpg:records');
        request.onsuccess = () => resolve();
        request.onerror = () =>
          reject(new Error('Falha ao preparar o banco isolado da fixture.'));
        request.onblocked = () =>
          reject(new Error('Uma conexão de auditoria não foi fechada.'));
      }),
  );
}
/** Texto bruto do snapshot canônico confirmado (`state/current`), sem
 * consultar a interface. `null` quando ainda não existe. */
export function readCanonical(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('life-rpg:records', 1);
        request.onupgradeneeded = () => {
          request.transaction.abort();
          reject(new Error('Banco da fixture não foi inicializado.'));
        };
        request.onerror = () =>
          reject(new Error('Não foi possível ler a fixture.'));
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('state', 'readonly');
          const get = tx.objectStore('state').get('current');
          let raw = null;
          get.onsuccess = () => {
            raw = get.result?.raw ?? null;
          };
          tx.oncomplete = () => {
            db.close();
            resolve(raw);
          };
          tx.onabort = () => {
            db.close();
            reject(new Error('Leitura da fixture interrompida.'));
          };
        };
      }),
  );
}
/**
 * Aguarda o COMMIT de uma ação: o snapshot canônico difere de `previous`.
 * O rótulo "Registros salvos…" não serve de sinal: ele já aparece antes da
 * ação e só muda para "Gravação em andamento" num efeito posterior ao clique.
 * Navegar antes do commit descarta a transação pendente (via CDP não há
 * aviso de beforeunload). Não usa espera fixa: lê o IndexedDB até mudar.
 */
export async function waitForCommit(page, previous) {
  await page.waitForFunction(
    (previous) =>
      new Promise((resolve) => {
        const request = indexedDB.open('life-rpg:records', 1);
        request.onupgradeneeded = () => {
          request.transaction.abort();
          resolve(false);
        };
        request.onerror = () => resolve(false);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('state', 'readonly');
          const get = tx.objectStore('state').get('current');
          get.onsuccess = () => {
            const raw = get.result?.raw ?? null;
            db.close();
            resolve(raw !== null && raw !== previous);
          };
          get.onerror = () => {
            db.close();
            resolve(false);
          };
        };
      }),
    previous,
  );
  return readCanonical(page);
}
export async function readSnapshot(page) {
  await page.locator('.app-shell').waitFor();
  await page
    .getByText('Gravação em andamento · aguarde a confirmação', { exact: true })
    .waitFor({ state: 'hidden' });
  return readCanonical(page);
}
