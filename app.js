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
const canonicalDayTypes = new Set(["school", "pd", "vacation", "abbreviated", "summerbreak"]);
const importDayTypes = new Set(["school", "program", "both", "pd", "vacation", "abbreviated", "summerbreak"]);
const allowedMarkers = new Set(["trimester", "quarter", "last", "reportK6", "report710", "saturday"]);
const outputModes = new Set(["year", "sixWeek"]);
const defaultStartYear = 2026;
const schoolYearOptions = Array.from({ length: 11 }, (_, index) => defaultStartYear + index);
const storageKey = "clarksdale-school-calendar-v2";
const defaultCalendarPath = "school-calendar-2026-2027.json";
const feedConfig = {
  path: "calendar-feed.ics",
  label: "School calendar feed",
};
const stateFields = [
  "schoolName",
  "calendarTitle",
  "startYear",
  "programLabel",
  "k6Hours",
  "upperHours",
  "days",
  "outputMode",
  "reportStartDate",
  "googleEvents",
  "feedLoadedAt",
  "feedError",
  "feedLoadedTotal",
  "feedUsingCache",
];
const schoolDateLabels = {
  pd: "Professional Development Day - No School for Scholars",
  vacation: "Vacation / No School for Scholars",
  summerbreak: "Summer Break - No School for Scholars",
  abbreviated: "Early Dismissal",
};
const schoolMarkerLabels = {
  trimester: "First Day of Trimester",
  quarter: "First Day of Quarter",
  last: "Last Day of School",
  reportK6: "Report Card Night - K-6",
  report710: "Report Card Night - 7-10",
  saturday: "K-10 Saturday School",
};
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
    outputMode: "year",
    reportStartDate: getTodayIso(),
    googleEvents: [],
    feedLoadedAt: "",
    feedError: "",
    feedLoadedTotal: 0,
    feedUsingCache: false,
  };
}

const state = createDefaultState();
const controls = {};
const view = {};
let hasHydrated = false;
let currentDerivedData = null;
let hasAutoRequestedFeed = false;

function getTodayIso() {
  const today = new Date();
  return isoDate(today.getFullYear(), today.getMonth(), today.getDate());
}

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

  if (type === "pd" || type === "vacation" || type === "summerbreak") {
    program = false;
  }

  if (!type && !program && markers.length === 0) {
    return null;
  }

  return { type, program, markers };
}

function toIsoFromDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  return isoDate(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDateLike(value) {
  if (value instanceof Date) {
    return {
      iso: toIsoFromDate(value),
      date: value,
      hasTime: value.getHours() + value.getMinutes() + value.getSeconds() > 0,
    };
  }

  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = parseIso(trimmed);
    return { iso: trimmed, date, hasTime: false };
  }

  if (/^\d{8}$/.test(trimmed)) {
    const date = new Date(Number(trimmed.slice(0, 4)), Number(trimmed.slice(4, 6)) - 1, Number(trimmed.slice(6, 8)));
    return { iso: toIsoFromDate(date), date, hasTime: false };
  }

  const compactDateTime = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(?:(\d{2}))?(Z)?$/);
  if (compactDateTime) {
    const [, year, month, day, hour, minute, second, zulu] = compactDateTime;
    const seconds = Number(second || "00");
    const date = zulu
      ? new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), seconds))
      : new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), seconds);
    return { iso: toIsoFromDate(date), date, hasTime: true };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    iso: toIsoFromDate(parsed),
    date: parsed,
    hasTime: !/^\d{4}-\d{2}-\d{2}$/.test(trimmed),
  };
}

