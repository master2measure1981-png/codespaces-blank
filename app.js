import {
  MATERIAL_CTE_UM_PER_M_C,
  compensateDifferential,
  compensateDirect,
  evaluateTolerance
} from "./thermal-compensation.js";
import { lengthToMillimeters, millimetersToLength } from "./units.js";

const form = document.querySelector("#calc-form");
const directFields = document.querySelector("#direct-fields");
const differentialFields = document.querySelector("#differential-fields");
const lengthUnitSelect = document.querySelector("#length-unit");
const temperatureUnitSelect = document.querySelector("#temperature-unit");
const lengthUnitFooter = document.querySelector("#length-unit-footer");
const temperatureUnitFooter = document.querySelector("#temperature-unit-footer");
const hint = document.querySelector("#measurement-hint");
const resultTitle = document.querySelector("#result-title");
const resultBody = document.querySelector("#result-body");
const errorMessage = document.querySelector("#error-message");
let mode = "direct";
let hasCalculation = false;
let lengthUnit = "in";
let temperatureUnit = "F";

const number = (data, name, optional = false) => {
  const value = data.get(name);
  if (optional && (value === "" || value == null)) return null;
  if (value === "" || value == null) throw new Error("Complete all required fields before calculating.");
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Enter a valid finite number in every numeric field.");
  return parsed;
};

const optionalUncertainty = (data, name) => {
  const value = number(data, name, true);
  return value ?? 0;
};

const format = (value, digits = 9) => {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
    useGrouping: true
  }).format(value);
};

const temperatureToCelsius = (value, unit, isDifference = false) => {
  if (unit === "F") {
    return isDifference ? value * (5 / 9) : (value - 32) * (5 / 9);
  }
  return value;
};

const celsiusToTemperature = (valueC, unit, isDifference = false) => {
  if (unit === "F") {
    return isDifference ? valueC * (9 / 5) : (valueC * (9 / 5)) + 32;
  }
  return valueC;
};

const displayLength = (valueMm) =>
  format(millimetersToLength(valueMm, lengthUnit));

const displayTemperature = (valueC, isDifference = false) =>
  format(celsiusToTemperature(valueC, temperatureUnit, isDifference));

function selectedCte(data, selectName, inputName) {
  if (data.get(selectName) !== "custom") {
    return MATERIAL_CTE_UM_PER_M_C[data.get(selectName)];
  }
  return number(data, inputName);
}

function setMode(nextMode) {
  mode = nextMode;
  const direct = mode === "direct";
  directFields.hidden = !direct;
  differentialFields.hidden = direct;
  hint.textContent = direct
    ? "Enter the measured dimension and workpiece conditions."
    : "Enter the signed part-minus-master difference and both material conditions.";
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  resultTitle.textContent = "Ready to calculate";
  resultBody.innerHTML = '<p class="empty-state">Enter the measurement inputs and calculate to see the corrected dimension and uncertainty.</p>';
  errorMessage.hidden = true;
  hasCalculation = false;
}

function updateLengthUnit(nextUnit) {
  if (nextUnit === lengthUnit) return;

  const previousUnit = lengthUnit;
  for (const name of [
    "measuredLengthMm",
    "uMeasuredLengthMm",
    "comparatorDifferenceMm",
    "masterLengthAtReferenceMm",
    "uComparatorDifferenceMm",
    "uMasterLengthMm",
    "lowerLimitMm",
    "upperLimitMm"
  ]) {
    const input = form.elements.namedItem(name);
    if (input.value === "") continue;
    const value = Number(input.value);
    if (Number.isFinite(value)) {
      input.value = String(millimetersToLength(
        lengthToMillimeters(value, previousUnit),
        nextUnit
      ));
    }
  }

  lengthUnit = nextUnit;
  document.querySelectorAll("[data-length-unit]").forEach((element) => {
    const label = element.dataset.lengthUnit;
    element.textContent = label === "difference"
      ? `${lengthUnit}, part − master`
      : label === "uncertainty"
        ? `${lengthUnit}, 1σ`
        : lengthUnit;
  });
  lengthUnitFooter.textContent = `Length: ${lengthUnit}`;
  if (hasCalculation) form.requestSubmit();
}

