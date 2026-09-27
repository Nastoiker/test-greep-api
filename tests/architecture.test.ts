import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const sourceRoot = resolve('src');
const ranks: Record<string, number> = {
  shared: 0,
  entities: 1,
  features: 2,
  widgets: 3,
  pages: 4,
  app: 5,
};
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? files(path)
      : /\.tsx?$/.test(path) && !path.endsWith('.d.ts')
        ? [path]
        : [];
  });
}
function parts(file: string) {
  return relative(sourceRoot, file).replaceAll('\\', '/').split('/');
}
function importIssue(from: string, to: string): string | undefined {
  const a = parts(from),
    b = parts(to);
  const sourceRank = ranks[a[0]!],
    targetRank = ranks[b[0]!];
  if (sourceRank === undefined || targetRank === undefined) return 'Unknown FSD layer';
  if (targetRank > sourceRank) return 'Import from an upper layer';
  if (sourceRank === targetRank && !['shared', 'app'].includes(a[0]!) && a[1] !== b[1])
    return 'Cross-slice import on the same layer';
  const sameSlice = a[0] === b[0] && (a[1] === b[1] || ['shared', 'app'].includes(a[0]!));
  if (!sameSlice && !to.endsWith(`${join('', 'index.ts')}`))
    return 'Import bypasses public index.ts';
  return undefined;
}

test('FSD architecture guard detects forbidden dependency examples', () => {
  assert.match(
    importIssue(
      resolve('src/entities/chat/model/chat.ts'),
      resolve('src/features/create-chat/index.ts'),
    )!,
    /upper/,
  );
  assert.match(
    importIssue(
      resolve('src/features/create-chat/index.ts'),
      resolve('src/features/send-message/index.ts'),
    )!,
    /Cross-slice/,
  );
  assert.match(
    importIssue(resolve('src/pages/chat/index.ts'), resolve('src/entities/chat/model/chat.ts'))!,
    /public/,
  );
  assert.equal(
    importIssue(resolve('src/pages/chat/index.ts'), resolve('src/entities/chat/index.ts')),
    undefined,
  );
});

test('source imports obey FSD layers, slice isolation and public APIs', () => {
  const violations: string[] = [];
  for (const file of files(sourceRoot)) {
    const tree = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function check(node: ts.Node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const specifier = node.moduleSpecifier.text;
        if (specifier.startsWith('@/') || specifier.startsWith('.')) {
          const raw = specifier.startsWith('@/')
            ? resolve(sourceRoot, specifier.slice(2))
            : resolve(dirname(file), specifier);
          if (!raw.endsWith('.css')) {
            const target = [`${raw}.ts`, `${raw}.tsx`, join(raw, 'index.ts')].find(existsSync);
            const issue = target ? importIssue(file, target) : 'Unresolved internal import';
            if (issue) violations.push(`${relative(sourceRoot, file)} → ${specifier}: ${issue}`);
          }
        }
      }
      ts.forEachChild(node, check);
    }
    check(tree);
  }
  assert.deepEqual(violations, []);
});

test('application code reads environment only through shared/config', () => {
  const violations = files(sourceRoot)
    .filter((file) => !parts(file).slice(0, 2).join('/').startsWith('shared/config'))
    .filter((file) => /import\.meta\.env|process\.env/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(violations, []);
});
