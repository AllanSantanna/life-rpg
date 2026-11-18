import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const requiredDocuments = [
  'AGENTS.md',
  'docs/README.md',
  'docs/design-system/README.md',
  'docs/design-system/colors.md',
  'docs/design-system/typography.md',
  'docs/design-system/spacing.md',
  'docs/design-system/components.md',
  'docs/design-system/responsive.md',
  'docs/design-system/accessibility.md',
  'docs/architecture/README.md',
  'docs/architecture/conventions.md',
  'docs/ai/development-rules.md',
  'docs/ai/git-workflow.md',
  'docs/ai/feature-checklist.md',
  'docs/ai/review-checklist.md',
];

export function localLinks(markdown) {
  const prose = markdown.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
  return [...prose.matchAll(/\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))\)/g)]
    .map((match) => match[1] ?? match[2])
    .filter((target) => !/^(?:[a-z][\w+.-]*:|#|\/\/)/i.test(target));
}

function cssFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? cssFiles(path)
      : entry.isFile() && entry.name.endsWith('.css')
        ? [path]
        : [];
  });
}

export function checkStandards(root) {
  const errors = [];
  for (const file of requiredDocuments) {
    const path = join(root, file);
    if (!existsSync(path) || !statSync(path).isFile()) {
      errors.push(`Documento obrigatório ausente: ${file}`);
      continue;
    }
    const markdown = readFileSync(path, 'utf8');
    if (!markdown.trim()) errors.push(`Documento vazio: ${file}`);
    for (const target of localLinks(markdown)) {
      let decoded;
      try {
        decoded = decodeURIComponent(target.split(/[?#]/)[0]);
      } catch {
        errors.push(`Link inválido em ${file}: ${target}`);
        continue;
      }
      const destination = resolve(dirname(path), decoded);
      const relativePath = relative(root, destination);
      if (
        relativePath === '..' ||
        relativePath.startsWith(`..${sep}`) ||
        !existsSync(destination)
      )
        errors.push(`Link local inválido em ${file}: ${target}`);
    }
    if (file === 'AGENTS.md') {
      const links = localLinks(markdown);
      for (const target of [
        'docs/README.md',
        'docs/design-system/README.md',
        'docs/architecture/README.md',
        'docs/ai/development-rules.md',
        'docs/ai/git-workflow.md',
        'docs/ai/feature-checklist.md',
        'docs/ai/review-checklist.md',
      ])
        if (!links.includes(target))
          errors.push(`AGENTS.md deve apontar para ${target}`);
    }
  }

  const themePath = join(root, 'apps/web/src/shared/styles/index.css');
  if (!existsSync(themePath)) {
    errors.push('CSS do tema ausente: apps/web/src/shared/styles/index.css');
    return errors;
  }
  const theme =
    readFileSync(themePath, 'utf8').match(/@theme\s*\{([^}]+)\}/)?.[1] ?? '';
  const colors = new Set(
    [...theme.matchAll(/(--color-[\w-]+)\s*:/g)].map((match) => match[1]),
  );
  if (!colors.size)
    errors.push('O tema deve declarar tokens --color-* em @theme.');
  for (const path of cssFiles(join(root, 'apps/web/src'))) {
    const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of css.matchAll(/var\(\s*(--color-[\w-]+)/g)) {
      if (!colors.has(match[1]))
        errors.push(
          `Token de cor não declarado em @theme: ${match[1]} (${relative(root, path)})`,
        );
    }
  }
  return errors;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const errors = checkStandards(root);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log('Padrões: documentação, links locais e tokens de cor válidos.');
  }
}
