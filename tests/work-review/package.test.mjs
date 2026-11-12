import { fileURLToPath } from 'node:url';
import { registerSkillPackageTests } from '../helpers/skill-package.mjs';

registerSkillPackageTests(fileURLToPath(new URL('../../skills/review-work/', import.meta.url)), 'review-work', {
  'superpowers.txt': 'a37e0e9697144819e1d965176ac4ae5bc3fa02d11e7812036bbcadf6dafe2400',
});
