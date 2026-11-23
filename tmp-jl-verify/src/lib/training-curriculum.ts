// Shared lesson and badge catalog for the owner coach and admin progress view.
// Bump COURSE_VERSION whenever the curriculum, proof standards, or count changes.
export const COURSE_VERSION = "2026.11.20"

// The Cloudflare/DNS lesson is the last one. It opens at level 20 once the account is
// paid up, and is written off only when the balance is paid in full.
export const LAST_LEVEL_BADGE = 'tunnel-master'
export const LAST_LEVEL = 20

// A questionnaire only passes at this score or better.
export const QUIZ_PASS_PERCENT = 80

// Appended to src/lib/training-curriculum.ts. Owner (2026-11-20): "if she gets to 20 then
// more lessons appear and keep showing till paid off — we just keep adding 10 lessons at a
// time and archiving old for new when done with 20 but logs, badges, levels etc stay."
//
// Tier 1 is the original 20. Tiers below are 10 levels each and are revealed only after the
// previous tier is fully coach-verified. Nothing is ever removed: every badge, level and
// date stays on record; only the grid view moves old levels into "archived".

export const NEXT_TIER_SIZE = 10

export const COURSE_EXTRA_TIERS: {
  id: string
  title: string
  badges: Record<string, { emoji: string; name: string; objective: string }>
  lessons: string[]
}[] = [
  {
    id: 'tier-2',
    title: 'Advanced operations',
    badges: {
      'edge-cache': { emoji: '🌐', name: 'Edge Cache — why a change can look missing', objective: 'Explain caching at the edge and origin, and clear a stale page without touching the tunnel.' },
      'backup-drill': { emoji: '💾', name: 'Backup Drill — restore proven, not assumed', objective: 'List what a backup must contain and describe a restore test performed in an isolated place.' },
      'incident-first': { emoji: '🚨', name: 'Incident First Five — triage before action', objective: 'Run a five-minute triage: symptoms, scope, last known good, what must not be touched.' },
      'invoice-math': { emoji: '🧮', name: 'Invoice Math — balances, payments, payoff', objective: 'Recalculate a payoff month from confirmed balance and payments; show the arithmetic.' },
      'local-search': { emoji: '📍', name: 'Local Search — Google Business Profile care', objective: 'Keep hours, services and photos accurate and explain what actually moves local ranking.' },
      'analytics-honest': { emoji: '📉', name: 'Analytics, Honestly — no inflated numbers', objective: 'Read real visitor and booking counts, name the period, and refuse to present estimates as facts.' },
      'a11y-screens': { emoji: '🔎', name: 'Small Screens & TV — readable everywhere', objective: 'Check a page at phone and TV sizes and name what breaks first.' },
      'ai-limits': { emoji: '🤖', name: 'AI Limits — what the tools may not do', objective: 'State what an AI assistant may decide, what needs a human, and why recorded usage is not a bill.' },
      'hard-talk': { emoji: '✉️', name: 'Hard Conversations — complaints in writing', objective: 'Answer a complaint in writing: acknowledge, state facts, offer one clear next step.' },
      'runbook': { emoji: '📘', name: 'Runbook — the handover pack', objective: 'Produce a runbook that lets another person restart, verify and roll back without guessing.' },
    },
    lessons: [
      'Edge and browser caching — what sits between her edit and the customer, and how to prove a change is live',
      'Backups that restore — what has to be inside a backup and how to test one safely before trusting it',
      'The first five minutes of an incident — triage, scope, and the things that must not be touched',
      'Invoice arithmetic — balances, payments, payoff dates, and showing the working',
      'Local search — Google Business Profile, reviews, and truthful local presence',
      'Analytics without inflation — real counts, named periods, and honest labels',
      'Accessible layouts — phone widths, sofa distance, touch targets, and no hover-only actions',
      'AI boundaries — what assistants may decide, what needs a human, and why usage records are not bills',
      'Difficult customers — written replies that de-escalate and keep the record straight',
      'The runbook — a handover a stranger could follow to restart, verify and roll back',
    ],
  },
  {
    id: 'tier-3',
    title: 'Owner-level systems',
    badges: {
      'cost-model': { emoji: '📊', name: 'Cost Model — she owns the numbers', objective: 'Build a simple monthly cost model from real bills and explain each line.' },
      'scope-contract': { emoji: '📝', name: 'Scope & Agreement — written before work', objective: 'Write a scope that fixes what is included, what is not, and how changes are priced.' },
      'delegation': { emoji: '🤝', name: 'Delegation — hiring without losing control', objective: 'Describe what can be handed over safely and what must stay with the owner.' },
      'vendor-check': { emoji: '🧾', name: 'Vendor Check — insurance and liability', objective: 'Verify a subcontractor before work: coverage, references, written terms.' },
      'fleet-log': { emoji: '🚚', name: 'Fleet Log — the truck is a cost line', objective: 'Keep a maintenance and fuel record and read cost per job from it.' },
      'route-econ': { emoji: '🗺️', name: 'Route Economics — miles against margin', objective: 'Compare two routes by real miles, time and fuel before accepting a job.' },
      'honest-promo': { emoji: '🏷️', name: 'Honest Promotions — discounts that stay true', objective: 'Design a promotion that is a real offer on a real price, with an end date.' },
      'privacy-rules': { emoji: '🔐', name: 'Customer Privacy — the rules that matter', objective: 'State who may see a customer record, what may never be shared, and what to do after a mistake.' },
      'growth-loop': { emoji: '🔁', name: 'Growth Loop — referrals and reviews', objective: 'Run a referral and review loop that asks once, tracks honestly, and never pressures.' },
      'capstone': { emoji: '🏁', name: 'Capstone — a solo week', objective: 'Run one week of bookings, comms and records solo while the developer backup stays warm.' },
    },
    lessons: [
      'Cost model — every monthly bill and what it buys her',
      'Scope and written agreements — inclusions, exclusions, and change pricing',
      'Delegation — what to hand over, what stays with the owner, and how to check the work',
      'Vendors and subcontractors — insurance, references and written terms before any job',
      'Fleet economics — maintenance, fuel and cost per job from real records',
      'Route economics — miles, time and fuel compared before accepting',
      'Honest promotions — real prices, real end dates, no invented savings',
      'Customer privacy — access, sharing limits, and the recovery steps after a mistake',
      'Growth loop — referrals and reviews asked once, tracked honestly',
      'Capstone — one solo week with the developer backup kept warm',
    ],
  },
]


