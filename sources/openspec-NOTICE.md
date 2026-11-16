# OpenSpec parser-method attribution

Adapted fence masking, ATX heading normalization, section placement and explicit scenario-loss checks.
Fixed commit: 0fa4a9705c20ef1c571fe3ded74435733e4b73a1 (package metadata 1.16.1).
Source: https://github.com/Fission-AI/OpenSpec/tree/0fa4a9705c20ef1c571fe3ded74435733e4b73a1

src/core/parsers/code-fence.ts: 0ac01448db3e0cdd670fb8c5c0c4255399ea09005e2d60385d754e56a47155a2
src/core/parsers/requirement-blocks.ts: 32f9fbc28172f264b399157fbd413c1101dd31b2eef2a8c334ea5b213d7efcd7
src/core/parsers/spec-structure.ts: 662008d8311c8b7facb1034e933ca3c07611a28ff1e71a42a7d92a4e5be31d77

Local files: src/spec-docs.mjs and src/spec-deltas.mjs.
The complete upstream CLI, dependencies, filesystem writers and line-ending normalization are not adopted. Local IDs, record format, byte preservation and read-only checks are Iterlane contracts. No new runtime dependency is installed.

MIT License

Copyright (c) 2024 OpenSpec Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

