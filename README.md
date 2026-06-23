# Clarksdale Collegiate Calendar Builder

A static browser-based school calendar designer for building printable yearly school and 21st Century program calendars.

## Use

Open `index.html` in a browser. The app is fully static, so no build step is required.

From this folder, you can either double-click `index.html` or run a simple local server:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

The app supports:

- school-year selection from 2026-27 through 2036-37
- editable school details and notes
- school day, program day, PD, vacation, and abbreviated day markings
- event markers, including combined trimester and quarter starts
- local autosave
- JSON export and import
- print-ready calendar output

## Fonts

The required Brandon Grotesque font files are bundled in `assets/fonts/` and loaded with repo-relative `@font-face` rules in `styles.css`. The app will use those bundled files by default and then fall back to the system sans-serif stack if they are unavailable.

## Printing

Use a browser print dialog for the final calendar. Set the print scale to `60%` for the intended one-page layout.

## Data

`clarksdale-combined-2026-27-calendar.json` is the corrected import file generated from the 2026-27 source calendars.

## Import behavior

Imported JSON is validated before it is applied. Supported files use the existing top-level fields plus a `days` object keyed by ISO date. Unknown day types, unknown markers, and malformed day entries are discarded during import, and malformed documents are rejected.