export const COURSE_BADGES: Record<string, { emoji: string; name: string; objective: string }> = {
  "first-contact": { emoji: "🎓", name: "First Contact — opened deke's AI Training Course", objective: "Complete the first guided session and choose a next learning step." },
  "site-tour": { emoji: "🗺️", name: "Site Tour — knows every page & feature", objective: "Explain the site's main customer pages and what each does for the business." },
  "booking-flow": { emoji: "📞", name: "Booking Flow — from customer click to cash", objective: "Explain how a booking reaches the owners and is followed through to completion." },
  "deploy-ready": { emoji: "🛠️", name: "Deploy Ready — edit → build → restart → verify", objective: "Explain the safe edit, complete build, restart, and verification workflow." },
  "own-machine": { emoji: "💻", name: "Own Machine — the site runs on her computer", objective: "Demonstrate a local copy and distinguish it from the live production site." },
  "graduation-ready": { emoji: "🚀", name: "Graduation Ready — proven on her own hardware", objective: "Demonstrate the handover skills on her own hardware; keep the developer's live backup until verified." },
  "security-guard": { emoji: "🛡️", name: "Security Guard — events, blocks & audits", objective: "Read a security event and explain a safe response using the Security Center." },
  "growth-hacker": { emoji: "📈", name: "Growth Hacker — the owner's playbook in action", objective: "Choose a truthful, measurable business-growth action and explain how to assess it." },
  "glossary-gold": { emoji: "🧠", name: "Glossary Gold — speaks the language like a dev", objective: "Explain key site and hosting terms in her own words." },
  "hosting-steward": { emoji: "🧾", name: "Hosting Steward — understands cost and labor", objective: "Separate recurring service fees from fixed project charges; explain scope/difficulty pricing and verify invoices, payoff balances, payment counts, and dates before quoting." },
  "customer-intake": { emoji: "📝", name: "Customer Intake — follows the website request", objective: "Explain what the booking and contact forms collect, where requests arrive, and how to confirm the details before setting expectations." },
  "estimate-ready": { emoji: "💲", name: "Estimate Ready — quotes from verified facts", objective: "Use owner-approved hourly or fixed-job prices based on verified scope and difficulty; never invent rates, fees, payoff terms, or availability." },
  "schedule-steady": { emoji: "🗓️", name: "Schedule Steady — confirms the plan", objective: "Explain how to confirm a booking, arrival window, contact details, and any schedule change with the customer." },
  "server-watch": { emoji: "🖥️", name: "Server Watch — checks health before action", objective: "Read service status and logs, check the required site endpoints, and explain how to verify a safe restart." },
  "jobsite-safety": { emoji: "🦺", name: "Jobsite Safety — spots work that needs care", objective: "Recognize heavy, sharp, chemical, or restricted materials, pause for the approved safe plan, and verify disposal acceptance before hauling." },
  "data-keeper": { emoji: "🗄️", name: "Data Keeper — safeguards customer records", objective: "Explain who may access booking records, where verified backups are kept, and why a timestamped backup is needed before schema changes." },
  "photo-steward": { emoji: "📷", name: "Photo Steward — protects customer privacy", objective: "Get permission before taking or sharing job photos and avoid exposing faces, addresses, documents, or valuables." },
  "follow-up-pro": { emoji: "💬", name: "Follow-up Pro — closes the customer loop", objective: "Describe a clear completion check, issue follow-up, and respectful request for feedback or a review." },
  "metrics-keeper": { emoji: "📊", name: "Metrics Keeper — reads honest results", objective: "Track real inquiries and completed bookings, calculate a simple conversion rate, and label estimates as estimates." },
  "tunnel-master": { emoji: "☁️", name: "Tunnel Master — Cloudflare, DNS & no open doors", objective: "Explain DNS and the tunnel without exposing credentials or opening unsafe ports." },
}

