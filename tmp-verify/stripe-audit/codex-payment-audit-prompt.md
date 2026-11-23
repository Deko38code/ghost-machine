You are auditing the Stripe payment flow of HaksterAI. READ-ONLY: do not modify, create, delete, move or chmod any file, do not run anything that writes (no git commands that write, no npm install, no database writes). Never print API keys, signing secrets, tokens or customer personal data — refer to them by name and last 4 characters at most.

Working root: /home/ghost/haksterAi

Scope:
1. server/src/index.js — every Stripe touchpoint: checkout session creation, the webhook handler (/api/stripe/webhook or similar), signature verification, idempotency, plan activation, entitlement grants, the local payments / receipts table, subscription updates, cancellation, renewals, refunds, and the owner/admin views that read those tables.
2. Any pricing / checkout front-end code (src/pages, src/components, public) that creates or displays plans and prices.
3. data/hakster.db schema for the tables involved (payments, users, entitlements, subscriptions) — read-only queries only.

Context observed on 2026-11-20 for a real $3 purchase (a customer on plan "lite", subscription sub_1UdxK9A0UrVsJMzekbCVUiJO, active for 30 days, 30 AI calls + 10 web lookups):
- The payment itself was captured correctly and the plan was granted.
- GAP 1: the local payments table records $6.00 for a $3.00 payment — a second row was inserted as a "Stripe renewal" for the same event. A race fix exists in code around index.js:1506 but the bad historical row remains.
- GAP 2: the Stripe account has two enabled webhook endpoints pointing at the same URL with one signing secret, causing recurring signature failures.
- GAP 3: the price that was actually purchased (price_1UcC82A0UrVsJMzeA3czYM9b) is archived in Stripe, so a later customer.subscription.updated would resolve planId=null and get skipped (index.js:1407-1440).
- GAP 4: the storefront now lists lite at $3.45 while the customer paid $3.00.

Your job, in two passes:
PASS A — verify or refute each of the four gaps above against the actual code, quoting file:line.
PASS B — find gaps we have not listed yet. Look for: missing idempotency keys, webhook events that are handled but never granted (or granted twice), entitlement expiry never enforced, plan downgrade paths, refunds / chargebacks unhandled, currency and tax handling, checkout success URL trusting the client, users able to forge plan state, trial logic, proration, failed-payment handling, and any place where the local ledger can disagree with Stripe.

Output: a markdown report with, for each finding: severity (critical / high / medium / low), file:line, what is wrong, the concrete failing scenario, and the smallest safe fix. Put anything unverified under "Needs live Stripe check" rather than asserting it. Rank most severe first. Do not propose a rewrite; propose the smallest correct change per finding.
