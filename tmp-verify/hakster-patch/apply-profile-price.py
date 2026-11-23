import io, os, datetime, sys

PATH = "/home/ghost/haksterAi/src/pages/build.astro"
STAMP = datetime.datetime.now(datetime.UTC).strftime("%Y%m%dT%H%M%SZ")

HELPER = """    // The account chip shows the plan the buyer is actually on, with the price
    // checkout charges for it (e.g. "lite · $3.45/mo"). Prices come from the
    // live catalog, so a price change never leaves a stale number in the
    // profile, and a plan flip shows its new price straight away.
    let planCatalogCache: any[] | null = null;
    async function planChipLabel(planId: any): Promise<string> {
      const id = String(planId || 'free').toLowerCase();
      if (!id || id === 'free') return 'free';
      try {
        if (!planCatalogCache) {
          const res = await fetch(`${API}/api/pricing`, { cache: 'no-store' });
          const data = await res.json();
          planCatalogCache = Array.isArray(data.plans) ? data.plans : null;
        }
        const plan = (planCatalogCache || []).find((p: any) => String(p.id).toLowerCase() === id);
        const prices = (plan && plan.prices) || [];
        const price = prices.find((p: any) => Number(p.amount) > 0 && p.billingCycle === 'monthly')
          || prices.find((p: any) => Number(p.amount) > 0);
        if (price) {
          const cycle = price.billingCycle === 'yearly' ? 'yr' : 'mo';
          return `${id} · $${(Number(price.amount) / 100).toFixed(2)}/${cycle}`;
        }
      } catch {}
      return id;
    }

    function showGoogleUserBadge(user: any) {"""

pairs = [
    ("    function showGoogleUserBadge(user: any) {", HELPER, 1),
    (
        "        if (accountPlan) accountPlan.textContent = user.plan || 'free';",
        "        if (accountPlan) planChipLabel(user.plan).then((label) => { accountPlan.textContent = label; });",
        1,
    ),
    (
        """              const accountPlan = document.getElementById('sidebar-account-plan') as HTMLSpanElement | null;
              if (accountPlan) accountPlan.textContent = data.user.plan || 'free';""",
        """              const accountPlan = document.getElementById('sidebar-account-plan') as HTMLSpanElement | null;
              planCatalogCache = null;
              if (accountPlan) planChipLabel(data.user.plan).then((label) => { accountPlan.textContent = label; });""",
        1,
    ),
]

text = io.open(PATH, encoding="utf-8").read()
original = text
for old, new, count in pairs:
    got = text.count(old)
    if got != count:
        print("MISS: expected %d, found %d -> %r" % (count, got, old[:80]))
        sys.exit(1)
    text = text.replace(old, new)

backup = PATH + ".bak-profile-price-" + STAMP
io.open(backup, "w", encoding="utf-8").write(original)
io.open(PATH, "w", encoding="utf-8").write(text)
print("PATCHED", PATH, "backup", backup)
