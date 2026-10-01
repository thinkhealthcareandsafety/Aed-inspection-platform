"""
Scores the checklist AI against the evaluation set, with the real model.

    (inside the CV service image, from python-cv/, GEMINI_API_KEY set)
    python -m eval.run_eval --runs 2
    python -m eval.run_eval --image-model gemini-3.5-flash-lite --resolution high
    python -m eval.run_eval --only readiness_indicator --video-model gemini-3.8-flash

What it reports, most important first:
  critical   — passed something that should fail, or passed with a WRONG
               serial or date. For a safety inspection this must be zero.
  false alarm— a clean capture of a good unit that did not pass (a retake
               the inspector shouldn't have needed).
  retake     — a degraded capture that asked for a retake (fine).
  misread    — a failed check that reported a wrong value (e.g. an expired
               date read as another expired date): the verdict is right,
               but the replacement pipeline gets a wrong date.
plus latency and tokens per kind of media. Every run is written to JSON so
two configurations can be compared case by case.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import statistics
import time
from collections import Counter, defaultdict
from pathlib import Path

from google.genai import types

from app.services import gemini_checklist_service as svc
from eval.cases import CASES, Case

CRITICAL = ("false_pass", "wrong_read")


def _alnum(value) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(value or "").upper())


def score(case: Case, res) -> dict:
    value_ok = None
    if case.serial:
        value_ok = bool(res.serial_number) and re.fullmatch(case.serial, _alnum(res.serial_number)) is not None
    elif case.expiry:
        value_ok = bool(res.expiry_date) and res.expiry_date[:7] == case.expiry
    reported = bool(res.serial_number or res.expiry_date)

    if case.expect == "pass":
        outcome = ("correct" if value_ok in (None, True) else "wrong_read") if res.passed else "false_alarm"
    elif case.expect == "fail":
        outcome = "false_pass" if res.passed else "correct"
    else:
        outcome = ("correct" if value_ok in (None, True) else "wrong_read") if res.passed else "retake"
    return {
        "outcome": outcome,
        "misread": (not res.passed) and value_ok is False and reported,
        "passed": res.passed,
        "serial": res.serial_number,
        "expiry": res.expiry_date,
        "status": res.status,
        "notes": res.notes,
        "meta": res.meta.model_dump() if res.meta else None,
    }


async def run_case(case: Case, runs: int, gates: dict) -> list:
    data = await asyncio.to_thread(case.build)
    gate = gates["video" if case.content_type.startswith("video") else "image"]
    results = []
    for _ in range(runs):
        async with gate:
            try:
                res = await svc.analyze_checklist_item(case.item, data, case.content_type, aed_model=case.model)
                results.append(score(case, res))
            except Exception as exc:  # noqa: BLE001 — an outage is a result too
                results.append({"outcome": "error", "error": f"{type(exc).__name__}: {exc}"[:240]})
    return results


def _pct(n: int, d: int) -> str:
    return f"{n}/{d} ({100 * n / d:.0f}%)" if d else "0/0"


def report(rows: list, config: dict) -> dict:
    flat = [(case, r) for case, results in rows for r in results]
    outcomes = Counter(r["outcome"] for _, r in flat)
    total = len(flat)
    clean_pass = [(c, r) for c, r in flat if c.expect == "pass" and "clean" in c.tags]
    critical = sum(outcomes[k] for k in CRITICAL)

    print("\n=== Configuration ===")
    for k, v in config.items():
        print(f"  {k}: {v}")
    print("\n=== Scorecard ===")
    print(f"  runs            {total}  ({len(rows)} cases)")
    print(f"  correct         {_pct(outcomes['correct'], total)}")
    print(f"  CRITICAL        {_pct(critical, total)}   false pass {outcomes['false_pass']}, wrong read {outcomes['wrong_read']}")
    print(f"  false alarm     {_pct(sum(r['outcome'] == 'false_alarm' for _, r in clean_pass), len(clean_pass))} of clean good units")
    print(f"  retake          {outcomes['retake']} (degraded captures)")
    print(f"  misread value   {sum(bool(r.get('misread')) for _, r in flat)}")
    print(f"  errors          {outcomes['error']}")

    by_kind = defaultdict(list)
    for c, r in flat:
        if r.get("meta"):
            by_kind["video" if c.content_type.startswith("video") else "image"].append(r["meta"])
    print("\n=== Speed and size ===")
    summary = {}
    for kind, metas in by_kind.items():
        lat = sorted(m["latency_ms"] for m in metas if m.get("latency_ms") is not None)
        tok_in = [m["input_tokens"] for m in metas if m.get("input_tokens")]
        tok_out = [(m.get("output_tokens") or 0) + (m.get("thinking_tokens") or 0) for m in metas]
        models = Counter(m.get("model") for m in metas)
        p95 = lat[min(len(lat) - 1, int(len(lat) * 0.95))] if lat else None
        summary[kind] = {
            "p50_ms": statistics.median(lat) if lat else None,
            "p95_ms": p95,
            "avg_input_tokens": round(statistics.mean(tok_in)) if tok_in else None,
            "avg_output_tokens": round(statistics.mean(tok_out)) if tok_out else None,
            "models": dict(models),
        }
        print(f"  {kind:5}  p50 {summary[kind]['p50_ms']} ms  p95 {p95} ms  "
              f"in {summary[kind]['avg_input_tokens']} tok  out+think {summary[kind]['avg_output_tokens']} tok  "
              f"answered by {dict(models)}")

    print("\n=== Everything that wasn't simply correct ===")
    by_tag = defaultdict(Counter)
    for case, results in rows:
        for r in results:
            for t in case.tags:
                by_tag[t][r["outcome"]] += 1
        bad = [r for r in results if r["outcome"] != "correct" or r.get("misread")]
        if not bad:
            continue
        for r in bad:
            mark = "!!" if r["outcome"] in CRITICAL else "  "
            detail = r.get("error") or (
                f"passed={r['passed']} serial={r['serial']} expiry={r['expiry']} status={r['status']} "
                f"overrides={(r.get('meta') or {}).get('overrides')} | {str(r.get('notes'))[:120]}"
            )
            extra = " (misread)" if r.get("misread") else ""
            print(f"  {mark} {case.id:32} {r['outcome']}{extra}: {detail}")

    print("\n=== By kind of capture ===")
    for tag in sorted(by_tag):
        counts = by_tag[tag]
        n = sum(counts.values())
        crit = sum(counts[k] for k in CRITICAL)
        print(f"  {tag:12} {n:3} runs  correct {_pct(counts['correct'], n):>12}  critical {crit}  "
              f"retake {counts['retake']}  false alarm {counts['false_alarm']}")
    return {"outcomes": dict(outcomes), "critical": critical, "speed": summary}


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=2)
    ap.add_argument("--image-model")
    ap.add_argument("--image-fallback", action="append",
                    help="backup photo model(s); 'none' to measure one model on its own")
    ap.add_argument("--video-model", action="append", help="repeat for a fallback chain")
    ap.add_argument("--resolution", choices=["low", "medium", "high"])
    ap.add_argument("--thinking", choices=["low", "high"])
    ap.add_argument("--only", help="item id, or a case id prefix")
    ap.add_argument("--ids", help="comma-separated case ids")
    ap.add_argument("--parallel", type=int, default=4)
    ap.add_argument("--out")
    args = ap.parse_args()

    if args.image_model:
        svc.GEMINI_IMAGE_MODEL = args.image_model
    if args.image_fallback:
        svc.GEMINI_IMAGE_FALLBACKS = tuple(m for m in args.image_fallback if m != "none")
    if args.video_model:
        svc.GEMINI_VIDEO_MODELS = tuple(args.video_model)
    if args.resolution:
        svc.IMAGE_MEDIA_RESOLUTION = getattr(types.MediaResolution, f"MEDIA_RESOLUTION_{args.resolution.upper()}")
    if args.thinking:
        svc.THINKING_LEVEL = args.thinking

    cases = [c for c in CASES if not args.only or c.item == args.only or c.id.startswith(args.only)]
    if args.ids:
        wanted = args.ids.split(",")
        cases = [c for c in cases if c.id in wanted]
    config = {
        "image model": svc.GEMINI_IMAGE_MODEL,
        "image fallbacks": svc.GEMINI_IMAGE_FALLBACKS,
        "video models": svc.GEMINI_VIDEO_MODELS,
        "image resolution": args.resolution or "model default",
        "thinking": args.thinking or "model default",
        "runs per case": args.runs,
    }
    gates = {"image": asyncio.Semaphore(args.parallel), "video": asyncio.Semaphore(2)}
    started = time.monotonic()
    rows = list(zip(cases, await asyncio.gather(*(run_case(c, args.runs, gates) for c in cases))))
    summary = report(rows, config)
    print(f"\n  wall time {time.monotonic() - started:.0f} s")

    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(
            json.dumps(
                {
                    "config": {k: str(v) for k, v in config.items()},
                    "summary": summary,
                    "cases": [{"id": c.id, "item": c.item, "expect": c.expect, "tags": c.tags, "runs": res}
                              for c, res in rows],
                },
                indent=1,
                default=str,
            )
        )


if __name__ == "__main__":
    asyncio.run(main())
