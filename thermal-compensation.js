/**
 * DataTech: Metrology Suite — Thermal Compensation Engine
 *
 * Units: length in mm, temperature in °C, CTE in µm/(m·°C).
 * Uncertainty inputs are standard uncertainties (1 sigma).
 */

const CTE_SCALE = 1e-6;
const DEFAULT_REFERENCE_TEMPERATURE_C = 20;
const DEFAULT_COVERAGE_FACTOR = 2;

export const MATERIAL_CTE_UM_PER_M_C = Object.freeze({
  aluminum: 23.1,
  steel: 11.5,
  stainless_steel: 17.3,
  copper: 16.7,
  brass: 19.0,
  cast_iron: 10.5,
  titanium: 8.6,
  invar: 1.2
});

function finite(name, value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
  return value;
}

function nonNegative(name, value) {
  finite(name, value);
  if (value < 0) throw new RangeError(`${name} cannot be negative.`);
  return value;
}

function positive(name, value) {
  finite(name, value);
  if (value <= 0) throw new RangeError(`${name} must be greater than zero.`);
  return value;
}

function cteFactor(alphaUmPerMC, temperatureC, referenceTemperatureC) {
  const alpha = finite("CTE", alphaUmPerMC) * CTE_SCALE;
  const deltaT = finite("temperature", temperatureC) -
    finite("reference temperature", referenceTemperatureC);
  const factor = 1 + alpha * deltaT;
  if (factor <= 0) {
    throw new RangeError("Thermal expansion factor must be greater than zero.");
  }
  return { alpha, deltaT, factor };
}

function rss(terms) {
  return Math.sqrt(terms.reduce((sum, term) => sum + term * term, 0));
}

export function compensateDirect(input) {
  const {
    measuredLengthMm,
    workpieceCteUmPerMC,
    workpieceTemperatureC,
    referenceTemperatureC = DEFAULT_REFERENCE_TEMPERATURE_C,
    uMeasuredLengthMm = 0,
    uWorkpieceCteUmPerMC = 0,
    uWorkpieceTemperatureC = 0,
    coverageFactor = DEFAULT_COVERAGE_FACTOR
  } = input ?? {};

  positive("measuredLengthMm", measuredLengthMm);
  nonNegative("uMeasuredLengthMm", uMeasuredLengthMm);
  nonNegative("uWorkpieceCteUmPerMC", uWorkpieceCteUmPerMC);
  nonNegative("uWorkpieceTemperatureC", uWorkpieceTemperatureC);
  positive("coverageFactor", coverageFactor);

  const { alpha, deltaT, factor } = cteFactor(
    workpieceCteUmPerMC, workpieceTemperatureC, referenceTemperatureC
  );
  const correctedLengthMm = measuredLengthMm / factor;

  const uncertaintyContributions = {
    measuredLength: Math.abs(1 / factor) * uMeasuredLengthMm,
    cte: Math.abs(-measuredLengthMm * deltaT * CTE_SCALE / (factor ** 2)) *
      uWorkpieceCteUmPerMC,
    temperature: Math.abs(-measuredLengthMm * alpha / (factor ** 2)) *
      uWorkpieceTemperatureC
  };
  const standardUncertaintyMm = rss(Object.values(uncertaintyContributions));

  return {
    mode: "direct",
    correctedLengthMm,
    standardUncertaintyMm,
    expandedUncertaintyMm: coverageFactor * standardUncertaintyMm,
    coverageFactor,
    thermalFactor: factor,
    deltaTemperatureC: deltaT,
    uncertaintyContributionsMm: uncertaintyContributions,
    referenceTemperatureC
  };
}

