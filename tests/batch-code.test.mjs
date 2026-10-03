import { test } from "node:test";
import assert from "node:assert/strict";
import { generateBatchCode, normalizeBatchCode, validateBatchCode } from "../src/lib/academy-validation.ts";

test("batch codes are 6 chars from the unambiguous alphabet", () => {
  for (let i = 0; i < 500; i++) {
    const code = generateBatchCode();
    assert.equal(code.length, 6);
    assert.equal(validateBatchCode(code), null);
    // Glyphs that get confused when read aloud or retyped.
    for (const bad of ["0", "O", "1", "I", "L"]) {
      assert.ok(!code.includes(bad), `code ${code} contains ${bad}`);
    }
  }
});

test("normalization tolerates how humans type a code", () => {
  assert.equal(normalizeBatchCode("k7m-2qx"), "K7M2QX");
  assert.equal(normalizeBatchCode(" K7M 2QX "), "K7M2QX");
});

test("validateBatchCode rejects wrong length and bad characters", () => {
  assert.ok(validateBatchCode(""));
  assert.ok(validateBatchCode("K7M2Q"));
  assert.ok(validateBatchCode("K7M2QXX"));
  assert.ok(validateBatchCode("K7M2Q0"));
  assert.ok(validateBatchCode("K7M2QI"));
  assert.equal(validateBatchCode("K7M2QX"), null);
});

test("generated codes do not collide across a large sample", () => {
  // 31^6 ≈ 887M, so collisions in 20k are unlikely; this guards the generator,
  // not the alphabet.
  const seen = new Set();
  for (let i = 0; i < 20000; i++) seen.add(generateBatchCode());
  assert.equal(seen.size, 20000);
});