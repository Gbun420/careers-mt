import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldBypassAppCheck } from '../lib/appCheck';

test('shouldBypassAppCheck is enabled outside production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalToggle = process.env.ALLOW_NO_APP_CHECK;

  process.env.NODE_ENV = 'development';
  delete process.env.ALLOW_NO_APP_CHECK;

  assert.equal(shouldBypassAppCheck(), true);

  process.env.NODE_ENV = originalNodeEnv;
  process.env.ALLOW_NO_APP_CHECK = originalToggle;
});

test('shouldBypassAppCheck can be forced on in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalToggle = process.env.ALLOW_NO_APP_CHECK;

  process.env.NODE_ENV = 'production';
  process.env.ALLOW_NO_APP_CHECK = 'true';

  assert.equal(shouldBypassAppCheck(), true);

  process.env.NODE_ENV = originalNodeEnv;
  process.env.ALLOW_NO_APP_CHECK = originalToggle;
});
