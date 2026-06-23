const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const canonicalDayTypes = new Set(["school", "pd", "vacation", "abbreviated"]);
const importDayTypes = new Set(["school", "program", "both", "pd", "vacation", "abbreviated"]);
const allowedMarkers = new Set(["trimester", "quarter", "last", "reportK6", "report710", "saturday"]);
const defaultStartYear = 2026;
const schoolYearOptions = Array.from({ length: 11 }, (_, index) => defaultStartYear + index);
const storageKey = "clarksdale-school-calendar-v1";
const stateFields = ["schoolName", "calendarTitle", "startYear", "programLabel", "k6Hours", "upperHours", "days"];
const sampleStartYear = 2026;
const sampleProgramRanges = [
  ["2026-08-17", "2026-09-30"],
  ["2026-10-20", "2026-11-20"],
  ["2026-12-01", "2026-12-18"],
  ["2027-01-11", "2027-03-31"],
  ["2027-04-12", "2027-04-30"],
  ["2027-06-01", "2027-06-30"],
];
const sampleDayTypes = [
  ["2026-07-03", "pd"],
  ["2026-08-31", "both"],
  ["2026-10-01", "program"],
  ["2026-10-02", "program"],
  ["2026-10-14", "abbreviated"],
  ["2026-10-19", "pd"],
  ["2026-11-20", "abbreviated"],
  ["2026-12-18", "abbreviated"],
  ["2027-01-04", "pd"],
  ["2027-02-12", "pd"],
  ["2027-02-16", "abbreviated"],
  ["2027-03-05", "abbreviated"],
  ["2027-05-21", "abbreviated"],
  ["2027-05-24", "pd"],
  ["2027-06-18", "abbreviated"],
  ["2027-06-25", "school"],
];
const sampleMarkers = [
  ["2026-08-27", "trimester"],
  ["2026-10-14", "reportK6"],
  ["2026-10-21", "trimester"],
  ["2026-12-18", "reportK6"],
  ["2027-01-05", "quarter"],
  ["2027-02-16", "report710"],
  ["2027-03-15", "quarter"],
  ["2027-05-21", "reportK6"],
  ["2027-06-11", "reportK6"],
  ["2027-06-25", "last"],
];
const sampleVacations = [
  "2026-09-07",
  "2026-11-23",
  "2026-11-24",
  "2026-11-25",
  "2026-11-26",
  "2026-11-27",
  "2026-12-21",
  "2026-12-22",
  "2026-12-23",
  "2026-12-24",
  "2026-12-25",
  "2026-12-28",
  "2026-12-29",
  "2026-12-30",
  "2026-12-31",
  "2027-01-01",
  "2027-04-05",
  "2027-04-06",
  "2027-04-07",
  "2027-04-08",
  "2027-04-09",
  "2027-05-31",
];

function createDefaultState() {
  return {
    schoolName: "CLARKSDALE COLLEGIATE PUBLIC CHARTER SCHOOL",
    calendarTitle: "SCHOOL & 21ST CENTURY PROGRAM CALENDAR",
    startYear: defaultStartYear,
    programLabel: "21st Century Programming",
    k6Hours: "M - F   7:45 am - 3:00 pm     Afterschool: 3:45 - 5:15 pm",
    upperHours: "M - F   8:00 am - 3:45 pm   Afterschool: 4:00 - 5:30 pm",
    days: {},
  };
}

const state = createDefaultState();
const controls = {};
const view = {};
let hasHydrated = false;
let currentDerivedData = null;

