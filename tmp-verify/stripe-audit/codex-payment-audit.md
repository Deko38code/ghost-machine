# Stripe payment flow audit

Audited the source and read the SQLite schema through a read-only connection. The database contains `payments`, `subscriptions`, and `users`; it has no `entitlements` table. Paid access is represented by `users.plan` and enforced by the usage code.

## Pass A — the four reported gaps

| Gap | Result | Evidence |
|---|---|---|
| **1. Duplicate $3 payment row** | **The current database does not show the reported duplicate.** For the subscription ID provided, the read-only query found one matching payment row totaling $3.00. The webhook code also suppresses an initial subscription invoice when it finds the corresponding checkout row. | [server/src/index.js:1500](/home/ghost/haksterAi/server/src/index.js:1500)–[1509](/home/ghost/haksterAi/server/src/index.js:1509), [server/src/index.js:1534](/home/ghost/haksterAi/server/src/index.js:1534)–[1545](/home/ghost/haksterAi/server/src/index.js:1545). The current database result does not establish whether the historical duplicate was later corrected. |
| **2. Two enabled endpoints, recurring signature failures** | **Needs live Stripe check.** The handler verifies signatures with the configured webhook secret, but repository code cannot establish how many endpoints are enabled in Stripe or whether their secrets match. | [server/src/index.js:815](/home/ghost/haksterAi/server/src/index.js:815)–[820](/home/ghost/haksterAi/server/src/index.js:820), [server/src/index.js:1220](/home/ghost/haksterAi/server/src/index.js:1220)–[1231](/home/ghost/haksterAi/server/src/index.js:1231). |
| **3. Archived purchased price is skipped on subscription updates** | **Confirmed as a code path.** Price lookup checks the refreshed active-price catalog and the static catalog. If neither contains the archived price, `planId` is null and the update handler skips both the user-plan update and subscription status/period update. Whether the named price is currently archived and whether this customer is affected needs a live Stripe check. | [server/src/index.js:824](/home/ghost/haksterAi/server/src/index.js:824)–[839](/home/ghost/haksterAi/server/src/index.js:839), [server/src/index.js:1407](/home/ghost/haksterAi/server/src/index.js:1407)–[1448](/home/ghost/haksterAi/server/src/index.js:1448). |
| **4. Storefront says $3.45 after a $3 purchase** | **Confirmed in the fallback catalog; live storefront price needs a live Stripe check.** Lite’s static amount is 345 cents. The dynamic catalog can add active prices, and I cannot verify which prices the running Stripe account currently returns. | [server/src/index.js:395](/home/ghost/haksterAi/server/src/index.js:395)–[409](/home/ghost/haksterAi/server/src/index.js:409), [server/src/index.js:874](/home/ghost/haksterAi/server/src/index.js:874)–[910](/home/ghost/haksterAi/server/src/index.js:910). |

## Pass B — additional findings

Ranked by severity:

### 1. Critical — any authenticated user can grant themselves a paid plan

**File:** [server/src/index.js:7981](/home/ghost/haksterAi/server/src/index.js:7981)–[7994](/home/ghost/haksterAi/server/src/index.js:7994)

`POST /api/subscription` accepts a caller-supplied `plan` and writes it directly to both `subscriptions` and `users`, without checking Stripe or a completed payment. The usage gate treats paid plan IDs as unlimited ([server/src/index.js:1819](/home/ghost/haksterAi/server/src/index.js:1819)–[1829](/home/ghost/haksterAi/server/src/index.js:1829)).

**Scenario:** A user with a valid API key posts `{"plan":"pro"}` and receives the plan’s unlimited usage without paying.

**Smallest safe fix:** Remove client ability to write subscription or plan state through this route. If compatibility requires keeping it, make it owner-only and validate any state change against Stripe server-side.

### 2. High — users can forge completed payment receipts and inflate the ledger

**File:** [server/src/index.js:7960](/home/ghost/haksterAi/server/src/index.js:7960)–[7969](/home/ghost/haksterAi/server/src/index.js:7969)

`POST /api/receipts` lets any authenticated user create a `completed` payment row with arbitrary amount, currency, plan, and provider ID. This does not itself grant a plan, but it can create false receipts and inflate admin payment and revenue totals.

**Scenario:** A user submits a large amount and a paid plan; the fake row appears in their receipts and may be included in admin totals.

**Smallest safe fix:** Make receipt creation server-internal/webhook-only. If manual entries are needed, restrict them to the owner and label them distinctly.

### 3. High — expired or delinquent subscriptions can retain paid access

