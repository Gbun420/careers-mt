import test from 'node:test';
import assert from 'node:assert/strict';
import { computeUnlockPrice, formatPrice } from '../lib/payments.ts';

test('computeUnlockPrice returns correct cents for various levels', () => {
  assert.strictEqual(computeUnlockPrice('free'), 0, 'Free level should be 0');
  assert.strictEqual(computeUnlockPrice('standard'), 1200, 'Standard level should be 1200');
  assert.strictEqual(computeUnlockPrice('ppqa'), 1200, 'PPQA level should be 1200');
  assert.strictEqual(computeUnlockPrice('executive'), 25000, 'Executive level should be 25000');
  assert.strictEqual(computeUnlockPrice(undefined), 1200, 'Undefined should default to standard');
  assert.strictEqual(computeUnlockPrice('unknown'), 1200, 'Unknown should default to standard');
});

test('formatPrice formats cents to EUR string', () => {
  // Note: format depends on locale, we use en-MT which might use different separators depending on environment.
  // We just check if it contains the currency and the number.
  const result = formatPrice(1200);
  assert.ok(result.includes('12.00'), 'Price should include 12.00');
  assert.ok(result.includes('€'), 'Price should include Euro symbol');
});
