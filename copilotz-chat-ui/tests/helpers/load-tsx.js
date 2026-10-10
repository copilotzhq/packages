import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';

// Render internal TSX components in Node without adding them to the public API.
// Node's type stripping alone cannot load JSX or extensionless TS imports.
export async function loadTsx(url) {
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('.') && context.parentURL) {
        for (const extension of ['.ts', '.tsx']) {
          const candidate = new URL(specifier + extension, context.parentURL);
          if (existsSync(candidate)) {
            return { url: candidate.href, shortCircuit: true };
          }
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (/\.tsx?$/.test(url)) {
        const { outputText } = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.React,
          },
          fileName: new URL(url).pathname,
        });
        return { format: 'module', source: outputText, shortCircuit: true };
      }
      return nextLoad(url, context);
    },
  });
  try {
    return await import(url.href);
  } finally {
    hooks.deregister();
  }
}