function isoDate(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIso(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftIsoYear(iso, deltaYears) {
  const date = parseIso(iso);
  date.setFullYear(date.getFullYear() + deltaYears);
  return isoDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createEmptyDayEntry() {
  return { type: null, program: false, markers: [] };
}

function collectMarkers(entry) {
  const markerValues = [];

  if (Array.isArray(entry.markers)) {
    markerValues.push(...entry.markers);
  }

  if (typeof entry.marker === "string") {
    markerValues.push(...entry.marker.split(","));
  }

  return markerValues
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter((value, index, values) => value && allowedMarkers.has(value) && values.indexOf(value) === index);
}

function normalizeImportedDayEntry(entry) {
  if (!isPlainObject(entry)) return null;

  const rawType = typeof entry.type === "string" ? entry.type : null;
  if (rawType && !importDayTypes.has(rawType)) return null;

  const markers = collectMarkers(entry);
  let type = null;
  let program = false;

  if (rawType === "program") {
    program = true;
  } else if (rawType === "both") {
    type = "school";
    program = true;
  } else if (rawType && canonicalDayTypes.has(rawType)) {
    type = rawType;
  } else if (entry.school === true) {
    type = "school";
  }

  if (entry.program === true) {
    program = true;
  }

  if (type === "pd" || type === "vacation") {
    program = false;
  }

  if (!type && !program && markers.length === 0) {
    return null;
  }

  return { type, program, markers };
}

function getCanonicalDayEntry(entry) {
  if (!isPlainObject(entry)) {
    return createEmptyDayEntry();
  }

  const type = canonicalDayTypes.has(entry.type) ? entry.type : null;
  const program = entry.program === true && type !== "pd" && type !== "vacation";
  const markers = Array.isArray(entry.markers)
    ? entry.markers.filter((marker, index, values) => typeof marker === "string" && allowedMarkers.has(marker) && values.indexOf(marker) === index)
    : [];

  if (!type && !program && markers.length === 0) {
    return createEmptyDayEntry();
  }

  return { type, program, markers };
}

function hasDayContent(entry) {
  return Boolean(entry.type || entry.program || entry.markers.length);
}

function writeDayEntry(iso, entry) {
  if (!hasDayContent(entry)) {
    delete state.days[iso];
    return;
  }

  state.days[iso] = entry;
}

function setDateType(iso, type) {
  if (type === "clear") {
    delete state.days[iso];
    return;
  }

  const current = getCanonicalDayEntry(state.days[iso]);
  const next = { ...current, markers: [...current.markers] };

  if (type === "program") {
    next.type = null;
    next.program = true;
  } else if (type === "both") {
    next.type = "school";
    next.program = true;
  } else if (canonicalDayTypes.has(type)) {
    next.type = type;
    if (type === "pd" || type === "vacation") {
      next.program = false;
    }
  }

  writeDayEntry(iso, next);
}

function setDateMarker(iso, marker) {
  const current = getCanonicalDayEntry(state.days[iso]);
  const next = { ...current };

  if (!marker) {
    next.markers = [];
  } else {
    next.markers = marker
      .split(",")
      .map((item) => item.trim())
      .filter((item, index, values) => item && allowedMarkers.has(item) && values.indexOf(item) === index);
  }

  writeDayEntry(iso, next);
}

function applyWeekdayRange(startIso, endIso, type) {
  const start = parseIso(startIso);
  const end = parseIso(endIso);

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (isWeekday(cursor)) {
      setDateType(isoDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()), type);
    }
  }
}

function getSerializableState() {
  return stateFields.reduce((payload, key) => {
    payload[key] = state[key];
    return payload;
  }, {});
}

function sanitizeStateData(data) {
  if (!isPlainObject(data)) return null;

  const defaults = createDefaultState();
  const next = { ...defaults };

  if ("schoolName" in data && typeof data.schoolName !== "string") return null;
  if ("calendarTitle" in data && typeof data.calendarTitle !== "string") return null;
  if ("programLabel" in data && typeof data.programLabel !== "string") return null;
  if ("k6Hours" in data && typeof data.k6Hours !== "string") return null;
  if ("upperHours" in data && typeof data.upperHours !== "string") return null;
  if ("startYear" in data && !schoolYearOptions.includes(Number(data.startYear))) return null;
  if ("days" in data && !isPlainObject(data.days)) return null;

  if (typeof data.schoolName === "string") next.schoolName = data.schoolName;
  if (typeof data.calendarTitle === "string") next.calendarTitle = data.calendarTitle;
  if (typeof data.programLabel === "string") next.programLabel = data.programLabel;
  if (typeof data.k6Hours === "string") next.k6Hours = data.k6Hours;
  if (typeof data.upperHours === "string") next.upperHours = data.upperHours;
  if (schoolYearOptions.includes(Number(data.startYear))) next.startYear = Number(data.startYear);

  next.days = {};
  if (isPlainObject(data.days)) {
    Object.entries(data.days).forEach(([iso, entry]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
      const normalized = normalizeImportedDayEntry(entry);
      if (normalized) {
        next.days[iso] = normalized;
      }
    });
  }

  return next;
}

function replaceState(nextState) {
  state.schoolName = nextState.schoolName;
  state.calendarTitle = nextState.calendarTitle;
  state.startYear = nextState.startYear;
  state.programLabel = nextState.programLabel;
  state.k6Hours = nextState.k6Hours;
  state.upperHours = nextState.upperHours;
  state.days = nextState.days;
}

function applyStateData(data) {
  const next = sanitizeStateData(data);
  if (!next) return false;
  replaceState(next);
  return true;
}

function isSchoolDay(entry) {
  return entry.type === "school" || entry.type === "abbreviated";
}

function isProgramDay(entry) {
  return entry.program;
}

function saveState() {
  if (!hasHydrated) return;
  localStorage.setItem(storageKey, JSON.stringify(getSerializableState()));
}

function loadSavedState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return false;

  try {
    return applyStateData(JSON.parse(saved));
  } catch {
    return false;
  }
}

