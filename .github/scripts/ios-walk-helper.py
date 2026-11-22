#!/usr/bin/env python3
"""IOS-WALK (I2) R1340-R1346. THE WALK'S RUNNER-LOCAL HELPER: a relay in front of the throwaway server, and the
control routes the XCUITest walk calls. Started by .github/workflows/ios-walk.yml on 127.0.0.1 only; standard library
only (a runner tool, not a project dependency, as .github/scripts/ios-wire-server.py is).

THE RELAY (--relay-port). The walk build's API base URL points HERE, and every request is forwarded unchanged to the
throwaway `next dev` server (--upstream-port). It exists for two measurements only:
  - what the app sent and when: METHOD, PATH (never the query string, never a header, never a body) and status;
  - the drain proof (R1344): /down makes the relay answer 503 to the app, so a day recorded then stays PENDING on the
    phone; /up restores it, and the foreground's drain is what sends it.
The app's last bearer token is kept IN MEMORY ONLY so /entries can read the year back THROUGH THE API (R1345's server
side) with the app's own session - no extra sign-in, no database read. It is written to the masks file the moment it
is first seen, and never printed.

THE MAILBOX. The server's development outbox prints each mail to its stdout, which the workflow writes to a file that
no step ever prints (--server-log). /code reads the six-digit code out of it for one address; BEFORE answering it
appends the code and the link's token to --masks, which the driving step turns into ::add-mask:: lines, and waits
for that to be processed. Nothing here prints a code, a token or a link: this process's stdout and stderr go to a
file that is never uploaded and never printed.

CONTROL ROUTES (--control-port, GET unless stated):
  /mailcount?to=A        how many sign-in mails A has had (the test reads it BEFORE asking, so /code never returns a
                         stale code)
  /code?to=A&after=N     the code of A's (N+1)-th mail or later, waited for up to 90 s; masked first
  /link?to=A             R1346: GETs the callback link of A's latest mail AS A MAIL CLIENT WOULD - only after asserting
                         its host is localhost and its port is the upstream's (fails closed: anything else is refused
                         and never requested); answers the status and the Location's path only
  /down, /up             the relay's mode
  /requests              what the relay forwarded, as JSON [[t, method, path, status], ...]
  /shot?name=N           a simctl screenshot of the simulator into --out/shots/N.png
  /note?line=T           one line appended to --out/walk-result.txt (refused if it carries a known secret)
  POST /tree?name=N      an accessibility dump into --out/trees/N.txt (refused if it carries a known secret)
  /probe                 the app's walk-probe file (WalkProbe.swift), read from its data container with simctl
  /entries?year=Y&n=K    GET /api/v1/entries?year=Y upstream with the app's own bearer; saved to
                         --out/server-entries-K.json and returned
"""
import argparse
import http.client
import json
import os
import re
import subprocess
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ARGS = None
LOCK = threading.Lock()
STATE = {"down": False, "bearer": None}
REQUESTS = []
SECRETS = set()
HOP = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers",
       "transfer-encoding", "upgrade", "content-length", "host"}
NAME = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


def remember_secret(value):
    """Append a secret to the masks file (the driving step masks it), once. Returns after the step has had time."""
    if not value:
        return
    with LOCK:
        if value in SECRETS:
            return
        SECRETS.add(value)
        with open(ARGS.masks, "a", encoding="utf-8") as handle:
            handle.write(value + "\n")
            handle.flush()
            os.fsync(handle.fileno())
    time.sleep(1.5)


def carries_secret(text):
    with LOCK:
        known = list(SECRETS)
    for secret in known:
        if secret and (secret in text or (len(secret) > 12 and secret[:12] in text)):
            return True
    return False


def mails(address):
    """Every sign-in mail to `address` in the server log, oldest first: [(code, link)]."""
    try:
        with open(ARGS.server_log, encoding="utf-8", errors="replace") as handle:
            lines = handle.read().splitlines()
    except FileNotFoundError:
        return []
    found = []
    i = 0
    while i < len(lines):
        if re.match(r"^to:\s+" + re.escape(address) + r"\s*$", lines[i].strip()):
            code = None
            link = None
            j = i + 1
            while j < len(lines) and j < i + 40 and not lines[j].startswith("---------------"):
                text = lines[j].strip()
                if link is None and "/api/v1/auth/callback" in text and text.startswith("http"):
                    link = text
                elif code is None and re.fullmatch(r"\d{6}", text):
                    code = text
                j += 1
            if code is not None:
                found.append((code, link))
            i = j
        else:
            i += 1
    return found


