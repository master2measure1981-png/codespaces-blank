import test from "node:test";
import assert from "node:assert/strict";
import { lengthToMillimeters, millimetersToLength } from "../units.js";

test("inch and millimeter conversions round-trip positive and signed values", () => {
  assert.equal(lengthToMillimeters(1, "in"), 25.4);
  assert.equal(millimetersToLength(25.4, "in"), 1);
  assert.equal(lengthToMillimeters(-0.5, "in"), -12.7);
  assert.equal(millimetersToLength(-12.7, "mm"), -12.7);
});

test("length conversion rejects invalid values and units", () => {
  assert.throws(() => lengthToMillimeters(Number.NaN, "in"), /finite number/);
  assert.throws(() => millimetersToLength(1, "cm"), /Unsupported length unit/);
});
