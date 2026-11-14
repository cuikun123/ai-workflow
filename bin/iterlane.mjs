#!/usr/bin/env node
try {
  const { runCli } = await import('../src/cli.mjs');
  process.exitCode = await runCli();
} catch (error) {
  const code = error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'MODULE_NOT_FOUND' ? 'PACKAGE_INVALID' : 'IO';
  const message = code === 'PACKAGE_INVALID' ? 'Runtime dependency is missing; run npm ci --ignore-scripts for the source checkout' : 'Runtime could not start';
  process.stdout.write(process.argv.includes('--json') ? JSON.stringify({ ok: false, error: { code, message, details: [] } }) + '\n' : `${code}: ${message}\n`);
  process.exitCode = code === 'PACKAGE_INVALID' ? 4 : 6;
}
