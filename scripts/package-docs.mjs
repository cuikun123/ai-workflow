import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {relocateLinks, userGuidePaths} from '../src/document-links.mjs';

export const packageDocumentPath = path => path === 'skills/README.md' ? 'docs/skills.md'
  : /^(?:skills|templates|schemas|sources|examples)\//u.test(path) ? 'resources/' + path : path;

export function copyPackageDocuments(repo, output) {
  const files = ['docs/quickstart.md', 'docs/usage.md', 'docs/releasing.md', 'SECURITY.md',
    'scripts/README.md', 'skills/README.md', 'sources/README.md', 'examples/bookmarks/README.md'];
  for (const path of files) {
    const target = packageDocumentPath(path);
    mkdirSync(dirname(join(output, target)), {recursive: true});
    writeFileSync(join(output, target), relocateLinks(readFileSync(join(repo, path), 'utf8'), path, target, packageDocumentPath));
  }
  mkdirSync(join(output, 'docs'), {recursive:true});
  writeFileSync(join(output, 'docs/README.md'), '# Iterlane 使用文档\n\n先安装到新项目，再按使用指南开发和验收。\n\n'
    + '- [快速开始](quickstart.md)\n- [使用指南](usage.md)\n- [技能索引](skills.md)\n'
    + '- [命令参考](../scripts/README.md)\n- [版本与支持范围](releasing.md)\n'
    + '- [收藏示例](../resources/examples/bookmarks/README.md)\n- [安全反馈](../SECURITY.md)\n');
}

export const deliveryDocumentPath = path => path.startsWith('resources/examples/bookmarks/')
  ? path.replace('resources/examples/', 'examples/')
  : path.startsWith('resources/') ? 'runtime/' + path : path;

export function copyDeliveryDocuments(source, output) {
  const files = userGuidePaths;
  for (const path of files) {
    const target = deliveryDocumentPath(path);
    if (target.startsWith('runtime/')) continue;
    mkdirSync(dirname(join(output, target)), {recursive: true});
    writeFileSync(join(output, target), relocateLinks(readFileSync(join(source, path), 'utf8'), path, target, deliveryDocumentPath));
  }
  const quickstart = 'docs/quickstart.md';
  writeFileSync(join(output, 'quickstart.md'), relocateLinks(readFileSync(join(source, quickstart), 'utf8'), quickstart, 'quickstart.md', deliveryDocumentPath));
}
