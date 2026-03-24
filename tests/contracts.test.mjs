import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relPath) => fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');

test('browser jobs view loads from the jobs API', () => {
  const script = read('public/script.js');
  assert.match(script, /fetch\((['"])\/api\/jobs\1\)/);
});

test('browser apply flow submits to the apply API', () => {
  const script = read('public/script.js');
  assert.match(script, /fetch\((['"])\/api\/apply\1\)/);
});

test('job filtering uses the job location field', () => {
  const script = read('public/script.js');
  const filterBlock = script.match(/function filterJobs\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(filterBlock, /job\.location/);
});

test('apply API writes employer metadata', () => {
  const api = read('api/apply.ts');
  assert.match(api, /employerId:/);
  assert.match(api, /companyName:/);
});

test('app check supports a dev bypass toggle', () => {
  const appCheck = read('lib/appCheck.ts');
  assert.match(appCheck, /ALLOW_NO_APP_CHECK/);
});
