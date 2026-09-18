"""Offline report. Usage: python report-token-input.py <audit-dir> <tokenizer.json>

Requires the Python tokenizers package only for this audit, not for the application.
The audit directory contains before/after.jsonl, before/after.log and frozen-inputs.json.
Local token counts exclude provider-side schema formatting/chat templates. Usage and
cost come exclusively from actual provider responses, never estimated prices.
"""
import hashlib
import json
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path
from tokenizers import Tokenizer

root, tokenizer_file = map(Path, sys.argv[1:3])
tokenizer = Tokenizer.from_file(str(tokenizer_file))


def tokens(text):
    return len(tokenizer.encode(text, add_special_tokens=False).ids)


def stats(values):
    return {"mean": statistics.mean(values), "min": min(values), "max": max(values)} if values else None


def usage_report(records):
    usages = [r["usage"] for r in records]
    return {
        "calls": len(records),
        "prompt": sum(u.get("prompt_tokens", 0) for u in usages),
        "completion": sum(u.get("completion_tokens", 0) for u in usages),
        "cached": sum(u.get("prompt_tokens_details", {}).get("cached_tokens", 0) for u in usages),
        "costUsd": sum(u["cost"] for u in usages) if all(isinstance(u.get("cost"), (int, float)) for u in usages) else None,
        "promptPerCall": stats([u.get("prompt_tokens", 0) for u in usages]),
    }


def run_report(name):
    rows = [json.loads(line) for line in (root / f"{name}.jsonl").read_text(encoding="utf-8").splitlines()]
    requests = {r["id"]: r["body"] for r in rows if r["phase"] == "request"}
    records, errors = [], []
    groups, providers = defaultdict(list), defaultdict(list)
    for row in rows:
        if row["phase"] == "error":
            errors.append(row)
        if row["phase"] != "response":
            continue
        if row["status"] != 200:
            errors.append({"id": row["id"], "status": row["status"]})
            continue
        response = json.loads(row["body"])
        if "usage" not in response:
            errors.append({"id": row["id"], "missingUsage": True})
            continue
        request = requests[row["id"]]
        kind = request["response_format"]["json_schema"]["name"]
        record = {"id": row["id"], "kind": kind, "provider": response.get("provider"), "usage": response["usage"]}
        records.append(record)
        groups[kind].append(record)
        if kind == "action_proposal":
            providers[record["provider"]].append(record)
    logs = (root / f"{name}.log").read_text(encoding="utf-8-sig")
    summary_file = root / name / "summary.json"
    summary = json.loads(summary_file.read_text(encoding="utf-8")) if summary_file.exists() else {}
    events_file = root / name / "events.jsonl"
    events = [json.loads(line) for line in events_file.read_text(encoding="utf-8").splitlines()] if events_file.exists() else []
    result = {
        **usage_report(records), "requests": len(requests), "errors": errors,
        "byKind": {k: usage_report(v) for k, v in groups.items()},
        "actionProviders": {k: usage_report(v) for k, v in providers.items()},
        "schemaMismatches": logs.count("schema mismatch from"), "invalidJson": logs.count("not json from"),
        "fallbacks": logs.count("fallback stood in"), "truncations": logs.count("truncated at max_tokens"),
        "elapsedMs": summary.get("elapsedMs"), "citizens": summary.get("citizens"),
        "eventKinds": dict(Counter(e["kind"] for e in events)), "events": len(events),
    }
    return result


frozen = json.loads((root / "frozen-inputs.json").read_text(encoding="utf-8"))
blocks = {side: {key: stats([tokens(row[side][key]) for row in frozen]) for key in frozen[0][side]} for side in ("before", "after")}
totals = {side: stats([sum(tokens(text) for text in row[side].values()) for row in frozen]) for side in blocks}
report = {
    "tokenizer": {"file": str(tokenizer_file), "sha256": hashlib.sha256(tokenizer_file.read_bytes()).hexdigest(), "addSpecialTokens": False},
    "frozenInputs": len(frozen), "blocks": blocks, "localTotals": totals,
    "perceptionFields": {key: stats([tokens(row["perceptionFields"][key]) for row in frozen if key in row["perceptionFields"]]) for key in frozen[0]["perceptionFields"]},
    "perceptionIdentical": all(row["before"]["perception"] == row["after"]["perception"] for row in frozen),
    "runs": {name: run_report(name) for name in ("before", "after")},
}
(root / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
for name, run in report["runs"].items():
    print(name, json.dumps({key: run[key] for key in ("calls", "prompt", "completion", "cached", "costUsd", "schemaMismatches", "invalidJson", "fallbacks", "events")}))
print("Local tokens, frozen inputs:", totals)
