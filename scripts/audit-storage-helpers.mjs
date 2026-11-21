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
export async function readSnapshot(page) {
  await page.locator('.app-shell').waitFor();
  await page
    .getByText('Gravação em andamento · aguarde a confirmação', { exact: true })
    .waitFor({ state: 'hidden' });
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
