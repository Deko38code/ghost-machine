
## 12:29 UTC — Mr Ed terminal theme, and 11 GB of disk freed

Builds: `FMhzvlP2irIGKQCYHMdHb` (Mr Ed terminal theme), `ZSIBaZutlek2y6xvMMY0z` (build retention).

Mr Ed (owner: "the mr ed term color picker theme selector", then "Both"):

- **One theme preference for every Mr Ed surface.** `src/components/mredTheme.tsx` holds the
  preference (`junkalot:mred-theme`, `junkalot:mred-tint`) and the one picker. Options: match the
  admin theme (default), light, dark, and a custom colour. Display only — nothing is written to
  the account or the server.
- **The full-window terminal repaints from the choice.** The transcript draws every line from
  `--coach-sys / prompt / user / cmd / out / err / id` variables, so choosing light switches the
  background to `#f7f6f2` and the text to dark instead of leaving green-on-black unreadable.
- **A custom colour derives its own text colours** from that colour's luminance, so a pale pick
  gets dark text and a deep pick gets light text, not the other way round.

Disk (owner: "need to find some space to make safely"):

- **217 staged builds retired, 11 GB back.** Free space on `/` went 45 GB → 56 GB, use 80 % → 76 %.
  The 242 `.next-junkalot-*` generations had accumulated in six days. Kept: the served build plus
  the newest seven. Before removing anything: the live `distDir` was excluded, 0 open file handles
  and 0 PM2 references were found under any `.next`, and no candidate was a symlink.
- **The pipeline now does this itself.** `scripts/build-retention.mjs` keeps the newest 8 and
  retires the rest, but only after a new build is verified **and answering**. It never touches the
  served build, never follows a symlink, refuses anything not named `.next-junkalot-*`, refuses to
  run outside the project root, and appends every removal to `data/build-retention.jsonl` (218
  records). A build that does not answer prunes nothing.

Not touched: `backups/` (7.7 GB, Class C), the 17 symlinked October builds that live on the SSD,
`/mnt/parrot-work-ssd` itself (3.1 GB free — still needs its own review), and all git history.

Not measured: the Mr Ed panel and terminal at 360×640 / 390×844 / 414×896 / 1440×900 / 1920×1080
remain unverified — the admin is auth-gated and no headless measurement was taken.
