import {posix} from 'node:path';

// Preserve prose and link labels when a human guide moves between layouts.
export function relocateLinks(text, sourcePath, targetPath, locate) {
  return text.replace(/(\[[^\]\n]+\]\()([^\s)]+)(\))/gu, (match, before, link, after) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/iu.test(link)) return match;
    const [local, ...fragment] = link.split('#');
    const original = posix.normalize(posix.join(posix.dirname(sourcePath), local));
    const relative = posix.relative(posix.dirname(targetPath), locate(original));
    return before + relative + (fragment.length ? '#' + fragment.join('#') : '') + after;
  });
}

export const installedResourcePath = path => path.startsWith('resources/skills/') && !path.startsWith('resources/skills/_shared/')
  ? '.agents/' + path.slice('resources/'.length) : '.ai-workflow/' + path;

export const userGuidePaths = Object.freeze(['docs/README.md', 'docs/quickstart.md', 'docs/usage.md',
  'docs/releasing.md', 'docs/skills.md', 'scripts/README.md', 'SECURITY.md',
  'resources/sources/README.md', 'resources/examples/bookmarks/README.md']);

export const isHumanGuide = path => path === 'README.md' || userGuidePaths.includes(path);

export const isUserPackageResource = (path, declaredPaths) => declaredPaths.has(path);
