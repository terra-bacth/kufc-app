import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBatch } from '../src/lib/academy-validation.ts';

test('batch schedule requires days, increasing times, and a nonnegative whole-paise fee', () => {
  const valid = { name: 'Evening', branchId: 'branch', coachId: 'coach', days: ['Mon'], startTime: '16:00', endTime: '17:00', monthlyFee: 1000 };
  assert.equal(validateBatch(valid), null);
  for (const patch of [{ days: [] }, { days: ['Funday'] }, { endTime: '15:00' }, { monthlyFee: -1 }, { monthlyFee: 1.234 }, { monthlyFee: Infinity }, { name: ' ' }, { coachId: '' }]) {
    assert.ok(validateBatch({ ...valid, ...patch }));
  }
});