function normalizeImportedEvent(rawEvent, index = 0) {
  if (!isPlainObject(rawEvent)) return null;
  if (rawEvent.status === "CANCELLED") return null;

  const startValue = rawEvent.start?.dateTime || rawEvent.start?.date || rawEvent.startDateTime || rawEvent.startDate || rawEvent.start || rawEvent.date;
  const endValue = rawEvent.end?.dateTime || rawEvent.end?.date || rawEvent.endDateTime || rawEvent.endDate || rawEvent.end || startValue;
  const start = parseDateLike(startValue);
  const end = parseDateLike(endValue) || start;
  const title = rawEvent.summary || rawEvent.title || rawEvent.name || rawEvent.subject;

  if (!start || !start.iso || typeof title !== "string" || !title.trim()) return null;

  const localAllDayTimes =
    start.hasTime &&
    end.hasTime &&
    start.iso === end.iso &&
    start.date.getHours() === 0 &&
    start.date.getMinutes() === 0 &&
    end.date.getHours() === 23 &&
    end.date.getMinutes() >= 55;
  const allDay = rawEvent.allDay === true || Boolean(rawEvent.start?.date) || !start.hasTime || localAllDayTimes;
  const hasExclusiveAllDayEnd =
    allDay && (Boolean(rawEvent.end?.date) || (typeof startValue === "string" && typeof endValue === "string" && /^\d{8}$/.test(startValue) && /^\d{8}$/.test(endValue)));
  const inclusiveEndIso = hasExclusiveAllDayEnd && end.iso > start.iso ? addDays(end.iso, -1) : end.iso;
  return {
    id: String(rawEvent.id || rawEvent.uid || rawEvent.iCalUID || `event-${index}-${start.iso}`),
    title: title.trim(),
    start: start.iso,
    end: inclusiveEndIso || start.iso,
    startDateTime: start.hasTime ? start.date.toISOString() : "",
    endDateTime: end.hasTime ? end.date.toISOString() : "",
    allDay,
    location: typeof rawEvent.location === "string" ? rawEvent.location.trim() : "",
    description: typeof rawEvent.description === "string" ? rawEvent.description.trim() : "",
  };
}

function normalizeImportedEvents(value) {
  const rawEvents = Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : Array.isArray(value?.events) ? value.events : [];
  return rawEvents
    .map((event, index) => normalizeImportedEvent(event, index))
    .filter(Boolean)
    .sort(compareEvents);
}

