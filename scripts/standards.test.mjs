import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { ESLint } from 'eslint';
import {
  checkStandards,
  localLinks,
  requiredDocuments,
} from './check-standards.mjs';

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'life-rpg-standards-'));
  function write(file, text) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  try {
    for (const file of requiredDocuments) write(file, '# Guia\n');
    write(
      'AGENTS.md',
      requiredDocuments
        .slice(1)
        .map((file) => `[Guia](${file})`)
        .join('\n'),
    );
    write(
      'apps/web/src/shared/styles/index.css',
      '@theme { --color-primary: #dc2626; }\n.button { color: var(--color-primary); }',
    );
    run(root, write);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('documentação válida passa; links relativos, fragmentos e exemplos são tratados', () => {
  assert.deepEqual(
    localLinks(
      '```md\n[exemplo](inexistente.md)\n```\n[A](https://example.com) [B](#secao) [C](./guia.md#secao)',
    ),
    ['./guia.md#secao'],
  );
  fixture((root, write) => {
    write('docs/README.md', '# Docs\n[Entrada](../AGENTS.md#regras)');
    assert.deepEqual(checkStandards(root), []);
  });
});

test('rejeita documento obrigatório ausente e entrada sem referências', () => {
  fixture((root, write) => {
    rmSync(join(root, 'docs/design-system/colors.md'));
    write('AGENTS.md', '# Regras');
    const errors = checkStandards(root);
    assert.ok(
      errors.some((error) => error.includes('Documento obrigatório ausente')),
    );
    assert.ok(errors.some((error) => error.includes('AGENTS.md deve apontar')));
  });
});

test('rejeita links quebrados, externos ao repositório e codificação inválida', () => {
  fixture((root, write) => {
    write('docs/README.md', '[A](ausente.md) [B](../../fora.md) [C](%ZZ)');
    const errors = checkStandards(root);
    assert.equal(errors.length, 3);
    assert.ok(errors.every((error) => error.includes('Link')));
  });
});

test('detecta token desconhecido em CSS de módulo e aceita tokens existentes', () => {
  fixture((root, write) => {
    write(
      'apps/web/src/modules/example/style.css',
      '.x { color: var(--color-inexistente); }',
    );
    assert.ok(
      checkStandards(root).some((error) =>
        error.includes('--color-inexistente'),
      ),
    );
    write(
      'apps/web/src/modules/example/style.css',
      '.x { color: var(--color-primary); }',
    );
    assert.deepEqual(checkStandards(root), []);
  });
});

const eslint = new ESLint();
async function visualErrors(jsx) {
  const [result] = await eslint.lintText(
    `export function Example() { return (${jsx}); }`,
    {
      filePath: 'apps/web/src/shared/components/Example.tsx',
    },
  );
  assert.equal(result.fatalErrorCount, 0);
  return result.messages.filter(
    (message) => message.ruleId === 'design-system/no-visual-drift',
  );
}

test('ESLint bloqueia controles nativos inconsistentes e cores inline/arbitrárias', async () => {
  for (const jsx of [
    '<select aria-label="Tipo"><option>A</option></select>',
    '<input type="date" />',
    '<input type={"month"} />',
    '<button type="button" style={{ color: "#fff" }}>Salvar</button>',
    '<button type="button" style={{ background: `rgb(0 0 0)` }}>Salvar</button>',
    '<button type="button" className="hover:bg-[#123456]">Salvar</button>',
  ])
    assert.equal((await visualErrors(jsx)).length, 1, jsx);
});

test('ESLint permite tokens, componentes compartilhados e geometria calculada', async () => {
  for (const jsx of [
    '<button type="button" style={{ color: "var(--color-primary)", width: `${50}%` }}>Salvar</button>',
    '<button type="submit" className="bg-primary text-foreground">Salvar</button>',
    '<input type="number" />',
    '<CustomSelect label="Tipo" options={[]} />',
    '<CustomDatePicker label="Data" mode="date" />',
    '<ActionButton>Salvar</ActionButton>',
  ])
    assert.deepEqual(await visualErrors(jsx), []);
});

test('ESLint exige tipo explícito em botões nativos e aceita a API do ActionButton', async () => {
  const errors = await visualErrors('<button>Editar</button>');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].messageId, 'buttonType');
  assert.deepEqual(
    await visualErrors('<ActionButton>Editar</ActionButton>'),
    [],
  );
  assert.deepEqual(
    await visualErrors('<button type="reset">Limpar</button>'),
    [],
  );
});
