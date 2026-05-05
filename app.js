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
const dayTypes = new Set(["school", "program", "both", "pd", "vacation", "abbreviated"]);
const defaultStartYear = 2026;
const schoolYearOptions = Array.from({ length: 11 }, (_, index) => defaultStartYear + index);
const storageKey = "clarksdale-school-calendar-v1";
const stateFields = ["schoolName", "calendarTitle", "startYear", "programLabel", "k6Hours", "upperHours", "days"];

const state = {
  schoolName: "CLARKSDALE COLLEGIATE PUBLIC CHARTER SCHOOL",
  calendarTitle: "SCHOOL & 21ST CENTURY PROGRAM CALENDAR",
  startYear: 2026,
  programLabel: "21st Century Programming",
  k6Hours: "M - F   7:45 am - 3:00 pm     Afterschool: 3:45 - 5:15 pm",
  upperHours: "M - F   8:00 am - 3:45 pm   Afterschool: 4:00 - 5:30 pm",
  days: {},
};

const controls = {};
let hasHydrated = false;

function isoDate(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIso(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function setDateType(iso, type) {
  if (type === "clear") {
    delete state.days[iso];
    return;
  }

  const current = state.days[iso] || {};
  const next = { ...current };

  if (type === "program") {
    next.program = true;
    next.type = "program";
  } else if (type === "both") {
    next.type = "school";
    next.program = true;
  } else {
    next.type = type;
    if (type === "vacation" || type === "pd") delete next.program;
  }

  state.days[iso] = next;
}

function setDateMarker(iso, marker) {
  const current = state.days[iso] || {};
  if (!marker) {
    delete current.marker;
    delete current.markers;
  } else if (marker.includes(",")) {
    delete current.marker;
    current.markers = marker.split(",").map((item) => item.trim()).filter(Boolean);
  } else {
    delete current.markers;
    current.marker = marker;
  }

  if (!current.type && !current.marker && !current.markers) {
    delete state.days[iso];
  } else {
    state.days[iso] = current;
  }
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

function applyStateData(data) {
  if (!data || typeof data !== "object") return false;

  if (typeof data.schoolName === "string") state.schoolName = data.schoolName;
  if (typeof data.calendarTitle === "string") state.calendarTitle = data.calendarTitle;
  if (Number.isFinite(Number(data.startYear))) state.startYear = Number(data.startYear);
  if (typeof data.programLabel === "string") state.programLabel = data.programLabel;
  if (typeof data.k6Hours === "string") state.k6Hours = data.k6Hours;
  if (typeof data.upperHours === "string") state.upperHours = data.upperHours;
  if (data.days && typeof data.days === "object" && !Array.isArray(data.days)) state.days = data.days;

  return true;
}

function normalizeEntry(entry) {
  if (!entry) return { type: "school", program: false, markers: [] };

  const legacyType = entry.type && dayTypes.has(entry.type) ? entry.type : "school";
  const markers = Array.isArray(entry.markers) ? entry.markers : entry.marker ? [entry.marker] : [];
  return {
    ...entry,
    type: legacyType === "both" ? "school" : legacyType,
    program: entry.program === true || legacyType === "program" || legacyType === "both",
    markers,
  };
}

function isSchoolDay(entry) {
  const normalized = normalizeEntry(entry);
  return normalized.type === "school" || normalized.type === "abbreviated" || entry?.school === true;
}

function isProgramDay(entry) {
  return normalizeEntry(entry).program;
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

function seedSample() {
  state.days = {};

  applyWeekdayRange("2026-08-17", "2026-09-30", "program");
  applyWeekdayRange("2026-10-20", "2026-11-20", "program");
  applyWeekdayRange("2026-12-01", "2026-12-18", "program");
  applyWeekdayRange("2027-01-11", "2027-03-31", "program");
  applyWeekdayRange("2027-04-12", "2027-04-30", "program");
  applyWeekdayRange("2027-06-01", "2027-06-30", "program");

  [
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
  ].forEach(([iso, type]) => setDateType(iso, type));

  [
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
  ].forEach(([iso, marker]) => setDateMarker(iso, marker));

  ["2026-09-07", "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-12-21", "2026-12-22", "2026-12-23", "2026-12-24", "2026-12-25", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-04-05", "2027-04-06", "2027-04-07", "2027-04-08", "2027-04-09", "2027-05-31"].forEach((iso) => setDateType(iso, "vacation"));
}

function getSchoolYearMonths() {
  return Array.from({ length: 12 }, (_, index) => {
    const month = (6 + index) % 12;
    const year = index < 6 ? Number(state.startYear) : Number(state.startYear) + 1;
    return { month, year };
  });
}

function countMonthDays(year, month) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  let school = 0;
  let program = 0;

  for (let day = 1; day <= lastDay; day += 1) {
    const entry = state.days[isoDate(year, month, day)];
    if (!entry) continue;
    if (isSchoolDay(entry)) school += 1;
    if (isProgramDay(entry)) program += 1;
  }

  return { school, program };
}

function countYearDays() {
  return getSchoolYearMonths().reduce(
    (totals, { year, month }) => {
      const monthTotals = countMonthDays(year, month);
      totals.school += monthTotals.school;
      totals.program += monthTotals.program;
      return totals;
    },
    { school: 0, program: 0 },
  );
}

function renderMonth({ year, month }) {
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

    const entry = normalizeEntry(iso ? state.days[iso] : null);
    const type = entry.type === "program" ? "school" : entry.type;
    const markers = entry.markers;
    const programClass = entry.program ? (isSchoolDay(entry) ? "day--program" : "day--program-only") : "";
    cells.push(`
      <div class="day ${outside ? "day--outside" : `type-${type} ${programClass}`}" data-date="${iso}">
        <span>${label}</span>
        ${markers.map((marker) => `<span class="marker marker--${marker}" aria-hidden="true"></span>`).join("")}
      </div>
    `);
  }

  const totals = countMonthDays(year, month);
  return `
    <article class="month">
      <div class="month__title">${monthNames[month].toUpperCase()} ${year}</div>
      <div class="weekday-row">${weekdays.map((day) => `<div>${day}</div>`).join("")}</div>
      <div class="days">${cells.join("")}</div>
      <div class="month__footer">
        <span>School Days: ${totals.school || "–"}</span>
        <span></span>
        <span class="program-count">Program Days: ${totals.program}</span>
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

function render() {
  saveState();
  const yearRange = `${state.startYear}-${String(Number(state.startYear) + 1).slice(2)}`;
  const totals = countYearDays();
  const output = document.querySelector("#calendarOutput");

  output.innerHTML = `
    <header class="calendar-header">
      <img class="logo" src="assets/clarksdale-logo.svg" alt="Clarksdale Collegiate logo" />
      <div>
        <h3>${escapeHtml(state.schoolName)}</h3>
        <h4>${yearRange} ${escapeHtml(state.calendarTitle)}</h4>
      </div>
      <div class="summary">
        <div><strong>${totals.school}</strong> Instructional Days</div>
        <div><strong>${totals.program}</strong> ${escapeHtml(state.programLabel)} Days</div>
        <div>K-10 Saturday School: 9:00 - 11:30 am</div>
      </div>
    </header>
    <div class="months-grid">
      ${getSchoolYearMonths().map(renderMonth).join("")}
    </div>
    <footer class="legend-notes">
      <section class="block">
        <div class="block__title">LEGEND</div>
        <div class="legend">
          <div class="legend-item"><span class="swatch"></span><span>School Day (Instructional)</span></div>
          <div class="legend-item"><span class="swatch swatch--pd"></span><span>Professional Development<br />No School for Scholars</span></div>
          <div class="legend-item"><span class="swatch swatch--program"></span><span>${escapeHtml(state.programLabel)} Day Only / No School</span></div>
          <div class="legend-item"><span class="swatch swatch--vacation"></span><span>Vacation / No School</span></div>
          <div class="legend-item"><span class="swatch swatch--both"></span><span>School Day + ${escapeHtml(state.programLabel)}</span></div>
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
          <div class="note-row"><strong>K-6 Hours:</strong><span>${formatHours(state.k6Hours)}</span></div>
          <div class="rule"></div>
          <div class="note-row"><strong>7-10 Hours:</strong><span>${formatHours(state.upperHours)}</span></div>
        </div>
      </section>
    </footer>
  `;
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
      render();
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
    syncControlsFromState();
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
