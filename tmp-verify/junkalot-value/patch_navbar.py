#!/usr/bin/env python3
"""Junkalot: owner-only "Value" link in the admin nav (desktop + mobile)."""
import datetime, io, sys

NAV = "/home/ghost694/junkalot/src/components/Navbar.tsx"
STAMP = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")

A_OLD = "  const visibleLinks = links.filter(link => link.href !== '/ads' || Boolean(isAdmin))\n"
A_NEW = ("  // Owner-only (2026-11-21): the client value record is for our eyes only, so the\n"
         "  // link renders for the owner email alone; the page itself refuses everyone else.\n"
         "  const isOwner = String(session?.user?.email || '').toLowerCase() === 'dekekenneth840@gmail.com'\n"
         + A_OLD)

DESK_OLD = "              Updates\n              <UpdatesBadge />\n            </Link>\n          )}\n        </div>\n"
DESK_NEW = ("              Updates\n              <UpdatesBadge />\n            </Link>\n          )}\n"
            "          {isOwner && (\n"
            "            <Link href=\"/admin/value\" className=\"text-brand-gold hover:text-yellow-300 transition-colors text-sm font-medium flex items-center gap-1\" title=\"Owner only — client value vs the monthly plan (internal record)\">\n"
            "              <svg className=\"w-3.5 h-3.5\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" strokeWidth={2}><path strokeLinecap=\"round\" strokeLinejoin=\"round\" d=\"M12 3v18m4-14.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5 1.8 2.5 4 2.5 4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5\" /></svg>\n"
            "              Value\n"
            "            </Link>\n"
            "          )}\n"
            "        </div>\n")

MOB_OLD = "                Updates\n                <UpdatesBadge />\n              </Link>\n            )}\n          </div>\n"
MOB_NEW = ("                Updates\n                <UpdatesBadge />\n              </Link>\n            )}\n"
           "            {isOwner && (\n"
           "              <Link href=\"/admin/value\" onClick={() => setOpen(false)} className=\"inline-flex text-brand-gold hover:text-yellow-300 text-sm items-center gap-1 px-4 py-2\" title=\"Owner only — client value vs the monthly plan (internal record)\">\n"
           "                <svg className=\"w-3.5 h-3.5\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\" strokeWidth={2}><path strokeLinecap=\"round\" strokeLinejoin=\"round\" d=\"M12 3v18m4-14.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5 1.8 2.5 4 2.5 4 1.1 4 2.5-1.8 2.5-4 2.5-4-1.1-4-2.5\" /></svg>\n"
           "                Value\n"
           "              </Link>\n"
           "            )}\n"
           "          </div>\n")

text = io.open(NAV, encoding="utf-8").read()
for old, new, label in ((A_OLD, A_NEW, "isOwner const"), (DESK_OLD, DESK_NEW, "desktop link"), (MOB_OLD, MOB_NEW, "mobile link")):
    n = text.count(old)
    if n != 1:
        print("ABORT: %s anchor found %d times" % (label, n)); sys.exit(1)
    text = text.replace(old, new)

backup = NAV + ".bak-value-" + STAMP
io.open(backup, "w", encoding="utf-8").write(io.open(NAV, encoding="utf-8").read())
io.open(NAV, "w", encoding="utf-8").write(text)
print("PATCHED", NAV)
print("BACKUP ", backup)
after = io.open(NAV, encoding="utf-8").read()
print("CHECK isOwner", after.count("isOwner"), "| /admin/value", after.count("/admin/value"))
