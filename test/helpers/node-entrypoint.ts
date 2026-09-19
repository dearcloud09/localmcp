import { fileURLToPath } from 'node:url';

/**
 * Test-only subprocess entry selection. A tsx source run needs a real .ts
 * entry and its own loader; compiled tests need the emitted .js entry.
 * Never inherit the test runner's IPC, coverage, --test, or inspector flags.
 * Do not fall back from a missing compiled file to source or vice versa.
 */
export function nodeEntrypoint(relativeJsPath: string, importer: string): { path: string; execArgv: string[] } {
  const parent = new URL(importer);
  if (parent.protocol !== 'file:' || !/\.(?:ts|js)$/.test(parent.pathname) ||
      !/^\.\.?\//.test(relativeJsPath) || !relativeJsPath.endsWith('.js') ||
      /[\0?#]/.test(relativeJsPath)) throw new Error('INVALID_TEST_ENTRYPOINT');
  const sourceMode = parent.pathname.endsWith('.ts');
  const target = new URL(sourceMode ? relativeJsPath.slice(0, -3) + '.ts' : relativeJsPath, parent);
  return { path: fileURLToPath(target), execArgv: sourceMode ? ['--import', 'tsx'] : [] };
}
