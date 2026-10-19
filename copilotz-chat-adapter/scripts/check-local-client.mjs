import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const adapter = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(adapter, '..');
const source = process.argv[2] || process.env.COPILOTZ_SOURCE;
if (!source) throw new Error('Pass a Copilotz checkout path or set COPILOTZ_SOURCE.');
const core = resolve(source);
const coreConfig = JSON.parse(readFileSync(join(core, 'deno.json'), 'utf8'));
const imports = Object.fromEntries(Object.entries(coreConfig.imports).map(([name, value]) => [
  name, value.startsWith('./') ? pathToFileURL(resolve(core, value)).href : value,
]));
const npm = (name) => {
  const { version } = JSON.parse(readFileSync(join(repo, 'node_modules', name, 'package.json'), 'utf8'));
  return `npm:${name}@${version}`;
};
Object.assign(imports, {
  '@copilotz/chat-ui': pathToFileURL(join(repo, 'copilotz-chat-ui/dist/index.d.ts')).href,
  '@copilotz/chat-ui/model': pathToFileURL(join(repo, 'copilotz-chat-ui/dist/model.d.ts')).href,
  react: npm('@types/react'),
  'react/jsx-runtime': `${npm('@types/react')}/jsx-runtime`,
  'react-dom': npm('@types/react-dom'),
  'react-dom/client': `${npm('@types/react-dom')}/client`,
  'lucide-react': npm('lucide-react'),
  'react-markdown': npm('react-markdown'),
});

const temporary = mkdtempSync(join(tmpdir(), 'chat-adapter-local-'));
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: repo, stdio: 'inherit', ...options });
  if (result.error) console.error(result.error.message);
  return result.status ?? 1;
};
try {
  const config = join(temporary, 'deno.json');
  writeFileSync(config, JSON.stringify({
    imports,
    minimumDependencyAge: coreConfig.minimumDependencyAge,
    nodeModulesDir: 'auto',
    compilerOptions: {
      lib: ['dom', 'dom.iterable', 'esnext', 'deno.ns'],
      jsx: 'react-jsx', strict: true, noImplicitOverride: false,
    },
    unstable: ['sloppy-imports'],
  }, null, 2));
  // Check real source, including its transitive implementation: no converted
  // declarations, type shims, copied protocol or edits to the core checkout.
  const types = run('deno', ['check', '--config', config, '--no-lock',
    join(adapter, 'src/index.ts'), join(adapter, 'src/controller.ts')]);
  // Run independently so an upstream type error cannot hide protocol results.
  const protocol = run(process.execPath, ['--test', '--experimental-strip-types',
    join(adapter, 'scripts/local-protocol.test.ts')], {
    env: { ...process.env, COPILOTZ_SOURCE: core },
  });
  process.exitCode = types || protocol;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