export function compensateDifferential(input) {
  const {
    comparatorDifferenceMm,
    masterLengthAtReferenceMm,
    masterCteUmPerMC,
    masterTemperatureC,
    workpieceCteUmPerMC,
    workpieceTemperatureC,
    referenceTemperatureC = DEFAULT_REFERENCE_TEMPERATURE_C,
    uComparatorDifferenceMm = 0,
    uMasterLengthMm = 0,
    uMasterCteUmPerMC = 0,
    uMasterTemperatureC = 0,
    uWorkpieceCteUmPerMC = 0,
    uWorkpieceTemperatureC = 0,
    coverageFactor = DEFAULT_COVERAGE_FACTOR
  } = input ?? {};

  finite("comparatorDifferenceMm", comparatorDifferenceMm);
  positive("masterLengthAtReferenceMm", masterLengthAtReferenceMm);
  nonNegative("uComparatorDifferenceMm", uComparatorDifferenceMm);
  nonNegative("uMasterLengthMm", uMasterLengthMm);
  nonNegative("uMasterCteUmPerMC", uMasterCteUmPerMC);
  nonNegative("uMasterTemperatureC", uMasterTemperatureC);
  nonNegative("uWorkpieceCteUmPerMC", uWorkpieceCteUmPerMC);
  nonNegative("uWorkpieceTemperatureC", uWorkpieceTemperatureC);
  positive("coverageFactor", coverageFactor);

  const master = cteFactor(
    masterCteUmPerMC, masterTemperatureC, referenceTemperatureC
  );
  const part = cteFactor(
    workpieceCteUmPerMC, workpieceTemperatureC, referenceTemperatureC
  );

  const numerator = comparatorDifferenceMm +
    masterLengthAtReferenceMm * master.factor;
  const correctedLengthMm = numerator / part.factor;

  const sensitivities = {
    comparatorDifference: 1 / part.factor,
    masterLength: master.factor / part.factor,
    masterCte: masterLengthAtReferenceMm * master.deltaT * CTE_SCALE / part.factor,
    masterTemperature: masterLengthAtReferenceMm * master.alpha / part.factor,
    workpieceCte: -correctedLengthMm * part.deltaT * CTE_SCALE / part.factor,
    workpieceTemperature: -correctedLengthMm * part.alpha / part.factor
  };

  const uncertaintyContributionsMm = {
    comparatorDifference: Math.abs(sensitivities.comparatorDifference) *
      uComparatorDifferenceMm,
    masterLength: Math.abs(sensitivities.masterLength) * uMasterLengthMm,
    masterCte: Math.abs(sensitivities.masterCte) * uMasterCteUmPerMC,
    masterTemperature: Math.abs(sensitivities.masterTemperature) *
      uMasterTemperatureC,
    workpieceCte: Math.abs(sensitivities.workpieceCte) *
      uWorkpieceCteUmPerMC,
    workpieceTemperature: Math.abs(sensitivities.workpieceTemperature) *
      uWorkpieceTemperatureC
  };
  const standardUncertaintyMm = rss(Object.values(uncertaintyContributionsMm));

  return {
    mode: "differential-comparator",
    correctedLengthMm,
    standardUncertaintyMm,
    expandedUncertaintyMm: coverageFactor * standardUncertaintyMm,
    coverageFactor,
    masterThermalFactor: master.factor,
    workpieceThermalFactor: part.factor,
    masterDeltaTemperatureC: master.deltaT,
    workpieceDeltaTemperatureC: part.deltaT,
    sensitivities,
    uncertaintyContributionsMm,
    referenceTemperatureC
  };
}

export function evaluateTolerance({
  measuredValueMm,
  expandedUncertaintyMm = 0,
  lowerLimitMm,
  upperLimitMm
}) {
  finite("measuredValueMm", measuredValueMm);
  nonNegative("expandedUncertaintyMm", expandedUncertaintyMm);
  finite("lowerLimitMm", lowerLimitMm);
  finite("upperLimitMm", upperLimitMm);
  if (lowerLimitMm >= upperLimitMm) {
    throw new RangeError("lowerLimitMm must be less than upperLimitMm.");
  }

  const interval = {
    lowerMm: measuredValueMm - expandedUncertaintyMm,
    upperMm: measuredValueMm + expandedUncertaintyMm
  };

  let decision;
  if (interval.lowerMm >= lowerLimitMm && interval.upperMm <= upperLimitMm) {
    decision = "PASS";
  } else if (interval.upperMm < lowerLimitMm || interval.lowerMm > upperLimitMm) {
    decision = "FAIL";
  } else {
    decision = "INDETERMINATE";
  }

  return { decision, interval, lowerLimitMm, upperLimitMm };
}
