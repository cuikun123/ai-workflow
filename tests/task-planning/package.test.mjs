import { fileURLToPath } from 'node:url';
import { registerSkillPackageTests } from '../helpers/skill-package.mjs';

registerSkillPackageTests(fileURLToPath(new URL('../../skills/plan-tasks/', import.meta.url)), 'plan-tasks', {
  'superpowers.txt': 'a37e0e9697144819e1d965176ac4ae5bc3fa02d11e7812036bbcadf6dafe2400',
  'spec-kit.txt': '2510b446bc1f0cf9702453075d20cd88631e20e5642658edb7325d9c1eb534f7',
});
