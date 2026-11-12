import { fileURLToPath } from 'node:url';
import { registerSkillPackageTests } from '../helpers/skill-package.mjs';

registerSkillPackageTests(fileURLToPath(new URL('../../skills/test-work/', import.meta.url)), 'test-work', {
  'superpowers.txt': 'a37e0e9697144819e1d965176ac4ae5bc3fa02d11e7812036bbcadf6dafe2400',
});