export const COURSE_LESSONS = [
  "Site tour — what every page and feature does for the business",
  "Bookings flow — how a job goes from customer click to completed",
  "Build and deploy routine — edit, complete build, restart, verify",
  "Her own copy — Node.js, Git, GitHub, npm, and safe local practice",
  "Graduation path — practice hosting on her hardware while the live backup stays warm",
  "Security Center — events, IP blocking, and AI audits",
  "Business growth — portfolio, reviews, Google Business Profile, seasonal pushes",
  "Glossary — DNS, tunnel, port, systemd, Git, build, and deploy",
  "Hosting economics — recurring infrastructure, project labor, ongoing maintenance, and what must be verified before quoting cost",
  "AI command-line tools — what they do and how to use them safely",
  "Website forms and customer intake — follow a request from booking/contact submission to the owner inbox and confirm the details",
  "Estimates — confirm scope and approved pricing; never make up a quote or fee",
  "Invoice and payoff math — distinguish fixed scope pricing from hourly work, recalculate monthly payoff terms from confirmed balances/payments, and show the updated payoff month",
  "Scheduling — booking status, arrival windows, customer confirmations, and changes",
  "Server health — check service state, logs, site endpoints, and restart verification",
  "Jobsite safety — recognize heavy, sharp, chemical, and restricted-material concerns",
  "Database and backups — protect booking records and verify a timestamped save point before schema changes",
  "Before-and-after photos — ask permission and protect private customer details",
  "Customer follow-up — confirm completion, resolve issues, and request feedback respectfully",
  "Business metrics — measure inquiries, completed jobs, and conversion without inflated claims",
  "Cloudflare, DNS, and tunnels — how the site is reached safely",
] as const

