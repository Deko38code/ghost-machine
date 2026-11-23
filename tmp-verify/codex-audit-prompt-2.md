Read-only follow-up audit. Do not modify any file. Do not run state-changing commands.

Target: /home/ghost/live-stats-2026-11-20.html (revised since your last pass).

You previously reported: (1) $5.24 per 1,000 calls used a rounded 6.6k input; (2) 0.03% was a rounding of 0.0281%; (3) the Junkalot gauge was hard-coded at 0.4% and the page's "nothing is extrapolated" claim conflicted with derived figures.

Now check only:
a) Does the page state the exact per-call inputs (6,644 in / 523 out) and is $5.24 per 1,000 calls correct from those?
b) Is 572 calls from $3.00 correct at $5.24 per 1,000?
c) Is the gauge width now computed rather than hard-coded, and is the 2px floor disclosed?
d) Is every derived figure now labelled as derived (or measured, where it is a row), so no derived number reads as measured and no measured number reads as a guess?
e) Any remaining contradiction between two numbers on the page, or any figure without a stated basis.

Output one line per item with OK or WRONG plus the reason, then OVERALL = PASS or FAIL.