function updateTemperatureUnit(nextUnit) {
  if (nextUnit === temperatureUnit) return;

  const previousUnit = temperatureUnit;
  for (const name of [
    "workpieceTemperatureC",
    "uWorkpieceTemperatureC",
    "masterTemperatureC",
    "uMasterTemperatureC",
    "diffWorkpieceTemperatureC",
    "uDiffWorkpieceTemperatureC",
    "referenceTemperatureC"
  ]) {
    const input = form.elements.namedItem(name);
    if (!input || input.value === "") continue;
    const value = Number(input.value);
    if (Number.isFinite(value)) {
      const isDifference = name.startsWith("u");
      input.value = String(celsiusToTemperature(
        temperatureToCelsius(value, previousUnit, isDifference),
        nextUnit,
        isDifference
      ));
    }
  }

  temperatureUnit = nextUnit;
  document.querySelectorAll("[data-temperature-unit]").forEach((element) => {
    const suffix = element.textContent.includes("1σ") ? ", 1σ" : "";
    element.textContent = `${temperatureUnit === "F" ? "°F" : "°C"}${suffix}`;
  });
  temperatureUnitFooter.textContent = `Temperature: ${temperatureUnit === "F" ? "°F" : "°C"}`;
  if (hasCalculation) form.requestSubmit();
}

function readCalculation(data) {
  const referenceTemperatureC = temperatureToCelsius(
    number(data, "referenceTemperatureC"),
    temperatureUnit
  );
  const coverageFactor = number(data, "coverageFactor");
  const lengthInMm = (name) =>
    lengthToMillimeters(number(data, name), lengthUnit);
  const uncertaintyInMm = (name) =>
    lengthToMillimeters(optionalUncertainty(data, name), lengthUnit);
  const temperatureInC = (name) =>
    temperatureToCelsius(number(data, name), temperatureUnit);
  const temperatureUncertaintyInC = (name) =>
    temperatureToCelsius(optionalUncertainty(data, name), temperatureUnit, true);

  if (mode === "direct") {
    return compensateDirect({
      measuredLengthMm: lengthInMm("measuredLengthMm"),
      workpieceCteUmPerMC: selectedCte(data, "directMaterial", "workpieceCteUmPerMC"),
      workpieceTemperatureC: temperatureInC("workpieceTemperatureC"),
      referenceTemperatureC,
      uMeasuredLengthMm: uncertaintyInMm("uMeasuredLengthMm"),
      uWorkpieceCteUmPerMC: optionalUncertainty(data, "uWorkpieceCteUmPerMC"),
      uWorkpieceTemperatureC: temperatureUncertaintyInC("uWorkpieceTemperatureC"),
      coverageFactor
    });
  }

  return compensateDifferential({
    comparatorDifferenceMm: lengthInMm("comparatorDifferenceMm"),
    masterLengthAtReferenceMm: lengthInMm("masterLengthAtReferenceMm"),
    masterCteUmPerMC: selectedCte(data, "masterMaterial", "masterCteUmPerMC"),
    masterTemperatureC: temperatureInC("masterTemperatureC"),
    workpieceCteUmPerMC: selectedCte(
      data,
      "diffWorkpieceMaterial",
      "diffWorkpieceCteUmPerMC"
    ),
    workpieceTemperatureC: temperatureInC("diffWorkpieceTemperatureC"),
    referenceTemperatureC,
    uComparatorDifferenceMm: uncertaintyInMm("uComparatorDifferenceMm"),
    uMasterLengthMm: uncertaintyInMm("uMasterLengthMm"),
    uMasterCteUmPerMC: optionalUncertainty(data, "uMasterCteUmPerMC"),
    uMasterTemperatureC: temperatureUncertaintyInC("uMasterTemperatureC"),
    uWorkpieceCteUmPerMC: optionalUncertainty(data, "uDiffWorkpieceCteUmPerMC"),
    uWorkpieceTemperatureC: temperatureUncertaintyInC(
      "uDiffWorkpieceTemperatureC"
    ),
    coverageFactor
  });
}

function appendMetric(list, label, value) {
  const row = document.createElement("div");
  row.className = "metric";
  const term = document.createElement("dt");
  term.textContent = label;
  const detail = document.createElement("dd");
  detail.textContent = value;
  row.append(term, detail);
  list.append(row);
}