function getCanonicalDayEntry(entry) {
  if (!isPlainObject(entry)) {
    return createEmptyDayEntry();
  }

  const type = canonicalDayTypes.has(entry.type) ? entry.type : null;
  const program = entry.program === true && type !== "pd" && type !== "vacation" && type !== "summerbreak";
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
    if (type === "pd" || type === "vacation" || type === "summerbreak") {
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
  if ("outputMode" in data && !outputModes.has(data.outputMode)) return null;
  if ("reportStartDate" in data && typeof data.reportStartDate !== "string") return null;
  if ("startYear" in data && !schoolYearOptions.includes(Number(data.startYear))) return null;
  if ("days" in data && !isPlainObject(data.days)) return null;
  if ("googleEvents" in data && !Array.isArray(data.googleEvents) && !isPlainObject(data.googleEvents)) return null;
  if ("feedLoadedAt" in data && typeof data.feedLoadedAt !== "string") return null;
  if ("feedError" in data && typeof data.feedError !== "string") return null;
  if ("feedLoadedTotal" in data && typeof data.feedLoadedTotal !== "number") return null;
  if ("feedUsingCache" in data && typeof data.feedUsingCache !== "boolean") return null;

  if (typeof data.schoolName === "string") next.schoolName = data.schoolName;
  if (typeof data.calendarTitle === "string") next.calendarTitle = data.calendarTitle;
  if (typeof data.programLabel === "string") next.programLabel = data.programLabel;
  if (typeof data.k6Hours === "string") next.k6Hours = data.k6Hours;
  if (typeof data.upperHours === "string") next.upperHours = data.upperHours;
  if (outputModes.has(data.outputMode)) next.outputMode = data.outputMode;
  if (typeof data.reportStartDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.reportStartDate)) {
    next.reportStartDate = data.reportStartDate;
  }
  if (schoolYearOptions.includes(Number(data.startYear))) next.startYear = Number(data.startYear);
  if (Array.isArray(data.googleEvents) || isPlainObject(data.googleEvents)) next.googleEvents = normalizeImportedEvents(data.googleEvents);
  if (typeof data.feedLoadedAt === "string") next.feedLoadedAt = data.feedLoadedAt;
  if (typeof data.feedError === "string") next.feedError = data.feedError;
  if (typeof data.feedLoadedTotal === "number") next.feedLoadedTotal = data.feedLoadedTotal;
  if (typeof data.feedUsingCache === "boolean") next.feedUsingCache = data.feedUsingCache;

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
  state.outputMode = nextState.outputMode;
  state.reportStartDate = nextState.reportStartDate;
  state.googleEvents = nextState.googleEvents;
  state.feedLoadedAt = nextState.feedLoadedAt;
  state.feedError = nextState.feedError;
  state.feedLoadedTotal = nextState.feedLoadedTotal;
  state.feedUsingCache = nextState.feedUsingCache;
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

async function loadDefaultCalendarState() {
  try {
    const response = await fetch(defaultCalendarPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`Default calendar request failed: ${response.status}`);
    return applyStateData(await response.json());
  } catch (error) {
    console.error(error);
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
  controls.outputMode.value = state.outputMode;
  controls.reportStartDate.value = state.reportStartDate;
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
        <span>School Days: ${totals.school}</span>
        <span></span>
        <span class="program-count">21st Century Days: ${totals.program}</span>
      </div>
    </article>
  `;
}

function addDays(iso, days) {
  const date = parseIso(iso);
  date.setDate(date.getDate() + days);
  return isoDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function compareEvents(a, b) {
  return `${a.start} ${a.startDateTime || ""} ${a.title}`.localeCompare(`${b.start} ${b.startDateTime || ""} ${b.title}`);
}

function getReportMonths(startIso) {
  const start = parseIso(startIso);
  return Array.from({ length: 3 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
}

function eventOccursInRange(event, startIso, endIso) {
  const eventEnd = event.end || event.start;
  return event.start <= endIso && eventEnd >= startIso;
}

function getEventsInRange(startIso, endIso) {
  return state.googleEvents.filter((event) => eventOccursInRange(event, startIso, endIso));
}

function eachDateInEvent(event) {
  const dates = [];
  let cursor = event.start;
  const end = event.end || event.start;

  while (cursor && cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

function normalizeEventText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function eventConcepts(event) {
  const text = normalizeEventText(event.title);
  const concepts = new Set();

  if (/\b(abbreviated|early dismissal|dismissal)\b/.test(text)) concepts.add("early-dismissal");
  if (/\b(professional development|staff pd|pd day|pd)\b/.test(text)) concepts.add("pd");
  if (/\b(no school|vacation|holiday|break)\b/.test(text)) concepts.add("no-school");
  if (/\breport card\b/.test(text)) concepts.add("report-card");
  if (/\bquarter\b/.test(text)) concepts.add("quarter");
  if (/\btrimester\b/.test(text)) concepts.add("trimester");
  if (/\blast day\b/.test(text)) concepts.add("last-day");
  if (/\bsaturday school\b/.test(text)) concepts.add("saturday-school");

  return concepts;
}

function eventsShareDate(a, b) {
  const bDates = new Set(eachDateInEvent(b));
  return eachDateInEvent(a).some((date) => bDates.has(date));
}

function eventsAreDuplicates(schoolEvent, importedEvent) {
  if (!eventsShareDate(schoolEvent, importedEvent)) return false;

  const schoolText = normalizeEventText(schoolEvent.title);
  const importedText = normalizeEventText(importedEvent.title);
  if (schoolText && importedText && schoolText === importedText) return true;

  const schoolConcepts = eventConcepts(schoolEvent);
  const importedConcepts = eventConcepts(importedEvent);
  return [...schoolConcepts].some((concept) => importedConcepts.has(concept));
}

function getReportEvents(startIso, endIso) {
  const schoolEvents = getSchoolCalendarEvents(startIso, endIso);
  const importedEvents = getEventsInRange(startIso, endIso).filter(
    (event) => !schoolEvents.some((schoolEvent) => eventsAreDuplicates(schoolEvent, event)),
  );

  return [...schoolEvents, ...importedEvents].sort(compareEvents);
}

function getSchoolCalendarEvents(startIso, endIso) {
  const events = [];
  let cursor = startIso;
  let openRange = null;

  function closeRange() {
    if (!openRange) return;
    events.push({
      id: `school-${openRange.type}-${openRange.start}`,
      source: "school",
      title: schoolDateLabels[openRange.type],
      start: openRange.start,
      end: openRange.end,
      allDay: true,
    });
    openRange = null;
  }

  while (cursor <= endIso) {
    const entry = getCanonicalDayEntry(state.days[cursor]);
    const rangeType = ["pd", "vacation", "summerbreak", "abbreviated"].includes(entry.type) ? entry.type : "";

    if (rangeType) {
      if (openRange?.type === rangeType && addDays(openRange.end, 1) === cursor) {
        openRange.end = cursor;
      } else {
        closeRange();
        openRange = { type: rangeType, start: cursor, end: cursor };
      }
    } else {
      closeRange();
    }

    entry.markers.forEach((marker) => {
      const label = schoolMarkerLabels[marker];
      if (!label) return;
      events.push({
        id: `school-${marker}-${cursor}`,
        source: "school",
        title: label,
        start: cursor,
        end: cursor,
        allDay: true,
      });
    });

    cursor = addDays(cursor, 1);
  }

  closeRange();
  return events;
}

function formatShortDate(iso) {
  const date = parseIso(iso);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
}

function formatDateSpan(event) {
  if (event.end && event.end !== event.start) {
    return `${formatShortDate(event.start)} - ${formatShortDate(event.end)}`;
  }
  return formatShortDate(event.start);
}

function formatTimeLabel(event) {
  if (event.allDay || !event.startDateTime) return "";
  const start = new Date(event.startDateTime);
  const end = event.endDateTime ? new Date(event.endDateTime) : null;
  const timeOptions = { hour: "numeric", minute: "2-digit" };
  const startLabel = start.toLocaleTimeString("en-US", timeOptions).replace(" ", " ");
  if (!end || Number.isNaN(end.getTime()) || event.end !== event.start) return startLabel;
  return `${startLabel}-${end.toLocaleTimeString("en-US", timeOptions).replace(" ", " ")}`;
}

function formatEventTitle(event) {
  let title = event.title.trim();

  if (event.location && title.toLowerCase().endsWith(event.location.toLowerCase())) {
    title = title.slice(0, -event.location.length).replace(/\s+-\s*$/, "").trim();
  }

  return title.replace(/\s+-\s+[^-]*,\s*[A-Z]{2}(?:\s+\d{5})?$/g, "").trim();
}

function groupEventsByDate(events) {
  return events.reduce((groups, event) => {
    const dateLabel = formatDateSpan(event);
    const existing = groups.find((group) => group.dateLabel === dateLabel);

    if (existing) {
      existing.events.push(event);
    } else {
      groups.push({ dateLabel, events: [event] });
    }

    return groups;
  }, []);
}

function renderEventAgenda(events) {
  if (!events.length) {
    return `<p class="event-list__empty">No imported or school-calendar events found for this 6 week window.</p>`;
  }

  return groupEventsByDate(events)
    .map(
      (group) => `
        <section class="event-day">
          <h4>${escapeHtml(group.dateLabel)}</h4>
          <ul>
            ${group.events
              .map((event) => {
                const timeLabel = formatTimeLabel(event);
                return `
                  <li class="event-row ${event.source === "school" ? "event-row--school" : ""} ${timeLabel ? "" : "event-row--all-day"}">
                    <span class="event-row__time">${timeLabel ? escapeHtml(timeLabel) : ""}</span>
                    <span class="event-row__title">${escapeHtml(formatEventTitle(event))}</span>
                  </li>
                `;
              })
              .join("")}
          </ul>
        </section>
      `,
    )
    .join("");
}

function unfoldIcsLines(text) {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
}

function cleanIcsText(value = "") {
  return value
    .replaceAll("\\n", " ")
    .replaceAll("\\,", ",")
    .replaceAll("\\;", ";")
    .replaceAll("\\\\", "\\")
    .trim();
}

function parseIcsEvents(text) {
  const events = [];
  let current = null;

  unfoldIcsLines(text).forEach((line) => {
    if (line === "BEGIN:VEVENT") {
      current = {};
      return;
    }

    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      return;
    }

    if (!current || !line.includes(":")) return;
    const separatorIndex = line.indexOf(":");
    const rawKey = line.slice(0, separatorIndex);
    const value = cleanIcsText(line.slice(separatorIndex + 1));
    const key = rawKey.split(";")[0].toUpperCase();

    if (key === "UID") current.uid = value;
    if (key === "SUMMARY") current.summary = value;
    if (key === "DESCRIPTION") current.description = value;
    if (key === "LOCATION") current.location = value;
    if (key === "STATUS") current.status = value;
    if (key === "DTSTART") current.start = value;
    if (key === "DTEND") current.end = value;
  });

  return normalizeImportedEvents(events);
}

function parseEventFile(text, fileName = "") {
  const looksLikeIcs = /\.ics$/i.test(fileName) || /BEGIN:VCALENDAR/.test(text);
  if (looksLikeIcs) return parseIcsEvents(text);
  return normalizeImportedEvents(JSON.parse(text));
}

function formatStatusDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function updateFeedStatus(visibleCount = 0) {
  const eventCount = document.querySelector("#eventCount");
  const feedStatus = document.querySelector("#feedStatus");

  if (eventCount) {
    eventCount.textContent = String(visibleCount);
  }

  if (!feedStatus) return;

  if (state.feedError && state.googleEvents.length) {
    const loadedAt = formatStatusDate(state.feedLoadedAt);
    feedStatus.textContent = loadedAt
      ? `Using last loaded feed from ${loadedAt}. Refresh failed.`
      : "Using cached feed. Refresh failed.";
  } else if (state.feedError) {
    feedStatus.textContent = "Feed unavailable. Showing school-calendar events only.";
  } else if (state.feedLoadedAt) {
    feedStatus.textContent = `Feed loaded ${formatStatusDate(state.feedLoadedAt)} - ${visibleCount} events shown`;
  } else {
    feedStatus.textContent = "Feed not loaded yet.";
  }
}

function applyLoadedFeed(importedEvents) {
  state.googleEvents = importedEvents;
  state.feedLoadedAt = new Date().toISOString();
  state.feedError = "";
  state.feedLoadedTotal = importedEvents.length;
  state.feedUsingCache = false;
}

async function loadCalendarFeed({ manual = false } = {}) {
  const button = document.querySelector("#loadFeedButton");
  if (button) {
    button.disabled = true;
    button.textContent = "Refreshing...";
  }

  try {
    const response = await fetch(feedConfig.path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
    const text = await response.text();
    const importedEvents = parseEventFile(text, feedConfig.path);
    applyLoadedFeed(importedEvents);
    state.outputMode = "sixWeek";
    syncControlsFromState();
    render();
  } catch (error) {
    console.error(error);
    state.feedError = error instanceof Error ? error.message : "Feed refresh failed";
    state.feedUsingCache = state.googleEvents.length > 0;
    render();
    if (manual && !state.feedUsingCache) {
      alert("The school calendar feed could not be loaded. Make sure the local calendar proxy server is running.");
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Refresh feed";
    }
  }
}

function autoLoadCalendarFeed() {
  if (hasAutoRequestedFeed) return;
  hasAutoRequestedFeed = true;
  loadCalendarFeed();
}

function clearFeedState() {
  state.googleEvents = [];
  state.feedLoadedAt = "";
  state.feedError = "";
  state.feedLoadedTotal = 0;
  state.feedUsingCache = false;
  hasAutoRequestedFeed = true;
}

function printCurrentView() {
  setTimeout(() => window.print(), 0);
}

function printYearCalendar() {
  state.outputMode = "year";
  syncControlsFromState();
  render();
  printCurrentView();
}

async function printSixWeekCalendar() {
  state.outputMode = "sixWeek";
  syncControlsFromState();

  if (!state.googleEvents.length && !state.feedError) {
    hasAutoRequestedFeed = true;
    await loadCalendarFeed();
  } else {
    render();
  }

  printCurrentView();
}

function renderSnapshotMonth({ year, month }, derivedData, startIso, endIso) {
  const firstDay = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const previousLastDay = new Date(year, month, 0).getDate();
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
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
    const rangeClass = iso && iso >= startIso && iso <= endIso ? "snapshot-day--in-range" : "";

    cells.push(`
      <div class="snapshot-day ${outside ? "day--outside" : `${typeClass} ${programClass} ${rangeClass}`.trim()}" data-date="${iso}">
        <span>${label}</span>
        ${entry.markers.map((marker) => `<span class="marker marker--${marker}" aria-hidden="true"></span>`).join("")}
      </div>
    `);
  }

  return `
    <article class="snapshot-month">
      <h4>${monthNames[month]} ${year}</h4>
      <div class="snapshot-weekdays">${["Sun", "M", "Tu", "W", "Th", "F", "Sat"].map((day) => `<div>${day}</div>`).join("")}</div>
      <div class="snapshot-days">${cells.join("")}</div>
    </article>
  `;
}

function renderSixWeekReport(output) {
  currentDerivedData = buildDerivedCalendarData();
  const startIso = state.reportStartDate || getTodayIso();
  const endIso = addDays(startIso, 41);
  const months = getReportMonths(startIso);
  const allEvents = getReportEvents(startIso, endIso);

  updateFeedStatus(allEvents.length);
  output.className = "calendar-sheet calendar-sheet--report";
  output.setAttribute("aria-label", "Generated 6 week school events calendar");
  output.innerHTML = `
    <header class="report-header">
      <div class="report-brand">
        <img class="report-logo" src="assets/clarksdale-logo.svg" alt="Clarksdale Collegiate logo" />
        <div>
          <h3>Clarksdale Collegiate</h3>
          <p>PUBLIC CHARTER SCHOOL</p>
        </div>
      </div>
      <h2>6 Week Calendar of Events</h2>
    </header>
    <section class="snapshot-grid" aria-label="Month snapshots">
      ${months.map((month) => renderSnapshotMonth(month, currentDerivedData, startIso, endIso)).join("")}
    </section>
    <section class="event-list" aria-label="Events from school calendar and Google Calendar">
      ${renderEventAgenda(allEvents)}
    </section>
    <section class="report-legend" aria-label="School calendar legend">
      <div class="report-legend__group">
        <div><span class="swatch swatch--pd"></span><span>PD Day / No School</span></div>
        <div><span class="swatch swatch--program"></span><span>${escapeHtml(state.programLabel)} Day Only</span></div>
        <div><span class="swatch swatch--vacation"></span><span>Vacation / No School</span></div>
        <div><span class="swatch swatch--both"></span><span>School + ${escapeHtml(state.programLabel)}</span></div>
        <div><span class="swatch swatch--abbreviated"></span><span>Abbreviated Day</span></div>
      </div>
      <div class="report-legend__events">
        ${markerLegend("trimester", "1st Day of Trimester")}
        ${markerLegend("reportK6", "Report Card Night K-6")}
        ${markerLegend("quarter", "1st Day of Quarter")}
        ${markerLegend("report710", "Report Card Night 7-10")}
        ${markerLegend("last", "Last Day of School")}
      </div>
    </section>
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
  saveState();
  const output = document.querySelector("#calendarOutput");
  const previewTitle = document.querySelector("#previewTitle");

  if (previewTitle) {
    previewTitle.textContent = state.outputMode === "sixWeek" ? "Printable 6 week events calendar" : "Printable yearly calendar";
  }

  if (state.outputMode === "sixWeek") {
    renderSixWeekReport(output);
    autoLoadCalendarFeed();
    return;
  }

  updateFeedStatus(0);

  currentDerivedData = buildDerivedCalendarData();
  const yearRange = `${state.startYear}-${String(Number(state.startYear) + 1).slice(2)}`;
  output.className = "calendar-sheet";
  output.setAttribute("aria-label", "Generated school calendar");

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
      </div>
    </header>
    <div class="months-grid">
      ${currentDerivedData.months.map((month) => renderMonth(month, currentDerivedData)).join("")}
    </div>
    <footer class="legend-notes">
      <section class="block">
        <div class="block__title">LEGEND</div>
        <div class="legend">
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
    "outputMode",
    "reportStartDate",
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

  controls.outputMode.addEventListener("change", () => {
    state.outputMode = outputModes.has(controls.outputMode.value) ? controls.outputMode.value : "year";
    render();
  });

  controls.reportStartDate.addEventListener("change", () => {
    if (!controls.reportStartDate.value) return;
    state.reportStartDate = controls.reportStartDate.value;
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

  document.querySelector("#loadFeedButton").addEventListener("click", () => {
    hasAutoRequestedFeed = true;
    loadCalendarFeed({ manual: true });
  });

  document.querySelector("#importEventsButton").addEventListener("click", () => {
    document.querySelector("#importEventsFile").click();
  });

  document.querySelector("#clearEventsButton").addEventListener("click", () => {
    clearFeedState();
    render();
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

  document.querySelector("#importEventsFile").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const importedEvents = parseEventFile(String(reader.result || ""), file.name);
        applyLoadedFeed(importedEvents);
        state.outputMode = "sixWeek";
        syncControlsFromState();
        render();
      } catch {
        alert("That file could not be loaded as Google Calendar events. Try a Google Calendar .ics export or JSON event list.");
      } finally {
        event.target.value = "";
      }
    });
    reader.readAsText(file);
  });

  document.querySelector("#printButton").addEventListener("click", printCurrentView);
  document.querySelector("#printYearButton").addEventListener("click", printYearCalendar);
  document.querySelector("#printSixWeekButton").addEventListener("click", printSixWeekCalendar);
}

async function initializeApp() {
  seedSample();
  await loadDefaultCalendarState();
  loadSavedState();
  hasHydrated = true;
  bindControls();
  render();
}

initializeApp();