// Appended to src/lib/training-curriculum.ts.
// Owner (2026-11-20): "can add more lessons about dns servers just to learn and maybe a few
// questionaires etc" · "after some good lessons".
//
// DNS lessons are reading-only: always open, never part of the pass gate. Questionnaires are
// checkpoints that appear after a set of lessons ("after some good lessons") and are scored
// on the page itself — nothing is sent anywhere and no pass is recorded unless a coach
// verifies it.

export type DnsLesson = {
  id: string
  title: string
  body: string[]
  check: { q: string; options: string[]; answer: number; why: string }
}

export const DNS_LESSONS: DnsLesson[] = [
  {
    id: 'dns-what',
    title: 'DNS — the internet’s phone book',
    body: [
      'Every server has a number (an IP address). People remember names. DNS is the system that turns a name like junkalot.co into the number the browser dials.',
      'Your browser asks a resolver, which walks down from the root servers to the .co servers, to the nameservers listed for the domain, and gets an answer back.',
      'The answer is cached for a while so the second lookup is instant. That cache is also why a change can take time to appear — the old answer is still held somewhere.',
    ],
    check: {
      q: 'What does an A record point to?',
      options: ['An IPv4 address', 'A website name', 'An email server', 'A password'],
      answer: 0,
      why: 'An A record maps a name to an IPv4 address. AAAA does the same for IPv6.',
    },
  },
  {
    id: 'dns-records',
    title: 'The record types worth knowing',
    body: [
      'A — name to IPv4. AAAA — name to IPv6. CNAME — name to another name. MX — where email is delivered. TXT — free text, used for verification and security records.',
      'A CNAME pointing at something you do not control is a dependency: whoever owns the target can change where your name goes.',
      'TXT is not private. Anyone can read your TXT records, so verification strings and security records are fine there — secrets never are.',
    ],
    check: {
      q: 'Where should a secret value never go?',
      options: ['A TXT record', 'A private file on the server', 'An encrypted backup', 'A password manager'],
      answer: 0,
      why: 'TXT records are public and readable by anyone. Secrets belong only in protected files or a password manager.',
    },
  },
  {
    id: 'dns-nameservers',
    title: 'Registrar, nameservers and delegation',
    body: [
      'The registrar is where the domain is bought. The nameservers are the servers that actually answer for the domain — the registrar simply points at them.',
      'Changing nameservers, or moving them to another provider, is a delegation change. Every record the new nameservers do not already have disappears from the internet’s view.',
      'This is the most common cause of "the site vanished": a delegation change without copying every record first.',
    ],
    check: {
      q: 'What must happen before changing nameservers?',
      options: ['Copy every existing record to the new provider first', 'Restart the tunnel', 'Delete the old zone', 'Wait a week'],
      answer: 0,
      why: 'Only the new nameservers’ records are served. Anything not copied stops resolving.',
    },
  },
  {
    id: 'dns-ttl',
    title: 'TTL — why changes take time',
    body: [
      'Every record carries a TTL: how many seconds a resolver may keep the answer.',
      'A short TTL (300 s) makes changes fast but means more lookups. A long TTL (86400 s) is calm and cheap but a change can take a day to be seen everywhere.',
      'Before a planned change, you lower the TTL, wait out the old value, make the change, then raise it again.',
    ],
    check: {
      q: 'You are about to change an important record tomorrow. What do you do today?',
      options: ['Lower the TTL and wait for the old value to expire', 'Delete the record now', 'Raise the TTL to a day', 'Nothing — TTL has no effect'],
      answer: 0,
      why: 'A low TTL held before the change makes the switch reach everyone quickly.',
    },
  },
  {
    id: 'dns-security',
    title: 'DNS safety — the quiet failures',
    body: [
      'DNSSEC signs answers so a resolver can tell a forged answer from a real one. It prevents one class of attack; it does not hide anything.',
      'A wildcard record sends every unlisted name somewhere. Convenient, and also a way for typos and stale links to land on something you did not plan.',
      'Never publish internal hostnames, database addresses or admin ports in public DNS. Public DNS is a map of everything you consider reachable.',
    ],
    check: {
      q: 'What does DNSSEC actually do?',
      options: ['Signs answers so forged answers can be detected', 'Encrypts the website', 'Hides your records', 'Speeds up lookups'],
      answer: 0,
      why: 'DNSSEC is about authenticity. It does not encrypt traffic and does not hide records.',
    },
  },
  {
    id: 'dns-our-path',
    title: 'How junkalot.co is actually reached',
    body: [
      'The name resolves through Cloudflare. Cloudflare accepts the visitor’s connection, and a tunnel carries it to the server — no inbound port on the server is opened to the internet.',
      'Nothing on the origin is exposed by DNS: the public records describe Cloudflare, not the host. That is the point of the tunnel.',
      'Because of that, DNS, tunnel and origin changes are made one at a time, and only after checking the other two. Changing two at once leaves no way to tell which one broke.',
    ],
    check: {
      q: 'Why does the tunnel matter for safety?',
      options: ['It exposes no inbound port on the origin server', 'It makes the page load faster', 'It hides the HTML source', 'It replaces DNS'],
      answer: 0,
      why: 'The tunnel is an outbound connection, so there is no open door on the server for anyone to find.',
    },
  },
]

