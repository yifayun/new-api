#!/usr/bin/env python3
"""Runtime self-check for Claude SSE sanitizer scenarios (mirrors Go logic)."""
import json
import time

LOG_PATH = "/www/wwwroot/newapi/.cursor/debug-96342b.log"
SESSION = "96342b"


def log(hypothesis_id, location, message, run_id, data):
    payload = {
        "sessionId": SESSION,
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "runId": run_id,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")


class Sanitizer:
    def __init__(self):
        self.next_block_index = 0
        self.upstream_to_remapped = {}
        self.started_upstream = set()
        self.open_remapped = set()

    def assign(self, upstream):
        if upstream in self.upstream_to_remapped:
            return self.upstream_to_remapped[upstream]
        remapped = self.next_block_index
        self.next_block_index += 1
        self.upstream_to_remapped[upstream] = remapped
        return remapped

    def process(self, event):
        t = event["type"]
        upstream = event.get("index", 0)
        if t == "content_block_start":
            if upstream in self.started_upstream:
                log("E", "selfcheck.py", "duplicate start dropped", "selfcheck", {"upstreamIndex": upstream})
                return []
            remapped = self.assign(upstream)
            self.started_upstream.add(upstream)
            self.open_remapped.add(remapped)
            log("B", "selfcheck.py", "sanitizer start", "selfcheck", {"upstreamIndex": upstream, "remappedIndex": remapped, "action": "pass"})
            return [{"type": t, "index": remapped}]
        if t == "content_block_delta":
            if upstream not in self.upstream_to_remapped:
                remapped = self.assign(upstream)
                self.started_upstream.add(upstream)
                self.open_remapped.add(remapped)
                log("C", "selfcheck.py", "synthetic start for delta", "selfcheck", {"upstreamIndex": upstream, "remappedIndex": remapped})
                return [{"type": "content_block_start", "index": remapped}, {"type": t, "index": remapped}]
            remapped = self.upstream_to_remapped[upstream]
            if remapped not in self.open_remapped:
                log("C", "selfcheck.py", "delta on closed block dropped", "selfcheck", {"upstreamIndex": upstream})
                return []
            return [{"type": t, "index": remapped}]
        if t == "content_block_stop":
            if upstream not in self.started_upstream:
                log("B", "selfcheck.py", "orphan stop dropped", "selfcheck", {"upstreamIndex": upstream, "action": "drop"})
                return []
            remapped = self.upstream_to_remapped.get(upstream)
            if remapped not in self.open_remapped:
                log("B", "selfcheck.py", "duplicate stop dropped", "selfcheck", {"upstreamIndex": upstream, "action": "drop"})
                return []
            self.open_remapped.remove(remapped)
            log("B", "selfcheck.py", "sanitizer stop", "selfcheck", {"upstreamIndex": upstream, "remappedIndex": remapped, "action": "pass"})
            return [{"type": t, "index": remapped}]
        if t == "message_stop":
            open_indices = sorted(self.open_remapped)
            out = []
            for remapped in open_indices:
                log("D", "selfcheck.py", "auto-close open block", "selfcheck", {"remappedIndex": remapped})
                out.append({"type": "content_block_stop", "index": remapped})
            self.open_remapped.clear()
            out.append({"type": t})
            return out
        return [event]


def validate(events):
    started, open_set = set(), set()
    violations = []
    for ev in events:
        idx = ev.get("index", 0)
        t = ev["type"]
        if t == "content_block_start":
            if idx in started:
                violations.append(f"duplicate start {idx}")
            started.add(idx)
            open_set.add(idx)
        elif t == "content_block_delta":
            if idx not in started:
                violations.append(f"delta without start {idx}")
        elif t == "content_block_stop":
            if idx not in started:
                violations.append(f"orphan stop {idx}")
            if idx not in open_set:
                violations.append(f"stop on closed {idx}")
            open_set.discard(idx)
        elif t == "message_stop" and open_set:
            violations.append(f"open at message_stop {sorted(open_set)}")
    return violations


def run_case(name, upstream_events):
    s = Sanitizer()
    out = []
    for ev in upstream_events:
        out.extend(s.process(ev))
    v = validate(out)
    log("ALL", "selfcheck.py", f"case {name}", "selfcheck", {"violations": v, "outputCount": len(out), "valid": len(v) == 0})
    return v


def main():
    open(LOG_PATH, "w").close()
    user_case = [
        {"type": "message_start"},
        {"type": "content_block_start", "index": 0},
        {"type": "content_block_delta", "index": 0},
        {"type": "content_block_stop", "index": 0},
        {"type": "content_block_start", "index": 2},
        {"type": "content_block_delta", "index": 2},
        {"type": "content_block_stop", "index": 1},
        {"type": "content_block_stop", "index": 2},
        {"type": "message_stop"},
    ]
    v1 = run_case("user_reported", user_case)
    v2 = run_case("unclosed_block", [
        {"type": "content_block_start", "index": 0},
        {"type": "content_block_delta", "index": 0},
        {"type": "message_stop"},
    ])
    print("user_reported valid:", len(v1) == 0, v1)
    print("unclosed_block valid:", len(v2) == 0, v2)


if __name__ == "__main__":
    main()