def link_token(link):
    if not link:
        return None
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(link).query)
    return (query.get("token") or [None])[0]


class Relay(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    def _forward(self):
        path = urllib.parse.urlsplit(self.path).path
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        auth = self.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            token = auth[len("Bearer "):].strip()
            remember_secret(token)
            STATE["bearer"] = token
        if STATE["down"]:
            status, payload, headers = 503, b'{"status":"error","code":"walk_relay_down"}', [
                ("Content-Type", "application/json")]
        else:
            try:
                upstream = http.client.HTTPConnection("127.0.0.1", ARGS.upstream_port, timeout=180)
                forwarded = {k: v for k, v in self.headers.items() if k.lower() not in HOP}
                upstream.request(self.command, self.path, body=body, headers=forwarded)
                response = upstream.getresponse()
                payload = response.read()
                status = response.status
                headers = [(k, v) for k, v in response.getheaders() if k.lower() not in HOP]
                upstream.close()
            except Exception as error:  # noqa: BLE001 - the relay answers, it does not crash
                status, payload, headers = 502, b'{"status":"error","code":"walk_relay_upstream"}', [
                    ("Content-Type", "application/json")]
                print("relay upstream error: %s" % type(error).__name__, flush=True)
        with LOCK:
            REQUESTS.append([round(time.time(), 3), self.command, path, status])
        self.send_response(status)
        for key, value in headers:
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = do_HEAD = _forward


class Control(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    def _answer(self, status, payload):
        data = payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _query(self):
        parts = urllib.parse.urlsplit(self.path)
        return parts.path, {k: v[0] for k, v in urllib.parse.parse_qs(parts.query).items()}

    def do_GET(self):
        path, q = self._query()
        try:
            handler = getattr(self, "get_" + path.strip("/").replace("-", "_"), None)
            if handler is None:
                return self._answer(404, {"error": "no such route"})
            return handler(q)
        except Exception as error:  # noqa: BLE001
            print("control error on %s: %s" % (path, type(error).__name__), flush=True)
            return self._answer(500, {"error": type(error).__name__})

    def do_POST(self):
        path, q = self._query()
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length).decode("utf-8", errors="replace") if length else ""
        if path == "/tree":
            name = q.get("name", "")
            if not NAME.match(name):
                return self._answer(400, {"error": "bad name"})
            if carries_secret(body):
                self._note("REFUSED tree %s: it carries a known secret (not written)" % name)
                return self._answer(409, {"error": "refused"})
            os.makedirs(os.path.join(ARGS.out, "trees"), exist_ok=True)
            with open(os.path.join(ARGS.out, "trees", name + ".txt"), "w", encoding="utf-8") as handle:
                handle.write(body)
            return self._answer(200, {"ok": True})
        return self._answer(404, {"error": "no such route"})

    def _note(self, line):
        stamp = time.strftime("%H:%M:%S", time.gmtime())
        with LOCK:
            with open(os.path.join(ARGS.out, "walk-result.txt"), "a", encoding="utf-8") as handle:
                handle.write("%s %s\n" % (stamp, line))

    def get_health(self, q):
        return self._answer(200, {"ok": True})

    def get_mailcount(self, q):
        return self._answer(200, {"count": len(mails(q.get("to", "")))})

    def get_code(self, q):
        address = q.get("to", "")
        after = int(q.get("after", "0"))
        if not address.endswith("@monreleve.test"):
            return self._answer(400, {"error": "only @monreleve.test accounts"})
        deadline = time.time() + 90
        while time.time() < deadline:
            found = mails(address)
            if len(found) > after:
                code, link = found[-1]
                remember_secret(link_token(link))
                remember_secret(code)
                return self._answer(200, {"code": code, "count": len(found)})
            time.sleep(1)
        return self._answer(504, {"error": "no mail arrived for this address in 90 s (rate limit? NO RESULT)"})

    def get_link(self, q):
        address = q.get("to", "")
        found = mails(address)
        if not found or not found[-1][1]:
            return self._answer(404, {"error": "no link"})
        link = found[-1][1]
        remember_secret(link_token(link))
        parts = urllib.parse.urlsplit(link)
        if parts.scheme != "http" or parts.hostname != "localhost" or parts.port != ARGS.upstream_port \
                or parts.path != "/api/v1/auth/callback":
            return self._answer(409, {"error": "REFUSED: the link is not the runner-local server's; not requested"})
        connection = http.client.HTTPConnection("127.0.0.1", ARGS.upstream_port, timeout=180)
        connection.request("GET", parts.path + "?" + parts.query, headers={"Host": parts.netloc})
        response = connection.getresponse()
        response.read()
        location = response.getheader("Location") or ""
        connection.close()
        where = urllib.parse.urlsplit(location)
        return self._answer(200, {"status": response.status,
                                  "location": "%s://%s%s" % (where.scheme, where.netloc, where.path) if location else ""})

    def get_down(self, q):
        STATE["down"] = True
        return self._answer(200, {"down": True})

    def get_up(self, q):
        STATE["down"] = False
        return self._answer(200, {"down": False})

    def get_requests(self, q):
        with LOCK:
            return self._answer(200, list(REQUESTS))

    def get_shot(self, q):
        name = q.get("name", "")
        if not NAME.match(name):
            return self._answer(400, {"error": "bad name"})
        os.makedirs(os.path.join(ARGS.out, "shots"), exist_ok=True)
        target = os.path.join(ARGS.out, "shots", name + ".png")
        done = subprocess.run(["xcrun", "simctl", "io", ARGS.udid, "screenshot", target],
                              capture_output=True, text=True, timeout=60)
        return self._answer(200 if done.returncode == 0 else 500, {"ok": done.returncode == 0})

    def get_note(self, q):
        line = q.get("line", "")
        if carries_secret(line):
            self._note("REFUSED note: it carried a known secret (not written)")
            return self._answer(409, {"error": "refused"})
        self._note(line)
        return self._answer(200, {"ok": True})

    def get_probe(self, q):
        done = subprocess.run(["xcrun", "simctl", "get_app_container", ARGS.udid, ARGS.bundle, "data"],
                              capture_output=True, text=True, timeout=60)
        if done.returncode != 0:
            return self._answer(404, {"error": "no data container"})
        try:
            with open(os.path.join(done.stdout.strip(), "Documents", "walk-probe.txt"), encoding="utf-8") as handle:
                return self._answer(200, handle.read().encode("utf-8"))
        except FileNotFoundError:
            return self._answer(404, {"error": "no probe file"})

    def get_entries(self, q):
        year = q.get("year", "")
        n = q.get("n", "1")
        if not re.fullmatch(r"\d{4}", year) or not re.fullmatch(r"\d{1,2}", n):
            return self._answer(400, {"error": "bad year or n"})
        token = STATE["bearer"]
        if token is None:
            return self._answer(409, {"error": "no bearer seen yet"})
        connection = http.client.HTTPConnection("127.0.0.1", ARGS.upstream_port, timeout=180)
        connection.request("GET", "/api/v1/entries?year=" + year, headers={"Authorization": "Bearer " + token})
        response = connection.getresponse()
        data = response.read()
        connection.close()
        if carries_secret(data.decode("utf-8", errors="replace")):
            return self._answer(409, {"error": "refused"})
        with open(os.path.join(ARGS.out, "server-entries-%s.json" % n), "wb") as handle:
            handle.write(data)
        return self._answer(response.status, data)


def main():
    global ARGS
    parser = argparse.ArgumentParser()
    parser.add_argument("--relay-port", type=int, required=True)
    parser.add_argument("--upstream-port", type=int, required=True)
    parser.add_argument("--control-port", type=int, required=True)
    parser.add_argument("--server-log", required=True)
    parser.add_argument("--masks", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--udid", required=True)
    parser.add_argument("--bundle", required=True)
    ARGS = parser.parse_args()
    open(ARGS.masks, "a").close()
    os.makedirs(ARGS.out, exist_ok=True)
    relay = ThreadingHTTPServer(("127.0.0.1", ARGS.relay_port), Relay)
    control = ThreadingHTTPServer(("127.0.0.1", ARGS.control_port), Control)
    threading.Thread(target=relay.serve_forever, daemon=True).start()
    print("helper up: relay %d -> %d, control %d" % (ARGS.relay_port, ARGS.upstream_port, ARGS.control_port),
          flush=True)
    control.serve_forever()


if __name__ == "__main__":
    main()
