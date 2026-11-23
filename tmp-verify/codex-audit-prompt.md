You are a read-only verification subagent. Do not modify, create or delete any file. Do not run any command that changes state on this machine, and do not contact any network service.

Target: /home/ghost/live-stats-2026-11-20.html — a one-page dashboard of measured operational figures for three projects (HaksterAI, PhantomIDE, Junkalot).

Do exactly these three things and report concisely:

1. ARITHMETIC. Recompute every derived number from the raw inputs printed on the page and say whether each is right, wrong, or cannot be derived:
   - "Codex per 1,000 calls = $5.24" from 6.6k input tokens and 523 output tokens per call at $0.60 per million input and $2.40 per million output.
   - "Covered by 30-day revenue = 572" calls from $3.00 collected at that per-call cost.
   - "Your pace ~360 / mo" from 12 calls per day.
   - "Junkalot vs plan = 0.03%" from $0.07 of $249.
   - "Daily average 4,509" from 18,034 requests over 4 days, and "188 per hour if spread evenly".
   - "Tokens 551.8k" from 511,540 in and 40,304 out.
   - "Shortfall to plan $248.93" from $249.00 and $0.07.
   - "Lane mix 67%" from 4 of 6 turns.

2. INTERNAL CONSISTENCY. The page must never state a number that contradicts another number on it, and must never present an unverified figure as measured. Flag any contradiction, any figure lacking a stated basis, and anything that reads as a projection while being phrased as measured.

3. CHART CORRECTNESS. Read the inline script. Confirm the bar heights, the lane bar widths, the table rows and the axis labels come from the same arrays as the printed values, and that no value is drawn at a scale that misrepresents it (e.g. a bar shown at a minimum width while its label says a different magnitude — say whether the page discloses that).

Output: a short numbered list of findings, each marked OK / WRONG / UNVERIFIABLE, with the correct figure where you found an error. Then one line: OVERALL = PASS or FAIL. Be terse. No preamble.
