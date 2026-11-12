import { fileURLToPath } from 'node:url';
import { registerSkillPackageTests } from '../helpers/skill-package.mjs';

registerSkillPackageTests(fileURLToPath(new URL('../../skills/clarify-design/', import.meta.url)), 'clarify-design', {
  superpowers: 'a37e0e9697144819e1d965176ac4ae5bc3fa02d11e7812036bbcadf6dafe2400',
  specKit: '2510b446bc1f0cf9702453075d20cd88631e20e5642658edb7325d9c1eb534f7',
  mattPocock: '0e7ac423bf2c6e223b7c5b156f8cf72da49d748e56a1641402c31f22ad07dbb5',
  bmad: '0aa79baf6328b4a1e694ce10a12ffc36d7666554da128dff0e8fcda0fc536a66',
});
