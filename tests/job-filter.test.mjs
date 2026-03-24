import assert from 'node:assert/strict';
import { matchesJobFilter } from '../public/job-filter.mjs';

const job = {
  title: 'Frontend Developer',
  companyName: 'Valletta Labs',
  location: 'Sliema',
};

assert.equal(matchesJobFilter(job, 'frontend', 'all malta'), true);
assert.equal(matchesJobFilter(job, 'labs', 'all malta'), true);
assert.equal(matchesJobFilter(job, 'frontend', 'sliema'), true);
assert.equal(matchesJobFilter(job, 'frontend', 'valletta'), false);
assert.equal(matchesJobFilter(job, '', ''), true);

console.log('job-filter tests passed');
