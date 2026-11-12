import { fileURLToPath } from 'node:url';
import { registerSkillPackageTests } from '../helpers/skill-package.mjs';

registerSkillPackageTests(fileURLToPath(new URL('../../skills/execute-task/', import.meta.url)), 'execute-task', {
  'gsd.txt': '3a160aec61eeb28e75e8017346ee190db07986a09c4bd72555cc706f1d99e27e',
  'superpowers.txt': 'a37e0e9697144819e1d965176ac4ae5bc3fa02d11e7812036bbcadf6dafe2400',
});
