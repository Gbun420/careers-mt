import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFitScore } from '../lib/ai';

test('parseFitScore returns the score and explanation from valid JSON', () => {
  const result = parseFitScore('{"score": 88, "explanation": "Strong match"}');

  assert.equal(result.score, 88);
  assert.equal(result.explanation, 'Strong match');
});

test('parseFitScore falls back when the payload is malformed', () => {
  const result = parseFitScore('not-json');

  assert.equal(result.score, 50);
  assert.equal(result.explanation, 'AI analysis failed.');
});
