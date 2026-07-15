#!/usr/bin/env python3
"""Reconcile under-billed Claude cache-creation logs."""

import argparse
import csv
import json
import subprocess
import sys
from datetime import datetime


def run_mysql(sql):
    cmd = [
        "docker",
        "exec",
        "newapi_bneh-mysql-1",
        "sh",
        "-c",
        f'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" new-api -N -e "{sql}"',
    ]
    out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL)
    text = out.decode("utf-8", "replace").strip()
    if not text:
        return []
    return text.split("\n")


def estimate_text_tokens(completion_tokens):
    if completion_tokens < 100:
        return max(10, int(completion_tokens * 1.15))
    return max(50, min(1000, int(completion_tokens * 0.025 + 10)))


def calc_quota(
    prompt_tokens: int,
    completion_tokens: int,
    cache_tokens: int,
    cache_creation_tokens: int,
    model_ratio: float,
    group_ratio: float,
    completion_ratio: float,
    cache_ratio: float,
    cache_creation_ratio: float,
):
    ratio = model_ratio * group_ratio
    prompt_quota = (
        prompt_tokens
        + cache_tokens * cache_ratio
        + cache_creation_tokens * cache_creation_ratio
    )
    completion_quota = completion_tokens * completion_ratio
    return int((prompt_quota + completion_quota) * ratio)


def parse_row(line):
    parts = line.split("\t", 5)
    if len(parts) < 6:
        return None
    log_id, request_id, prompt_tokens, completion_tokens, quota, other_raw = parts
    other = json.loads(other_raw)
    return {
        "id": int(log_id),
        "request_id": request_id,
        "prompt_tokens": int(prompt_tokens),
        "completion_tokens": int(completion_tokens),
        "quota": int(quota),
        "other": other,
    }


def reconcile_row(row, min_cache_creation):
    other = row["other"]
    if other.get("billing_reconciled"):
        return None

    cache_creation_ratio = float(other.get("cache_creation_ratio") or 1)
    if cache_creation_ratio <= 1:
        return None

    existing_cache_creation = int(other.get("cache_creation_tokens") or 0)
    if existing_cache_creation > 0:
        return None

    cache_tokens = int(other.get("cache_tokens") or 0)
    text_tokens = estimate_text_tokens(row["completion_tokens"])
    cache_creation = max(0, row["prompt_tokens"] - cache_tokens - text_tokens)
    if cache_creation < min_cache_creation:
        return None

    model_ratio = float(other.get("model_ratio") or 1)
    group_ratio = float(other.get("group_ratio") or 1)
    completion_ratio = float(other.get("completion_ratio") or 1)
    cache_ratio = float(other.get("cache_ratio") or 0.1)

    new_quota = calc_quota(
        text_tokens,
        row["completion_tokens"],
        cache_tokens,
        cache_creation,
        model_ratio,
        group_ratio,
        completion_ratio,
        cache_ratio,
        cache_creation_ratio,
    )

    return {
        **row,
        "text_tokens": text_tokens,
        "cache_creation_tokens": cache_creation,
        "new_prompt_tokens": text_tokens,
        "new_quota": new_quota,
        "quota_delta": new_quota - row["quota"],
    }


def fetch_candidates(min_prompt_tokens):
    sql = """
SELECT id, request_id, prompt_tokens, completion_tokens, quota,
  CAST(JSON_UNQUOTE(JSON_EXTRACT(other,'$.model_ratio')) AS DECIMAL(10,4)),
  CAST(JSON_UNQUOTE(JSON_EXTRACT(other,'$.group_ratio')) AS DECIMAL(10,4)),
  CAST(JSON_UNQUOTE(JSON_EXTRACT(other,'$.completion_ratio')) AS DECIMAL(10,4)),
  CAST(JSON_UNQUOTE(JSON_EXTRACT(other,'$.cache_ratio')) AS DECIMAL(10,4)),
  CAST(JSON_UNQUOTE(JSON_EXTRACT(other,'$.cache_creation_ratio')) AS DECIMAL(10,4)),
  CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(other,'$.cache_tokens')),'0') AS UNSIGNED),
  COALESCE(JSON_EXTRACT(other,'$.billing_reconciled'), 'false')
FROM logs
WHERE type=2
  AND JSON_EXTRACT(other,'$.claude')=true
  AND (JSON_EXTRACT(other,'$.cache_creation_tokens') IS NULL OR JSON_EXTRACT(other,'$.cache_creation_tokens')=0)
  AND prompt_tokens > {min_prompt}
  AND JSON_EXTRACT(other,'$.cache_creation_ratio') > 1
  AND (JSON_EXTRACT(other,'$.billing_reconciled') IS NULL OR JSON_EXTRACT(other,'$.billing_reconciled')=false)
ORDER BY id
""".format(min_prompt=min_prompt_tokens)
    rows = []
    for line in run_mysql(sql):
        parts = line.split("\t")
        if len(parts) < 11:
            continue
        (
            log_id,
            request_id,
            prompt_tokens,
            completion_tokens,
            quota,
            model_ratio,
            group_ratio,
            completion_ratio,
            cache_ratio,
            cache_creation_ratio,
            cache_tokens,
            billing_reconciled,
        ) = parts
        rows.append(
            {
                "id": int(log_id),
                "request_id": request_id,
                "prompt_tokens": int(prompt_tokens),
                "completion_tokens": int(completion_tokens),
                "quota": int(quota),
                "other": {
                    "model_ratio": float(model_ratio),
                    "group_ratio": float(group_ratio),
                    "completion_ratio": float(completion_ratio),
                    "cache_ratio": float(cache_ratio),
                    "cache_creation_ratio": float(cache_creation_ratio),
                    "cache_tokens": int(float(cache_tokens)),
                    "billing_reconciled": billing_reconciled not in ("0", "false", "null"),
                },
            }
        )
    return rows


