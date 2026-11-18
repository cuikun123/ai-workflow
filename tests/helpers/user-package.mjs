import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import {listRegularFiles} from '../../src/paths.mjs';
import {brokenDocumentLinks} from './document-links.mjs';

// A build accidentally collecting all docs or the repository navigation must fail.
export function assertUserPackage(root, documentRoot = root) {
  const files = listRegularFiles(root);
  const forbidden = ['AGENTS.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'tests/README.md',
    'docs/decisions.md', 'docs/handoff.md', 'docs/roadmap.md', 'docs/project-tour.md'];
  for (const path of forbidden) assert.ok(!files.includes(path), 'Maintenance resource leaked: ' + path);
  assert.ok(!files.some(path => path.startsWith('docs/design/') || path.startsWith('adapters/')), 'Maintenance design or adapter resources leaked');
  for (const path of ['README.md', 'docs/README.md', 'docs/quickstart.md', 'docs/usage.md',
    'docs/releasing.md', 'docs/skills.md', 'scripts/README.md', 'SECURITY.md']) {
    assert.ok(files.includes(path), 'Missing user document: ' + path);
  }
  for (const path of files.filter(path => path.endsWith('.md'))) {
    assert.doesNotMatch(readFileSync(join(root, path), 'utf8'), /%LOCALAPPDATA%|ai-workflow-validation[\\/]|C:[\\/]Users[\\/]/u,
      'Local maintenance evidence leaked: ' + path);
  }
  const prefix = relative(documentRoot, root);
  assert.deepEqual(brokenDocumentLinks(documentRoot, files.filter(path=>/\.md$/iu.test(path)).map(path=>join(prefix,path))), [],
    'Every distributed Markdown document must have valid local links');
}
