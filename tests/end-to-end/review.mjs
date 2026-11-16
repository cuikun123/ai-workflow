import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
// Binds stored host output to current bytes; it does not authenticate its author.
export function assertReviewCandidate(review, project, files) {
  assert.equal(review.passed,true);assert.ok(Array.isArray(review.findings));assert.equal(review.findings.length,0);assert.ok(typeof review.actual_host_agent==='string'&&review.actual_host_agent.length);
  for(const file of files){assert.ok(review.checked_paths?.includes(file),'Missing reviewed file: '+file);assert.equal(review.candidate_sha256?.[file],createHash('sha256').update(fs.readFileSync(path.join(project,file))).digest('hex'),'Stale host review: '+file);}return true;
}