def apply_updates(items):
    for item in items:
        update_sql = f"""
UPDATE logs SET
  prompt_tokens={item['new_prompt_tokens']},
  quota={item['new_quota']},
  other=JSON_SET(
    JSON_SET(
      JSON_SET(
        JSON_SET(
          JSON_SET(
            JSON_SET(other,
              '$.billing_reconciled', true),
            '$.original_quota', {item['quota']}),
          '$.original_prompt_tokens', {item['prompt_tokens']}),
        '$.cache_creation_tokens', {item['cache_creation_tokens']}),
      '$.cache_write_tokens', {item['cache_creation_tokens']}),
    '$.reconciled_at', '{datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")}')
WHERE id={item['id']}
  AND quota={item['quota']}
  AND prompt_tokens={item['prompt_tokens']}
  AND (JSON_EXTRACT(other,'$.billing_reconciled') IS NULL OR JSON_EXTRACT(other,'$.billing_reconciled')=false)
"""
        run_mysql(update_sql)


def main():
    parser = argparse.ArgumentParser(description="Reconcile Claude cache-creation billing logs")
    parser.add_argument("--apply", action="store_true", help="Write corrections to database")
    parser.add_argument("--min-prompt-tokens", type=int, default=200000)
    parser.add_argument("--min-cache-creation", type=int, default=50000)
    parser.add_argument(
        "--report",
        default="/www/wwwroot/newapi/reports/claude_cache_billing_reconcile.csv",
        help="CSV report output path",
    )
    args = parser.parse_args()

    candidates = fetch_candidates(args.min_prompt_tokens)
    reconciled = []
    for row in candidates:
        item = reconcile_row(row, args.min_cache_creation)
        if item is not None:
            reconciled.append(item)

    if not reconciled:
        print("No logs matched reconciliation criteria.")
        return 0

    import os

    os.makedirs(os.path.dirname(args.report), exist_ok=True)
    with open(args.report, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "id",
                "request_id",
                "old_prompt_tokens",
                "new_prompt_tokens",
                "cache_creation_tokens",
                "completion_tokens",
                "old_quota",
                "new_quota",
                "quota_delta",
            ],
        )
        writer.writeheader()
        for item in reconciled:
            writer.writerow(
                {
                    "id": item["id"],
                    "request_id": item["request_id"],
                    "old_prompt_tokens": item["prompt_tokens"],
                    "new_prompt_tokens": item["new_prompt_tokens"],
                    "cache_creation_tokens": item["cache_creation_tokens"],
                    "completion_tokens": item["completion_tokens"],
                    "old_quota": item["quota"],
                    "new_quota": item["new_quota"],
                    "quota_delta": item["quota_delta"],
                }
            )

    total_old = sum(i["quota"] for i in reconciled)
    total_new = sum(i["new_quota"] for i in reconciled)
    total_delta = total_new - total_old

    print(f"matched_logs={len(reconciled)}")
    print(f"old_quota_total={total_old}")
    print(f"new_quota_total={total_new}")
    print(f"quota_delta_total={total_delta}")
    print(f"usd_delta_approx={total_delta / 500000:.2f}")
    print(f"report={args.report}")

    if args.apply:
        apply_updates(reconciled)
        print("database_updated=true")
    else:
        print("database_updated=false (dry-run, pass --apply to write)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
