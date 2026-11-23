import io, os, shutil, datetime, sys, re

PATH = "/home/ghost/haksterAi/server/.env"
STAMP = datetime.datetime.now(datetime.UTC).strftime("%Y%m%dT%H%M%SZ")
BACKUP = PATH + ".bak-fee-prices-" + STAMP

PRICE_IDS = {
    "STRIPE_PRICE_STARTER_MONTHLY":    ("price_1TznPtA0UrVsJMzeEZMlhnP8", "price_1UdxxOA0UrVsJMzemL7p2cLr"),
    "STRIPE_PRICE_PRO_MONTHLY":        ("price_1TznPtA0UrVsJMze9N3NdSPY", "price_1UdxxPA0UrVsJMzeVYrbLf7M"),
    "STRIPE_PRICE_PRO_YEARLY":         ("price_1TznPuA0UrVsJMzeOIyJB1jQ", "price_1UdxxQA0UrVsJMzecww56Fzj"),
    "STRIPE_PRICE_ENTERPRISE_MONTHLY": ("price_1TznPuA0UrVsJMzesVMSUO0B", "price_1UdxxQA0UrVsJMzeJ5tSsm9m"),
    "STRIPE_PRICE_ENTERPRISE_YEARLY":  ("price_1TznPvA0UrVsJMze2cZl5vp8", "price_1UdxxRA0UrVsJMzeb1SfxBGS"),
}
CENTS = {
    "PRICE_STARTER_MONTHLY_CENTS":    ("999", "1044"),
    "PRICE_PRO_MONTHLY_CENTS":        ("2999", "3044"),
    "PRICE_PRO_YEARLY_CENTS":         ("29999", "30044"),
    "PRICE_ENTERPRISE_MONTHLY_CENTS": ("9999", "10044"),
    "PRICE_ENTERPRISE_YEARLY_CENTS":  ("99999", "100044"),
}

text = io.open(PATH, encoding="utf-8").read()
problems = []
for key, (old, new) in list(PRICE_IDS.items()) + list(CENTS.items()):
    m = re.search(r'^' + key + r'=(.*)$', text, re.M)
    if not m:
        problems.append("%s: missing" % key)
    elif m.group(1).strip().strip('"') != old:
        problems.append("%s: current value is not the expected old one" % key)

if problems:
    print("NOT APPLIED — review needed:")
    for p in problems:
        print(" -", p)
    sys.exit(1)

shutil.copy2(PATH, BACKUP)
for key, (old, new) in list(PRICE_IDS.items()) + list(CENTS.items()):
    text = re.sub(r'^' + key + r'=.*$', key + '=' + new, text, flags=re.M)
io.open(PATH, "w", encoding="utf-8").write(text)
print("updated 10 keys; backup:", BACKUP)
print("mode still:", oct(os.stat(PATH).st_mode & 0o777))
