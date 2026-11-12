const MILLIMETERS_PER_INCH = 25.4;
const LENGTH_UNITS = new Set(["mm", "in"]);

function validateUnit(unit) {
  if (!LENGTH_UNITS.has(unit)) {
    throw new RangeError(`Unsupported length unit: ${unit}`);
  }
}

export function lengthToMillimeters(value, unit) {
  validateUnit(unit);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("Length must be a finite number.");
  }
  return unit === "in" ? value * MILLIMETERS_PER_INCH : value;
}

export function millimetersToLength(valueMm, unit) {
  validateUnit(unit);
  if (typeof valueMm !== "number" || !Number.isFinite(valueMm)) {
    throw new TypeError("Length must be a finite number.");
  }
  return unit === "in" ? valueMm / MILLIMETERS_PER_INCH : valueMm;
}
