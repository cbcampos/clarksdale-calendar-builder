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

The calendar is designed to use Brandon Grotesque. On the original development machine, the CSS references these locally installed font files:

```text
/Users/ccampos/Library/Fonts/Brandon_reg.otf
/Users/ccampos/Library/Fonts/Brandon_med.otf
/Users/ccampos/Library/Fonts/Brandon_bld.otf
```

If those files are not installed at those paths, the browser will fall back to system sans-serif fonts. To preserve the intended appearance on another machine, install Brandon Grotesque locally or update the `@font-face` paths in `styles.css` to match that machine.

## Printing

Use a browser print dialog for the final calendar. Set the print scale to `60%` for the intended one-page layout.

## Data

`clarksdale-combined-2026-27-calendar.json` is the corrected import file generated from the 2026-27 source calendars.
