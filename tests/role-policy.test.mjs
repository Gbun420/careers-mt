import assert from 'node:assert/strict';
import { resolveLoginRole } from '../public/role-policy.mjs';

assert.deepEqual(resolveLoginRole({ existingRole: null, requestedRole: 'CANDIDATE' }), {
  allowed: true,
  role: 'CANDIDATE',
});

assert.deepEqual(resolveLoginRole({ existingRole: null, requestedRole: 'EMPLOYER' }), {
  allowed: false,
  role: null,
  message: 'Employer access requires an approved account.',
});

assert.deepEqual(resolveLoginRole({ existingRole: 'EMPLOYER', requestedRole: 'CANDIDATE' }), {
  allowed: true,
  role: 'EMPLOYER',
});

console.log('role-policy tests passed');