export type QuizQuestion = { q: string; options: string[]; answer: number; why: string }

// Questionnaires appear once the lessons they check have been done, not before.
export const CHECKPOINT_QUIZZES: {
  id: string
  afterLevel: number
  title: string
  questions: QuizQuestion[]
}[] = [
  {
    id: 'quiz-5',
    afterLevel: 5,
    title: 'Checkpoint — how the site is reached',
    questions: [
      { q: 'What does DNS resolve?', options: ['A name into an address', 'A password into a key', 'A port into a route', 'A file into a backup'], answer: 0, why: 'DNS turns names people type into the addresses machines dial.' },
      { q: 'A tunnel means the origin has…', options: ['No inbound port open to the internet', 'No firewall at all', 'No DNS records', 'No logs'], answer: 0, why: 'The connection is outbound, so nothing listens publicly on the server.' },
      { q: 'You need to prove a page change reached the live site. You…', options: ['Load the live URL and check the change is there', 'Ask the customer to look', 'Trust the build message alone', 'Reload your local copy'], answer: 0, why: 'A build finishing is not the same as the live site serving it.' },
    ],
  },
  {
    id: 'quiz-10',
    afterLevel: 10,
    title: 'Checkpoint — records, TTL and delegation',
    questions: [
      { q: 'Which record sends every unlisted name somewhere?', options: ['A wildcard record', 'An MX record', 'A CNAME', 'A TXT record'], answer: 0, why: 'A wildcard catches every name that has no specific record.' },
      { q: 'Lowering a TTL before a change…', options: ['Makes the change reach everyone sooner', 'Stops the site working', 'Deletes cached records', 'Encrypts the answer'], answer: 0, why: 'Short TTLs are held for a shorter time, so the new answer spreads quickly.' },
      { q: 'Moving nameservers without copying records…', options: ['Makes those records disappear', 'Keeps them safe for a year', 'Is not possible', 'Only affects email'], answer: 0, why: 'Only the new nameservers are asked; records not copied there stop resolving.' },
    ],
  },
  {
    id: 'quiz-15',
    afterLevel: 15,
    title: 'Checkpoint — safe operations',
    questions: [
      { q: 'Before a risky change, what comes first?', options: ['A verified recovery copy', 'A faster plan', 'A new password', 'A restart'], answer: 0, why: 'Nothing risky starts without a copy that has been proven to restore.' },
      { q: 'A backup is only proven when…', options: ['It has been restored somewhere isolated', 'It exists on disk', 'It is encrypted', 'It is large'], answer: 0, why: 'Existing is not restoring. The test is the proof.' },
      { q: 'A successful command exit means…', options: ['Only that the command ran — the result still needs checking', 'The change is live', 'The backup is good', 'The customer sees it'], answer: 0, why: 'Exit status is not verification.' },
    ],
  },
  {
    id: 'quiz-20',
    afterLevel: 20,
    title: 'Checkpoint — the tunnel, end to end',
    questions: [
      { q: 'DNSSEC protects against…', options: ['Forged DNS answers', 'Slow page loads', 'Weak passwords', 'Missing backups'], answer: 0, why: 'It signs answers so a modified one can be detected.' },
      { q: 'What is never published in public DNS?', options: ['Internal hostnames and admin ports', 'CNAME records', 'MX records', 'TXT verification strings'], answer: 0, why: 'Public DNS is readable by everyone and maps what is reachable.' },
      { q: 'DNS, tunnel and origin changes are made…', options: ['One at a time, checking the other two', 'All together for speed', 'Only at weekends', 'Never'], answer: 0, why: 'One change at a time keeps the cause of a failure findable.' },
    ],
  },
  {
    id: 'quiz-25',
    afterLevel: 25,
    title: 'Checkpoint — numbers people can trust',
    questions: [
      { q: 'An estimate shown to a customer must be…', options: ['Labeled as an estimate', 'Rounded up and called final', 'Removed', 'Replaced with a discount'], answer: 0, why: 'Labeling keeps the number honest.' },
      { q: 'A usage record is…', options: ['Accounting — it never creates a charge by itself', 'A bill', 'A plan change', 'A provider invoice'], answer: 0, why: 'Recording shows what was used; charging is a separate human decision.' },
      { q: 'A payoff month is recalculated from…', options: ['Confirmed balance and confirmed payments', 'Remembered numbers', 'The original contract only', 'Averages'], answer: 0, why: 'Only confirmed figures produce a true payoff date.' },
    ],
  },
  {
    id: 'quiz-30',
    afterLevel: 30,
    title: 'Checkpoint — running it alone',
    questions: [
      { q: 'A runbook must let a stranger…', options: ['Restart, verify and roll back without guessing', 'Rebuild the site from scratch', 'Edit production without approval', 'Skip verification'], answer: 0, why: 'That is the whole purpose of a handover pack.' },
      { q: 'Before handing over, the developer’s backup…', options: ['Stays warm until the handover is verified', 'Is deleted', 'Is moved to the same disk', 'Is ignored'], answer: 0, why: 'The backup is the safety net until her copy is proven.' },
      { q: 'A vendor’s insurance is checked…', options: ['Before any work, in writing', 'After the job', 'Only if asked', 'Never'], answer: 0, why: 'Coverage checked after an accident is worth nothing.' },
    ],
  },
]

