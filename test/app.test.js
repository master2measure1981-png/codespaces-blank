import test from "node:test";
import assert from "node:assert/strict";
import {
  MATERIAL_CTE_UM_PER_M_C,
  compensateDifferential,
  compensateDirect,
  evaluateTolerance
} from "../thermal-compensation.js";

test("direct compensation returns reference dimension and expanded uncertainty", () => {
  const result = compensateDirect({
    measuredLengthMm: 100,
    workpieceCteUmPerMC: MATERIAL_CTE_UM_PER_M_C.aluminum,
    workpieceTemperatureC: 25,
    uMeasuredLengthMm: 0.001,
    coverageFactor: 2
  });
  assert.ok(Math.abs(result.correctedLengthMm - 99.9884513339) < 1e-9);
  assert.ok(Math.abs(result.expandedUncertaintyMm - 0.0019997690267) < 1e-12);
});

test("differential compensation respects signed part-minus-master indication", () => {
  const result = compensateDifferential({
    comparatorDifferenceMm: 0.01,
    masterLengthAtReferenceMm: 100,
    masterCteUmPerMC: 11.5,
    masterTemperatureC: 20,
    workpieceCteUmPerMC: 23.1,
    workpieceTemperatureC: 25
  });
  assert.ok(Math.abs(result.correctedLengthMm - 99.998450179) < 1e-9);
  assert.equal(result.mode, "differential-comparator");
});

test("tolerance evaluation identifies an uncertainty interval crossing a limit", () => {
  const result = evaluateTolerance({
    measuredValueMm: 10,
    expandedUncertaintyMm: 0.1,
    lowerLimitMm: 9.95,
    upperLimitMm: 10.2
  });
  assert.equal(result.decision, "INDETERMINATE");
});

test("invalid uncertainty and invalid tolerance bounds are rejected", () => {
  assert.throws(() => compensateDirect({
    measuredLengthMm: 10,
    workpieceCteUmPerMC: 11.5,
    workpieceTemperatureC: 20,
    uMeasuredLengthMm: -0.1
  }), /cannot be negative/);
  assert.throws(() => evaluateTolerance({
    measuredValueMm: 10,
    lowerLimitMm: 11,
    upperLimitMm: 9
  }), /must be less than/);
});
