#!/usr/bin/env python3
import subprocess, re, sys

with open("p2files.txt") as f:
    files = [l.strip() for l in f if l.strip()]

ok = 0
broken = 0
for f in files:
    r = subprocess.run(["npx", "vitest", "run", f], capture_output=True, text=True, timeout=30)
    output = r.stdout + r.stderr
    if "passed (1)" in output or ("Tests" in output and "1 failed" not in output):
        m = re.search(r"(\d+) passed", output)
        m2 = re.search(r"(\d+) failed", output)
        if m and (not m2 or m2.group(1) == "0"):
            print(f"OK: {f} ({m.group(1)} tests)")
            ok += 1
            continue
    if "Transform failed" in output:
        err = re.search(r"ERROR: (.+)", output)
        msg = err.group(1)[:80] if err else "unknown"
        print(f"TRANSFORM: {f} -- {msg}")
    elif "is not defined" in output:
        m = re.search(r"ReferenceError: (\S+) is not defined", output)
        var = m.group(1) if m else "unknown"
        print(f"UNDEFINED: {f} -- var: {var}")
    elif "SyntaxError" in output:
        print(f"SYNTAX: {f}")
    else:
        lines = [l for l in output.split(chr(10)) if "FAIL" in l or "Error" in l or "failed" in l]
        if lines:
            print(f"FAIL: {f} -- {lines[0][:100]}")
        else:
            print(f"FAIL: {f}")
    broken += 1

print(f"\nOK: {ok}, BROKEN: {broken}")