function downloadJson() {
  const yearRange = `${state.startYear}-${Number(state.startYear) + 1}`;
  const blob = new Blob([JSON.stringify(getSerializableState(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `school-calendar-${yearRange}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function schoolYearLabel(year) {
  return `${year}-${String(year + 1).slice(2)}`;
}

function populateSchoolYearOptions() {
  controls.startYear.innerHTML = schoolYearOptions
    .map((year) => `<option value="${year}">${schoolYearLabel(year)}</option>`)
    .join("");
}

function syncControlsFromState() {
  controls.schoolName.value = state.schoolName;
  controls.calendarTitle.value = state.calendarTitle;
  controls.startYear.value = state.startYear;
  controls.programLabel.value = state.programLabel;
  controls.k6Hours.value = state.k6Hours;
  controls.upperHours.value = state.upperHours;
}

function syncDateDefaultsFromYear() {
  controls.rangeStart.value = `${state.startYear}-08-17`;
  controls.rangeEnd.value = `${state.startYear}-08-28`;
  controls.singleDate.value = `${state.startYear}-08-27`;
}

function buildSampleDays(startYear) {
  const days = {};
  const deltaYears = startYear - sampleStartYear;

  sampleProgramRanges.forEach(([startIso, endIso]) => {
    const start = parseIso(shiftIsoYear(startIso, deltaYears));
    const end = parseIso(shiftIsoYear(endIso, deltaYears));

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      if (!isWeekday(cursor)) continue;
      const iso = isoDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      days[iso] = { type: null, program: true, markers: [] };
    }
  });

  sampleDayTypes.forEach(([iso, type]) => {
    const shiftedIso = shiftIsoYear(iso, deltaYears);
    const current = getCanonicalDayEntry(days[shiftedIso]);

    if (type === "program") {
      days[shiftedIso] = { ...current, type: null, program: true };
    } else if (type === "both") {
      days[shiftedIso] = { ...current, type: "school", program: true };
    } else {
      days[shiftedIso] = {
        ...current,
        type,
        program: type === "pd" || type === "vacation" ? false : current.program,
      };
    }
  });

  sampleMarkers.forEach(([iso, marker]) => {
    const shiftedIso = shiftIsoYear(iso, deltaYears);
    const current = getCanonicalDayEntry(days[shiftedIso]);
    days[shiftedIso] = { ...current, markers: [marker] };
  });

  sampleVacations.forEach((iso) => {
    const shiftedIso = shiftIsoYear(iso, deltaYears);
    const current = getCanonicalDayEntry(days[shiftedIso]);
    days[shiftedIso] = { ...current, type: "vacation", program: false };
  });

  return days;
}

function seedSample() {
  state.days = buildSampleDays(state.startYear);
}

function getSchoolYearMonths() {
  return Array.from({ length: 12 }, (_, index) => {
    const month = (6 + index) % 12;
    const year = index < 6 ? Number(state.startYear) : Number(state.startYear) + 1;
    return { month, year };
  });
}

function buildDerivedCalendarData() {
  const months = getSchoolYearMonths();
  const entries = new Map();
  const monthTotals = new Map();
  const yearTotals = { school: 0, program: 0 };

  months.forEach(({ year, month }) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const totals = { school: 0, program: 0 };

    for (let day = 1; day <= lastDay; day += 1) {
      const iso = isoDate(year, month, day);
      const entry = getCanonicalDayEntry(state.days[iso]);
      entries.set(iso, entry);

      if (isSchoolDay(entry)) totals.school += 1;
      if (isProgramDay(entry)) totals.program += 1;
    }

    monthTotals.set(`${year}-${month}`, totals);
    yearTotals.school += totals.school;
    yearTotals.program += totals.program;
  });

  return { months, entries, monthTotals, yearTotals };
}

function renderMonth({ year, month }, derivedData) {
  const firstDay = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const previousLastDay = new Date(year, month, 0).getDate();
  const cells = [];
  const totalCells = 42;

  for (let index = 0; index < totalCells; index += 1) {
    const dayNumber = index - firstDay + 1;
    let label = dayNumber;
    let iso = "";
    let outside = false;

    if (dayNumber < 1) {
      label = previousLastDay + dayNumber;
      outside = true;
    } else if (dayNumber > lastDay) {
      label = dayNumber - lastDay;
      outside = true;
    } else {
      iso = isoDate(year, month, dayNumber);
    }

    const entry = iso ? derivedData.entries.get(iso) || createEmptyDayEntry() : createEmptyDayEntry();
    const typeClass = entry.type ? `type-${entry.type}` : "";
    const programClass = entry.program ? (isSchoolDay(entry) ? "day--program" : "day--program-only") : "";
    cells.push(`
      <div class="day ${outside ? "day--outside" : `${typeClass} ${programClass}`.trim()}" data-date="${iso}">
        <span>${label}</span>
        ${entry.markers.map((marker) => `<span class="marker marker--${marker}" aria-hidden="true"></span>`).join("")}
      </div>
    `);
  }

  const totals = derivedData.monthTotals.get(`${year}-${month}`) || { school: 0, program: 0 };
  return `
    <article class="month">
      <div class="month__title">${monthNames[month].toUpperCase()} ${year}</div>
      <div class="weekday-row">${weekdays.map((day) => `<div>${day}</div>`).join("")}</div>
      <div class="days">${cells.join("")}</div>
      <div class="month__footer">
        <span>School Days: ${totals.school || "–"}</span>
        <span></span>
        <span class="program-count">21st Century Days: ${totals.program}</span>
      </div>
    </article>
  `;
}

function markerLegend(marker, label) {
  return `
    <div class="legend-item">
      <span class="event-icon marker marker--${marker}" aria-hidden="true"></span>
      <span>${label}</span>
    </div>
  `;
}

function cacheViewNodes(output) {
  view.schoolName = output.querySelector('[data-role="school-name"]');
  view.yearRange = output.querySelector('[data-role="year-range"]');
  view.calendarTitle = output.querySelector('[data-role="calendar-title"]');
  view.schoolTotal = output.querySelector('[data-role="school-total"]');
  view.programTotal = output.querySelector('[data-role="program-total"]');
  view.programSummaryLabel = output.querySelector('[data-role="program-summary-label"]');
  view.programLegendLabel = output.querySelector('[data-role="program-legend-label"]');
  view.bothLegendLabel = output.querySelector('[data-role="both-legend-label"]');
  view.k6Hours = output.querySelector('[data-role="k6-hours"]');
  view.upperHours = output.querySelector('[data-role="upper-hours"]');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatHours(value) {
  return escapeHtml(value).replace(/\s+(Afterschool:)/, "<br />$1");
}

function updateTextContent() {
  if (!view.schoolName) return;

  const yearRange = `${state.startYear}-${String(Number(state.startYear) + 1).slice(2)}`;

  view.schoolName.textContent = state.schoolName;
  view.yearRange.textContent = yearRange;
  view.calendarTitle.textContent = state.calendarTitle;
  view.programSummaryLabel.textContent = state.programLabel;
  view.programLegendLabel.textContent = `${state.programLabel} Day Only / No School`;
  view.bothLegendLabel.textContent = `School Day + ${state.programLabel}`;
  view.k6Hours.innerHTML = formatHours(state.k6Hours);
  view.upperHours.innerHTML = formatHours(state.upperHours);

  if (currentDerivedData) {
    view.schoolTotal.textContent = String(currentDerivedData.yearTotals.school);
    view.programTotal.textContent = String(currentDerivedData.yearTotals.program);
  }
}

function render() {
  currentDerivedData = buildDerivedCalendarData();
  saveState();
  const yearRange = `${state.startYear}-${String(Number(state.startYear) + 1).slice(2)}`;
  const output = document.querySelector("#calendarOutput");

  output.innerHTML = `
    <header class="calendar-header">
      <img class="logo" src="assets/clarksdale-logo.svg" alt="Clarksdale Collegiate logo" />
      <div>
        <h3 data-role="school-name">${escapeHtml(state.schoolName)}</h3>
        <h4><span data-role="year-range">${yearRange}</span> <span data-role="calendar-title">${escapeHtml(state.calendarTitle)}</span></h4>
      </div>
      <div class="summary">
        <div><strong data-role="school-total">${currentDerivedData.yearTotals.school}</strong> Instructional Days</div>
        <div><strong data-role="program-total">${currentDerivedData.yearTotals.program}</strong> <span data-role="program-summary-label">${escapeHtml(state.programLabel)}</span> Days</div>
        <div>K-10 Saturday School: 9:00 - 11:30 am</div>
      </div>
    </header>
    <div class="months-grid">
      ${currentDerivedData.months.map((month) => renderMonth(month, currentDerivedData)).join("")}
    </div>
    <footer class="legend-notes">
      <section class="block">
        <div class="block__title">LEGEND</div>
        <div class="legend">
          <div class="legend-item"><span class="swatch"></span><span>School Day (Instructional)</span></div>
          <div class="legend-item"><span class="swatch swatch--pd"></span><span>Professional Development<br />No School for Scholars</span></div>
          <div class="legend-item"><span class="swatch swatch--program"></span><span data-role="program-legend-label">${escapeHtml(state.programLabel)} Day Only / No School</span></div>
          <div class="legend-item"><span class="swatch swatch--vacation"></span><span>Vacation / No School</span></div>
          <div class="legend-item"><span class="swatch swatch--both"></span><span data-role="both-legend-label">School Day + ${escapeHtml(state.programLabel)}</span></div>
          <div class="legend-item"><span class="swatch swatch--abbreviated"></span><span>Abbreviated Day - 1:30 dismissal</span></div>
        </div>
      </section>
      <section class="block">
        <div class="block__title">EVENTS</div>
        <div class="legend-events">
          ${markerLegend("trimester", "1st Day of a Trimester - K - 6")}
          ${markerLegend("reportK6", "Report Card Night - K - 6")}
          ${markerLegend("quarter", "1st Day of a Quarter - 7 - 10")}
          ${markerLegend("report710", "Report Card Night - 7 - 10")}
          ${markerLegend("last", "Last Day of School")}
          ${markerLegend("saturday", "K-10 Saturday School<br />9:00 - 11:30 am")}
        </div>
      </section>
      <section class="block">
        <div class="block__title">NOTES</div>
        <div class="notes">
          <div class="note-row"><strong>K-6 Hours:</strong><span data-role="k6-hours">${formatHours(state.k6Hours)}</span></div>
          <div class="rule"></div>
          <div class="note-row"><strong>7-10 Hours:</strong><span data-role="upper-hours">${formatHours(state.upperHours)}</span></div>
        </div>
      </section>
    </footer>
  `;

  cacheViewNodes(output);
}

function bindControls() {
  [
    "schoolName",
    "calendarTitle",
    "startYear",
    "programLabel",
    "k6Hours",
    "upperHours",
    "rangeStart",
    "rangeEnd",
    "rangeType",
    "singleDate",
    "singleType",
    "singleMarker",
  ].forEach((id) => {
    controls[id] = document.querySelector(`#${id}`);
  });

  populateSchoolYearOptions();
  syncControlsFromState();
  syncDateDefaultsFromYear();

  ["schoolName", "calendarTitle", "programLabel", "k6Hours", "upperHours"].forEach((id) => {
    controls[id].addEventListener("input", () => {
      state[id] = controls[id].value;
      saveState();
      updateTextContent();
    });
  });

  controls.startYear.addEventListener("change", () => {
    state.startYear = Number(controls.startYear.value) || defaultStartYear;
    syncDateDefaultsFromYear();
    render();
  });

  document.querySelector("#applyRange").addEventListener("click", () => {
    if (!controls.rangeStart.value || !controls.rangeEnd.value) return;
    applyWeekdayRange(controls.rangeStart.value, controls.rangeEnd.value, controls.rangeType.value);
    render();
  });

  document.querySelector("#applySingle").addEventListener("click", () => {
    if (!controls.singleDate.value) return;
    setDateType(controls.singleDate.value, controls.singleType.value);
    setDateMarker(controls.singleDate.value, controls.singleMarker.value);
    render();
  });

  document.querySelector("#resetButton").addEventListener("click", () => {
    seedSample();
    render();
  });

  document.querySelector("#clearButton").addEventListener("click", () => {
    state.days = {};
    render();
  });

  document.querySelector("#exportButton").addEventListener("click", downloadJson);

  document.querySelector("#importButton").addEventListener("click", () => {
    document.querySelector("#importFile").click();
  });

  document.querySelector("#importFile").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!applyStateData(imported)) throw new Error("Invalid calendar JSON");
        syncControlsFromState();
        syncDateDefaultsFromYear();
        render();
      } catch {
        alert("That JSON file could not be loaded as a school calendar.");
      } finally {
        event.target.value = "";
      }
    });
    reader.readAsText(file);
  });

  document.querySelector("#printButton").addEventListener("click", () => window.print());
}

seedSample();
loadSavedState();
hasHydrated = true;
bindControls();
render();
