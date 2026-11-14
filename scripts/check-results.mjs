import { resolve } from 'node:path';

export function evaluateTestEvents(events, requiredFiles) {
  const normalized = value => typeof value === 'string' ? resolve(value).replaceAll('\\', '/') : null;
  const summaries = events.filter(e => e.type === 'test:summary');
  const files = summaries.filter(e => e.data.file);
  const total = summaries.findLast(e => !e.data.file);
  if (!total || !total.data.success || !files.length) throw new Error('Completed test summaries are required');
  const passed = files.reduce((sum, event) => sum + event.data.counts.passed, 0);
  if (!passed) throw new Error('Zero tests passed');
  if (events.some(e => e.type === 'test:fail' || e.data?.skip || e.data?.todo)) throw new Error('Failed, skipped or todo tests are not allowed');
  if (summaries.some(e => !e.data.success || ['failed', 'cancelled', 'skipped', 'todo'].some(key => e.data.counts[key] !== 0))) throw new Error('Test summary contains unsuccessful tests');
  for (const file of requiredFiles) {
    const target = normalized(file);
    if (!files.some(e => {
      const source = normalized(e.data.file), counts = e.data.counts;
      return source === target && counts.passed > 0 && counts.passed === counts.tests;
    })) throw new Error('Required test file did not pass: ' + file);
  }
  return { passed, failed: 0, skipped: 0, todo: 0, requiredFiles: requiredFiles.length };
}
