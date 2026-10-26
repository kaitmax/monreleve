#!/usr/bin/env python3
"""IOS-1a R564. A local HTTP server that RECORDS what the iOS transport really put on the wire.

Started by .github/workflows/ios-shared.yml before Gradle, on 127.0.0.1 only. The iOS simulator test process
(NsUrlSessionTransportWireTest) sends requests here through NsUrlSessionTransport; this server answers each one
with a JSON ECHO of the raw request it received, so the test compares what ARRIVED (method, target, headers, the
exact body bytes) with what the shared code handed the transport. Every request is also appended to a JSONL file
(--record) so the workflow can print and upload the recording.

Nothing here is a mock of the app's server: it has no routes of the product. Control routes:
  /__events        the connection events seen so far, one per line (the cancellation proof reads it)
  /__recorded      every echoed request so far, as a JSON array (the wire test reads the newest)
  /__hang          holds the request open up to 25 s, and records "closed:/__hang" the moment the CLIENT
                   closes the connection (a cancelled NSURLSessionTask closes it)
  /__status/<n>    answers with status n and a small body
  /__bytes         256 bytes (every value 0-255) with a Content-Disposition header
  anything else    the JSON echo
Standard library only; no third-party code runs in CI.
"""
import argparse
import base64
import json
import select
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

EVENTS = []
EVENTS_LOCK = threading.Lock()
RECORDED = []
RECORD_PATH = None


def event(text):
    with EVENTS_LOCK:
        EVENTS.append(text)


def record(entry):
    with EVENTS_LOCK:
        RECORDED.append(entry)
    if RECORD_PATH:
        with EVENTS_LOCK:
            with open(RECORD_PATH, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry) + "\n")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(length) if length else b""

    def _send(self, status, payload, content_type="application/json", extra=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(payload)

    def _handle(self):
        body = self._body()
        path = self.path
        if path == "/__events":
            with EVENTS_LOCK:
                text = "\n".join(EVENTS)
            self._send(200, text.encode("utf-8"), "text/plain")
            return
        if path == "/__recorded":
            with EVENTS_LOCK:
                text = json.dumps(RECORDED)
            self._send(200, text.encode("utf-8"))
            return
        if path == "/__hang":
            event("open:/__hang")
            deadline = time.time() + 25
            while time.time() < deadline:
                readable, _, _ = select.select([self.connection], [], [], 0.1)
                if readable:
                    try:
                        if self.connection.recv(1, 0x2) == b"":  # MSG_PEEK: an orderly close reads empty
                            event("closed:/__hang")
                            self.close_connection = True
                            return
                    except OSError:
                        event("closed:/__hang")
                        self.close_connection = True
                        return
            self._send(200, b"{}")
            return
        if path.startswith("/__status/"):
            status = int(path.rsplit("/", 1)[1])
            self._send(status, json.dumps({"status": status}).encode("utf-8"))
            return
        if path == "/__bytes":
            self._send(
                200,
                bytes(range(256)),
                "application/octet-stream",
                {"Content-Disposition": 'attachment; filename="releve-2026.pdf"'},
            )
            return
        headers = {key.lower(): value for key, value in self.headers.items()}
        entry = {
            "method": self.command,
            "target": path,
            "headers": headers,
            "bodyBase64": base64.b64encode(body).decode("ascii"),
        }
        record(entry)
        self._send(200, json.dumps(entry).encode("utf-8"))

    do_GET = do_POST = do_PATCH = do_PUT = do_DELETE = _handle


def main():
    global RECORD_PATH
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--record", required=True)
    args = parser.parse_args()
    RECORD_PATH = args.record
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.daemon_threads = True
    server.serve_forever()


if __name__ == "__main__":
    main()
