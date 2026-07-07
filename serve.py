#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from urllib.request import Request, urlopen

CONFIG = {
    "feed_url": "https://calendar.google.com/calendar/ical/o59hmaf4ut144dmc69opn42j8c%40group.calendar.google.com/public/basic.ics",
    "host": "0.0.0.0",
    "port": 8000,
}


class CalendarHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if urlparse(self.path).path == "/calendar-feed.ics":
            self.proxy_calendar_feed()
            return

        super().do_GET()

    def do_HEAD(self):
        if urlparse(self.path).path == "/calendar-feed.ics":
            self.send_response(200)
            self.send_header("Content-Type", "text/calendar; charset=utf-8")
            self.end_headers()
            return

        super().do_HEAD()

    def proxy_calendar_feed(self):
        try:
            request = Request(CONFIG["feed_url"], headers={"User-Agent": "ClarksdaleCalendarBuilder/1.0"})
            with urlopen(request, timeout=20) as response:
                payload = response.read()
        except Exception as error:
            message = f"Calendar feed request failed: {error}".encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(message)))
            self.end_headers()
            self.wfile.write(message)
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/calendar; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    server = ThreadingHTTPServer((CONFIG["host"], CONFIG["port"]), CalendarHandler)
    print(f"Serving calendar builder on http://{CONFIG['host']}:{CONFIG['port']}/")
    print("Proxying Google Calendar feed at /calendar-feed.ics")
    server.serve_forever()
