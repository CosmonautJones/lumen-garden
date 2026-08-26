from __future__ import annotations

import datetime as dt
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
LOG = ROOT / ".autonomous-build.log"
DEADLINE_HOURS = float(os.environ.get("LUMEN_BUILD_HOURS", "8"))
CODER_MODEL = os.environ.get("LUMEN_CODEx_MODEL", "gpt-5.3-codex-spark")
PASS_TIMEOUT_SECONDS = int(os.environ.get("LUMEN_PASS_TIMEOUT_SECONDS", "600"))

PASSES = [
    """Build the first complete Lumen Garden MVP from AGENTS.md, PRODUCT.md, and DESIGN.md. Work test-first on the versioned domain model and persistence layer, then implement all primary screens and flows. Replace the Vite starter completely. Add Vitest and Testing Library. Run lint, tests, and production build. Do not stop at scaffolding or a plan; leave a coherent usable app and commit it.""",
    """Act as a senior product designer and frontend engineer. Inspect the current Lumen Garden in the browser if possible. Audit the Operate/Explore composition, responsive behavior, information hierarchy, keyboard flow, focus states, contrast, reduced motion, empty/loading/error states, and mobile ergonomics. Implement the highest-impact fixes, add regression tests, run all checks, and commit.""",
    """Harden Lumen Garden's local data system. Test migrations, malformed storage, quota/write failures, import validation, duplicate IDs, referential integrity for threads, safe import preview, undo semantics, and export round trips. Improve the UI for every surfaced failure without losing data. Run all checks and commit.""",
    """Deepen the constellation into a useful work surface rather than decoration. Improve deterministic layout, selection, filters, relationship creation/removal, keyboard navigation, zoom/pan or fit behavior where appropriate, inspector continuity, and performance for hundreds of seeds. Preserve accessibility and add tests. Run all checks and commit.""",
    """Make Focus mode genuinely useful without gamification. Refine outcome setting, timer lifecycle, pause/resume/complete, persistence across reload, history, interruption-safe behavior, keyboard control, and calm visual feedback. Add robust fake-timer tests. Run all checks and commit.""",
    """Turn the app into a polished offline installable PWA. Add correct manifest/icons/service worker strategy, offline reload behavior, update posture, responsive mobile navigation, install metadata, and privacy documentation. Do not add telemetry or a server. Verify a production build and commit.""",
    """Perform a security, privacy, accessibility, and destructive-action review. Fix unsafe HTML/data handling, prototype pollution or import hazards, local-storage corruption paths, accidental destructive controls, inaccessible names/order, focus traps, and contrast. Add tests for real findings, run checks, and commit.""",
    """Add thoughtful product depth consistent with the brief: command palette, fast capture from every surface, derived review summaries with transparent provenance, clear demo-data removal, and excellent onboarding through action. No fake metrics, feature-grid UI, or decorative clutter. Test, build, and commit.""",
    """Run a ruthless code-quality pass. Find oversized components, duplicated state, stale effects, weak types, rendering hot spots, brittle CSS, and missing domain boundaries. Refactor without changing behavior, expand tests around risky seams, run all checks, and commit.""",
    """Final release-candidate pass: exercise every acceptance criterion in PRODUCT.md, inspect at desktop and mobile widths, fix every reproducible defect, remove dead starter assets and console noise, tighten README and keyboard documentation, run lint/tests/build, and commit a release-ready state.""",
]


def write_log(message: str) -> None:
    stamp = dt.datetime.now().astimezone().isoformat(timespec="seconds")
    line = f"[{stamp}] {message}"
    print(line, flush=True)
    with LOG.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def run(args: list[str], timeout: int | None = None) -> subprocess.CompletedProcess[str]:
    if isinstance(args, list) and args:
        resolved = shutil.which(args[0])
        if resolved:
            args = [resolved, *args[1:]]
    return subprocess.run(
        args,
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        errors="replace",
    )


def commit_if_changed(index: int) -> None:
    status = run(["git", "status", "--porcelain"], timeout=60).stdout.strip()
    if not status:
        write_log(f"pass {index}: no uncommitted changes")
        return
    run(["git", "add", "-A"], timeout=120)
    result = run(["git", "commit", "-m", f"chore: autonomous refinement pass {index}"], timeout=120)
    write_log(f"pass {index}: fallback commit exit={result.returncode}")
    if result.returncode == 0:
        push = run(["git", "push", "origin", "HEAD"], timeout=180)
        write_log(f"pass {index}: push exit={push.returncode}")


def main() -> int:
    started = time.monotonic()
    deadline = started + DEADLINE_HOURS * 3600
    write_log(f"starting autonomous build for up to {DEADLINE_HOURS:g} hours in {ROOT}")
    failures = 0
    index = 0

    while time.monotonic() < deadline - 300:
        prompt = PASSES[index] if index < len(PASSES) else (
            "Inspect the current Lumen Garden as an exacting maintainer. Find the single highest-value "
            "unfinished product, UX, accessibility, performance, reliability, or testing problem that is "
            "supported by evidence in the repo or browser. Implement a complete fix with tests, run lint/tests/build, "
            "and commit it. Do not repeat earlier work or add speculative infrastructure."
        )
        remaining = int(deadline - time.monotonic())
        timeout = max(120, min(PASS_TIMEOUT_SECONDS, remaining - 240))
        write_log(f"pass {index + 1} starting; {remaining // 60} minutes remain")
        try:
            result = run(
                [
                    "codex",
                    "--ask-for-approval",
                    "never",
                    "-m",
                    CODER_MODEL,
                    "exec",
                    "--sandbox",
                    "workspace-write",
                    "-C",
                    str(ROOT),
                    prompt,
                ],
                timeout=timeout,
            )
            tail = result.stdout[-4000:].replace("\x00", "")
            write_log(f"pass {index + 1} codex exit={result.returncode}\n{tail}")
            if result.returncode != 0:
                failures += 1
            else:
                failures = 0
                commit_if_changed(index + 1)
        except subprocess.TimeoutExpired:
            failures += 1
            write_log(f"pass {index + 1} timed out after {timeout}s")
            commit_if_changed(index + 1)

        if failures >= 3:
            write_log("stopping after three consecutive failed agent passes")
            break
        index += 1

    write_log("running final verification")
    for command in (["npm", "run", "lint"], ["npm", "test", "--", "--run"], ["npm", "run", "build"]):
        try:
            result = run(command, timeout=600)
            write_log(f"{' '.join(command)} exit={result.returncode}\n{result.stdout[-3000:]}")
        except subprocess.TimeoutExpired:
            write_log(f"{' '.join(command)} timed out")
    commit_if_changed(index + 1)
    write_log("autonomous build finished")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