function renderResult(result, data) {
  resultTitle.textContent = mode === "direct" ? "Direct compensation" : "Comparator compensation";
  resultBody.replaceChildren();

  const primary = document.createElement("div");
  primary.className = "primary-result";
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = "Corrected length at reference temperature";
  const value = document.createElement("strong");
  value.append(document.createTextNode(displayLength(result.correctedLengthMm)));
  const unit = document.createElement("small");
  unit.textContent = ` ${lengthUnit}`;
  value.append(unit);
  primary.append(label, value);

  const metrics = document.createElement("dl");
  metrics.className = "metric-list";
  appendMetric(metrics, "Standard uncertainty (u)", `${displayLength(result.standardUncertaintyMm)} ${lengthUnit}`);
  appendMetric(metrics, "Expanded uncertainty (U)", `${displayLength(result.expandedUncertaintyMm)} ${lengthUnit}`);
  appendMetric(metrics, "Coverage factor (k)", format(result.coverageFactor, 4));
  appendMetric(metrics, "Reference temperature", `${displayTemperature(result.referenceTemperatureC)} ${temperatureUnit === "F" ? "°F" : "°C"}`);
  appendMetric(metrics, "Temperature difference", mode === "direct"
    ? `${displayTemperature(result.deltaTemperatureC, true)} ${temperatureUnit === "F" ? "°F" : "°C"}`
    : `Master ${displayTemperature(result.masterDeltaTemperatureC, true)} ${temperatureUnit === "F" ? "°F" : "°C"} / part ${displayTemperature(result.workpieceDeltaTemperatureC, true)} ${temperatureUnit === "F" ? "°F" : "°C"}`);
  resultBody.append(primary, metrics);

  const lowerRaw = data.get("lowerLimitMm");
  const upperRaw = data.get("upperLimitMm");
  if (lowerRaw !== "" || upperRaw !== "") {
    if (lowerRaw === "" || upperRaw === "") {
      throw new Error("Enter both the lower and upper specification limits, or clear both.");
    }
    const tolerance = evaluateTolerance({
      measuredValueMm: result.correctedLengthMm,
      expandedUncertaintyMm: result.expandedUncertaintyMm,
      lowerLimitMm: lengthToMillimeters(Number(lowerRaw), lengthUnit),
      upperLimitMm: lengthToMillimeters(Number(upperRaw), lengthUnit)
    });
    const box = document.createElement("div");
    box.className = "tolerance-result";
    const decision = document.createElement("div");
    decision.className = `decision ${tolerance.decision.toLowerCase()}`;
    decision.textContent = `TOLERANCE ${tolerance.decision}`;
    const interval = document.createElement("p");
    interval.textContent = `Expanded interval: ${displayLength(tolerance.interval.lowerMm)} to ${displayLength(tolerance.interval.upperMm)} ${lengthUnit}. Limits: ${displayLength(tolerance.lowerLimitMm)} to ${displayLength(tolerance.upperLimitMm)} ${lengthUnit}.`;
    box.append(decision, interval);
    resultBody.append(box);
  }
  hasCalculation = true;
}

lengthUnitSelect.addEventListener("change", () => {
  updateLengthUnit(lengthUnitSelect.value);
});

temperatureUnitSelect.addEventListener("change", () => {
  updateTemperatureUnit(temperatureUnitSelect.value);
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

for (const [selectName, inputName] of [
  ["directMaterial", "workpieceCteUmPerMC"],
  ["masterMaterial", "masterCteUmPerMC"],
  ["diffWorkpieceMaterial", "diffWorkpieceCteUmPerMC"]
]) {
  const select = form.elements.namedItem(selectName);
  const input = form.elements.namedItem(inputName);
  select.addEventListener("change", () => {
    if (select.value !== "custom") input.value = MATERIAL_CTE_UM_PER_M_C[select.value];
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  try {
    const data = new FormData(form);
    const result = readCalculation(data);
    renderResult(result, data);
  } catch (error) {
    errorMessage.textContent = error instanceof Error
      ? error.message
      : "Calculation failed. Check the inputs and try again.";
    errorMessage.hidden = false;
    hasCalculation = false;
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Offline support could not be enabled.", error);
    });
  });
}
