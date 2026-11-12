import { fileURLToPath } from 'node:url';
import { registerSkillPackageTests } from '../helpers/skill-package.mjs';
const bmad='0aa79baf6328b4a1e694ce10a12ffc36d7666554da128dff0e8fcda0fc536a66';
const superpowers='a37e0e9697144819e1d965176ac4ae5bc3fa02d11e7812036bbcadf6dafe2400';
// GSD digest is pinned from the complete normalized source license at creation.
const gsd='3a160aec61eeb28e75e8017346ee190db07986a09c4bd72555cc706f1d99e27e';
for(const [name,licenses] of Object.entries({
  'workflow-guide':{bmad,gsd},
  'build-foundation':{bmad},
  'release-work':{gsd,superpowers},
  'handle-incident':{superpowers},
  'discuss-design':{bmad},
})) registerSkillPackageTests(fileURLToPath(new URL(`../../skills/${name}/`,import.meta.url)),name,licenses);
