import io, os, hashlib, datetime, sys

ROOT = "/home/ghost/haksterAi"
STAMP = datetime.datetime.now(datetime.UTC).strftime("%Y%m%dT%H%M%SZ")

patches = {
    "server/src/index.js": [
        # Lite: $3.00 -> $3.45 (new Stripe price, old one archived)
        ("        amount: 300,\n        currency: 'usd',\n        lookupKey: 'haksterai_lite_monthly',\n"
         "        stripePriceId: process.env.STRIPE_PRICE_LITE_MONTHLY || 'price_1UcC82A0UrVsJMzeA3czYM9b',",
         "        amount: 345,\n        currency: 'usd',\n        lookupKey: 'haksterai_lite_monthly',\n"
         "        stripePriceId: process.env.STRIPE_PRICE_LITE_MONTHLY || 'price_1UdxxOA0UrVsJMzeKh22sWDy',",
         1),
        # Starter default cents
        ("amount: parseInt(process.env.PRICE_STARTER_MONTHLY_CENTS || '999', 10),",
         "amount: parseInt(process.env.PRICE_STARTER_MONTHLY_CENTS || '1044', 10),",
         1),
        # Starter Plus copy + amounts
        ("    // Intro offer: $5.99 for the first month, then $10.99/month. The intro\n"
         "    // month is a real Stripe coupon ($5 off, duration \"once\") applied at\n"
         "    // checkout — never a separate price, so the invoice stays truthful.",
         "    // Intro offer: $6.44 for the first month, then $11.44/month. The intro\n"
         "    // month is a real Stripe coupon ($5 off, duration \"once\") applied at\n"
         "    // checkout — never a separate price, so the invoice stays truthful.\n"
         "    // Every paid price carries the $0.45 card-processing fee (owner 2026-11-21).",
         1),
        ("    description: 'Monthly: $5.99 for the first month, then $10.99/month. Annual plan: $109.99/year.',\n"
         "    features: ['Everything in Starter', '$5.99 first month', 'Then $10.99/month', 'Cancel anytime'],",
         "    description: 'Monthly: $6.44 for the first month, then $11.44/month. Annual plan: $110.44/year.',\n"
         "    features: ['Everything in Starter', '$6.44 first month', 'Then $11.44/month', 'Cancel anytime'],",
         1),
        ("        amount: 1099,\n        currency: 'usd',\n        lookupKey: 'haksterai_starter_plus_monthly',\n"
         "        stripePriceId: process.env.STRIPE_PRICE_STARTER_PLUS_MONTHLY || 'price_1UcBMQA0UrVsJMze36ws1SJe',",
         "        amount: 1144,\n        currency: 'usd',\n        lookupKey: 'haksterai_starter_plus_monthly',\n"
         "        stripePriceId: process.env.STRIPE_PRICE_STARTER_PLUS_MONTHLY || 'price_1UdxxPA0UrVsJMze3cRPHBpN',",
         1),
        ("        introAmount: 599,\n        introLabel: 'First month $5.99, then $10.99/mo',",
         "        introAmount: 644,\n        introLabel: 'First month $6.44, then $11.44/mo',",
         1),
        ("        amount: 10999,\n        currency: 'usd',\n        lookupKey: 'haksterai_starter_plus_yearly',\n"
         "        stripePriceId: process.env.STRIPE_PRICE_STARTER_PLUS_YEARLY || 'price_1UcBMQA0UrVsJMze38QbSofy',",
         "        amount: 11044,\n        currency: 'usd',\n        lookupKey: 'haksterai_starter_plus_yearly',\n"
         "        stripePriceId: process.env.STRIPE_PRICE_STARTER_PLUS_YEARLY || 'price_1UdxxPA0UrVsJMzeygh4cJcZ',",
         1),
        # Pro defaults
        ("amount: parseInt(process.env.PRICE_PRO_MONTHLY_CENTS || '2999', 10),",
         "amount: parseInt(process.env.PRICE_PRO_MONTHLY_CENTS || '3044', 10),", 1),
        ("amount: parseInt(process.env.PRICE_PRO_YEARLY_CENTS || '29999', 10),",
         "amount: parseInt(process.env.PRICE_PRO_YEARLY_CENTS || '30044', 10),", 1),
        # Enterprise defaults
        ("amount: parseInt(process.env.PRICE_ENTERPRISE_MONTHLY_CENTS || '9999', 10),",
         "amount: parseInt(process.env.PRICE_ENTERPRISE_MONTHLY_CENTS || '10044', 10),", 1),
        ("amount: parseInt(process.env.PRICE_ENTERPRISE_YEARLY_CENTS || '99999', 10),",
         "amount: parseInt(process.env.PRICE_ENTERPRISE_YEARLY_CENTS || '100044', 10),", 1),
        # Comments that quote the intro price
        ("// coupon must not silently charge full price on a plan we advertise at $5.99.",
         "// coupon must not silently charge full price on a plan we advertise at $6.44.", 1),
        ("    // Starter Plus advertises $5.99 for the first month. Apply the real coupon",
         "    // Starter Plus advertises $6.44 for the first month. Apply the real coupon", 1),
    ],
    "src/pages/dashboard.astro": [
        ('<option value="starter">Starter ($9.99)</option>',
         '<option value="starter">Starter ($10.44)</option>', 1),
        ('<option value="pro">Pro ($29.99)</option>',
         '<option value="pro">Pro ($30.44)</option>', 1),
        ('<option value="enterprise">Enterprise ($99.99)</option>',
         '<option value="enterprise">Enterprise ($100.44)</option>', 1),
    ],
}

for rel, pairs in patches.items():
    path = os.path.join(ROOT, rel)
    text = io.open(path, encoding="utf-8").read()
    original = text
    for old, new, count in pairs:
        got = text.count(old)
        if got != count:
            print("MISS %s: expected %d, found %d -> %r" % (rel, count, got, old[:110]))
            sys.exit(1)
        text = text.replace(old, new)
    backup = path + ".bak-fee-prices-" + STAMP
    io.open(backup, "w", encoding="utf-8").write(original)
    io.open(path, "w", encoding="utf-8").write(text)
    print("PATCHED", rel, "backup", backup)
print("OK")