**Files:** [server/src/index.js:1483](/home/ghost/haksterAi/server/src/index.js:1483)–[1495](/home/ghost/haksterAi/server/src/index.js:1495), [server/src/index.js:9124](/home/ghost/haksterAi/server/src/index.js:9124)–[9177](/home/ghost/haksterAi/server/src/index.js:9177)

A failed invoice changes subscription status to `past_due` but leaves `users.plan` unchanged. Usage enforcement checks the plan, not subscription status or `current_period_end`. If Stripe keeps retrying, or a terminal cancellation/deletion event is missed, paid access can continue.

**Scenario:** Renewal payment fails; the account stays on an unlimited plan while retries continue, and could remain there indefinitely if the final state event is missed.

**Smallest safe fix:** Define the intended grace period, then enforce it using subscription status and period end at the access/usage gate, with renewal success restoring access.

### 4. Medium — Stripe checkout session creation has no idempotency key

**Files:** [server/src/index.js:8249](/home/ghost/haksterAi/server/src/index.js:8249)–[8267](/home/ghost/haksterAi/server/src/index.js:8267), [server/src/index.js:8304](/home/ghost/haksterAi/server/src/index.js:8304)–[8325](/home/ghost/haksterAi/server/src/index.js:8325), [server/src/index.js:8350](/home/ghost/haksterAi/server/src/index.js:8350)–[8366](/home/ghost/haksterAi/server/src/index.js:8366)

Session creation has no idempotency key. The random `integration_identifier` is not an idempotency key.

**Scenario:** A double-click or retried request creates multiple Checkout Sessions; the customer can complete both and receive duplicate subscriptions/charges.

**Smallest safe fix:** Accept a client-generated checkout request ID and pass a stable Stripe idempotency key to each `sessions.create` call.

### 5. Medium — the web checkout origin is taken from the request without validation

**File:** [server/src/index.js:8243](/home/ghost/haksterAi/server/src/index.js:8243)–[8261](/home/ghost/haksterAi/server/src/index.js:8261)

The return path is constrained, but `Origin` is used directly to build Stripe’s `success_url` and `cancel_url`.

**Scenario:** A checkout initiated through an untrusted origin can return the buyer to that origin after paying, enabling a misleading post-payment page.

**Smallest safe fix:** Build return URLs from a fixed configured site origin or allowlist validated against known HaksterAI origins.

### 6. Medium — non-USD Stripe prices can be displayed as USD

**Files:** [server/src/index.js:857](/home/ghost/haksterAi/server/src/index.js:857)–[872](/home/ghost/haksterAi/server/src/index.js:872), [src/pages/plans.astro:59](/home/ghost/haksterAi/src/pages/plans.astro:59)–[63](/home/ghost/haksterAi/src/pages/plans.astro:63), [src/pages/plans.astro:184](/home/ghost/haksterAi/src/pages/plans.astro:184)–[187](/home/ghost/haksterAi/src/pages/plans.astro:187)

The server exposes each Stripe price’s currency, and the catalog accepts active recurring prices in any currency. The plan page formats amounts with `$` and does not read `currency`. Its copy also says all prices are USD.

**Scenario:** An active price in another currency is added to a product; checkout charges that currency while the page labels the amount with a dollar sign.

**Smallest safe fix:** Filter catalog prices to USD, or format the displayed amount from the returned currency and update the page copy.

### 7. Low — asynchronous checkout failures are not handled or logged

**Files:** [server/src/index.js:1237](/home/ghost/haksterAi/server/src/index.js:1237)–[1255](/home/ghost/haksterAi/server/src/index.js:1255), [server/src/index.js:1580](/home/ghost/haksterAi/server/src/index.js:1580)–[1583](/home/ghost/haksterAi/server/src/index.js:1583)

The handler recognizes `checkout.session.async_payment_succeeded`, but not `checkout.session.async_payment_failed`; the default branch acknowledges unsupported event types without recording them.

**Scenario:** A delayed payment fails after Checkout Session completion. No plan is granted, but the event is also absent from the webhook log, making reconciliation harder.

**Smallest safe fix:** Handle the async failure event and record its session and outcome in the Stripe event log.

## Needs live Stripe check

- Confirm the number and status of webhook endpoints and which signing secret each endpoint uses.
- Check whether the referenced price is archived and whether the affected subscription emits an update for it.
- Confirm the active Lite prices and customer-facing amount from the live Stripe catalog.
- Review Stripe’s live invoice/subscription state for any delinquent subscriptions whose local plans remain paid.