// Owner (2026-11-20): "make sure Mr Ed is teaching her how to become a million dollar company —
// advise skills adviser". Ten business-adviser lessons, always open like the DNS reading, each with
// one self-check question. Every figure is arithmetic that can be checked on paper; nothing here
// promises a result, and nothing overrides the FACTUALITY rule in Mr Ed's instructions.
export const BUSINESS_LESSONS: DnsLesson[] = [
  {
    id: 'biz-million-math',
    title: '1. The million-dollar arithmetic',
    body: [
      'A million dollars a year sounds enormous until it is broken into days. One million divided by 250 working days is 4,000 dollars of revenue on every working day.',
      'At a 650 dollar average ticket that is about 1,540 jobs a year, or roughly six jobs a day. That is two trucks running three jobs each, every working day — not one truck working harder.',
      'Write your own three numbers down before anything else: average ticket, jobs per truck-day, working days a year. Any growth plan is just moving one of those three.',
      'This is arithmetic, not a promise. Six jobs a day is a system — dispatch, two crews, a route, and a dump run that does not eat the afternoon. Build the system before expecting the number.',
    ],
    check: {
      q: 'At a 650 dollar average ticket and 250 working days, about how many jobs a day does one million dollars need?',
      options: ['About 3', 'About 6', 'About 12'],
      answer: 1,
      why: 'One million divided by 650 is about 1,538 jobs a year; divided by 250 working days that is about 6.2 jobs a day.',
    },
  },
  {
    id: 'biz-margin',
    title: '2. Price for margin, not for volume',
    body: [
      'Every job has a real cost: the dump fee, the fuel, the hours of labour, and a share of insurance, trailer upkeep and the phone bill. What is left after those is gross margin.',
      'A healthy junk-removal operation runs about 55 to 65 percent gross margin. Below 45 percent you are working hard to buy jobs, not to earn from them.',
      'Fill the truck before you discount. One full 16-yard load at 599 earns better per hour than two half loads only if the second trip costs you nothing — and it never does.',
      'Raise the price on the jobs that take the longest, not across the board. The market resists a blanket increase and forgets an adjusted quote.',
    ],
    check: {
      q: 'A job pays 600 dollars and the dump fee, fuel and labour come to 330 dollars. What is the gross margin?',
      options: ['270 dollars — 45 percent', '330 dollars — 55 percent', '600 dollars — 100 percent'],
      answer: 0,
      why: '600 minus 330 is 270, and 270 out of 600 is 45 percent. That sits on the low line — it is a job worth repricing or batching.',
    },
  },
  {
    id: 'biz-route',
    title: '3. Route density — the truck earns by the hour, not by the mile',
    body: [
      'A truck only earns while it is loading or unloading, never while it is driving. Cluster the work by city and by day: Walnut Creek and Concord together, Oakland and Berkeley together.',
      'A mid-day dump run can cost an hour or more. Book the afternoon jobs near the transfer station and the morning jobs near where the day starts.',
      'Three jobs a few miles apart usually beat three jobs spread across the East Bay, even when the far ones pay a little more.',
      'Density is also how a second truck becomes possible: the same day of work with less driving is the same revenue with less fuel, less time and less risk.',
    ],
    check: {
      q: 'Which day usually makes more money?',
      options: ['Three jobs in three distant cities', 'Three jobs within a few miles of each other', 'One big job across the bay'],
      answer: 1,
      why: 'Less driving means more billable hours in the same day, less fuel, and a dump run that fits the route.',
    },
  },
  {
    id: 'biz-recurring',
    title: '4. Recurring money beats one-off jobs',
    body: [
      'One-off jobs depend on the phone ringing. Commercial accounts pay whether it rings or not: property managers, HOAs, storage facilities, small offices, apartment turnovers.',
      'One 400 dollar a month account is 4,800 dollars a year, and it costs almost nothing to keep once the route passes it anyway.',
      'Twenty such accounts is 96,000 dollars a year of base revenue before a single one-off job. Base revenue is what lets you say no to bad jobs.',
      'Start with the customers you already have: a landlord whose cleanout you did last month is the easiest commercial account to ask.',
    ],
    check: {
      q: 'A 400 dollar monthly account is worth how much a year?',
      options: ['4,800 dollars', '1,200 dollars', '400 dollars'],
      answer: 0,
      why: '400 multiplied by 12 is 4,800 — and it arrives without a new customer finding you.',
    },
  },
  {
    id: 'biz-reviews',
    title: '5. Reviews and referrals are the cheapest marketing you have',
    body: [
      'Ask for the Google review at the moment the customer thanks you — not the next day, when the feeling has passed.',
      'The site already carries a referral coupon. A happy customer who sends a friend is doing your advertising for you.',
      'Do the arithmetic before you spend on ads: a 30 dollar referral credit on a 650 dollar job is about 4.6 percent of the job. A paid click often costs more than that and does not come with a recommendation.',
      'Answer the phone fast. Speed of reply wins more jobs than a clever slogan, and it is free.',
    ],
    check: {
      q: 'A 30 dollar referral credit on a 650 dollar job is roughly what share of the job?',
      options: ['About 4.6 percent', 'About 15 percent', 'About 30 percent'],
      answer: 0,
      why: '30 out of 650 is about 4.6 percent — a cheap way to buy a customer who already trusts you.',
    },
  },
  {
    id: 'biz-numbers',
    title: '6. Know your five numbers',
    body: [
      'Five numbers tell you whether the company is growing or just busy: average ticket, jobs per truck-day, close rate, revenue per truck-day, and the share of repeat plus commercial work.',
      'Close rate is booked jobs divided by enquiries. Ten enquiries and four bookings is 40 percent. When it drops, the cause is usually slow replies or unclear pricing.',
      'Write the five down every week in one place. A number you never look at is not a number you manage.',
      'The dashboard in this admin carries the real records; use them rather than memory when you talk about how the month went.',
    ],
    check: {
      q: 'Ten enquiries and four bookings is what close rate?',
      options: ['25 percent', '40 percent', '60 percent'],
      answer: 1,
      why: 'Four divided by ten is 40 percent. That is the number to lift before spending more on marketing.',
    },
  },
  {
    id: 'biz-crew',
    title: '7. Your first crew',
    body: [
      'Hire when you are turning away work you could actually have done — not before. A crew with no jobs is a cost with no revenue.',
      'Pay a fair hourly rate, train the crew on your standard, and put the quality rules in writing: how the truck is loaded, what gets recycled, how the site is left.',
      'One crew that pays for itself adds a full truck-day of revenue every day it works. That is how the jobs-per-day number in lesson one moves.',
      'Stay on the jobs that need the owner: estimates, commercial walk-throughs, and anything a customer is nervous about.',
    ],
    check: {
      q: 'What is the right moment to hire a first crew?',
      options: ['As soon as revenue grows at all', 'When work you could have done is being turned away', 'Only after a million dollars a year'],
      answer: 1,
      why: 'A crew earns only if there is work waiting. Turning away doable jobs is the signal that a second truck-day can pay for itself.',
    },
  },
  {
    id: 'biz-cash',
    title: '8. Cash flow, tax and break-even',
    body: [
      'Dump fees and fuel are paid today. Customer money can arrive later. Keep a cash buffer of eight to twelve weeks of fixed costs so one slow month does not stop the trucks.',
      'Set tax money aside the week it lands, not in April. Sales tax and income tax are money you are holding, not money you earned.',
      'Know the break-even line: fixed costs divided by gross margin is the revenue you need before you earn anything. Nine thousand a month of fixed costs at 60 percent margin means 15,000 dollars of revenue just to stand still.',
      'Review it monthly. Break-even moves when insurance, storage or a truck payment changes.',
    ],
    check: {
      q: 'Fixed costs are 9,000 dollars a month and gross margin is 60 percent. What revenue is break-even?',
      options: ['9,000 dollars', '15,000 dollars', '21,000 dollars'],
      answer: 1,
      why: '9,000 divided by 0.60 is 15,000. Below that the company is losing money even when the phone is ringing.',
    },
  },
  {
    id: 'biz-compliance',
    title: '9. Compliance keeps the company alive',
    body: [
      'The LLC, the insurance and legal disposal are not paperwork — they are what lets the company keep operating when something goes wrong.',
      'Mattresses, paint, electronics and appliances have disposal rules in California. One illegal dump can cost more than a year of profit and the licence with it.',
      'Keep receipts and disposal records. They protect you in a dispute and they prove where the customer material went.',
      'A written standard also protects the crew: everyone knows what gets accepted, what gets refused, and what gets charged extra.',
    ],
    check: {
      q: 'Why keep disposal receipts and records?',
      options: ['Only for tax time', 'To prove where material went and protect the company in a dispute', 'They are optional once the company is an LLC'],
      answer: 1,
      why: 'Records are evidence of legal disposal and of what the customer agreed to pay — that is what keeps a small company safe.',
    },
  },
  {
    id: 'biz-sell',
    title: '10. Building something worth selling',
    body: [
      'A junk-removal company is sold on documented systems and repeat revenue, not on how many hours the owner works.',
      'Write down how you price, how you book, how you dispatch, how you dispose. A buyer pays for a machine that runs without the owner in it.',
      'Recurring commercial accounts and a clean record of bookings, invoices and reviews are what make the business worth more than its trucks.',
      'This admin is part of that value: the booking history, the invoices and the customer records are the company written down.',
    ],
    check: {
      q: 'What makes a small business worth more when it is sold?',
      options: ['How hard the owner personally works', 'Documented systems and recurring revenue', 'The newest truck'],
      answer: 1,
      why: 'A buyer pays for a business that keeps running without the owner — documented systems plus revenue that repeats.',
    },
  },
]
