import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeJobData } from '../lib/job-data';

test('normalizeJobData maps legacy company fields into a canonical shape', () => {
  const job = normalizeJobData({
    title: 'Frontend Developer',
    company: 'Valletta Labs',
    employerName: 'Valletta Labs',
    employerEmail: 'jobs@vallettalabs.mt',
    location: 'Sliema',
    description: 'Build the careers platform for Malta.',
    knockoutQuestions: [{ question: 'Do you have a work permit?', required: true }],
  });

  assert.equal(job.companyName, 'Valletta Labs');
  assert.equal(job.employerEmail, 'jobs@vallettalabs.mt');
  assert.equal(job.location, 'Sliema');
  assert.equal(job.knockoutQuestions.length, 1);
});

test('normalizeJobData preserves the current frontend shape', () => {
  const job = normalizeJobData({
    title: 'Product Manager',
    companyName: 'Blue Sky Ltd',
    employerId: 'emp123',
    location: 'Valletta',
    description: 'Lead the product team.',
    knockoutQuestions: [],
  });

  assert.equal(job.companyName, 'Blue Sky Ltd');
  assert.equal(job.employerId, 'emp123');
  assert.equal(job.location, 'Valletta');
});
