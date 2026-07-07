# Clarksdale Collegiate Calendar Builder

A static browser-based school calendar designer for building printable yearly school and 21st Century program calendars.

Hosted site:

```text
https://cbcampos.github.io/clarksdale-calendar-builder/
```

## Use

Run the local server from this folder:

```sh
python3 serve.py
```

Then open:

```text
http://localhost:8000
```

`serve.py` also proxies the public Google Calendar ICS feed used by the 6 week events view at `/calendar-feed.ics`, avoiding browser CORS failures.

Opening `index.html` directly still works for manual calendar editing. Live Google Calendar refresh on GitHub Pages requires a Google Calendar API key in `calendar-config.js`; without that key, the app falls back to the bundled `calendar-feed.ics` snapshot.

The app supports:

- school-year selection from 2026-27 through 2036-37
- editable school details and notes
- school day, program day, PD, vacation, and abbreviated day markings
- event markers, including combined trimester and quarter starts
- local autosave
- JSON export and import
- Google Calendar live API or ICS snapshot feed loading for the 6 week events view
- explicit print buttons for the yearly calendar and 6 week PDF
- print-ready calendar output

## Fonts

The required Brandon Grotesque font files are bundled in `assets/fonts/` and loaded with repo-relative `@font-face` rules in `styles.css`. The app will use those bundled files by default and then fall back to the system sans-serif stack if they are unavailable.

## Printing

Use the app's print buttons for the intended output:

- `Print year calendar`: yearly one-page calendar; set print scale to `60%`.
- `Print 6 week PDF`: six-week events calendar; use Letter, Portrait, and default/100% scale.

## Data

`school-calendar-2026-2027.json` is loaded by default when the app starts.

The 6 week events view can load events in two ways:

- Live Google Calendar API: add a browser-restricted Google Calendar API key to `calendar-config.js`.
- Snapshot fallback: leave the key blank and the app loads the bundled `calendar-feed.ics`.

For true staff refresh on GitHub Pages:

1. In Google Cloud Console, create or select a project.
2. Enable the Google Calendar API.
3. Create an API key.
4. Restrict the key to HTTP referrers:
   - `https://cbcampos.github.io/*`
   - `http://localhost:*` if local testing is needed
5. Restrict the key to the Google Calendar API.
6. Put the key in `calendar-config.js`:

```js
window.CalendarBuilderConfig = {
  googleCalendarApiKey: "YOUR_RESTRICTED_API_KEY",
};
```

After that, the existing `Refresh feed` button loads the public Google Calendar live from GitHub Pages.

## Import behavior

Imported JSON is validated before it is applied. Supported files use the existing top-level fields plus a `days` object keyed by ISO date. Unknown day types, unknown markers, and malformed day entries are discarded during import, and malformed documents are rejected.
