// Summarise the §18 measurement JSON into pass/fail lines.
const rows = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'))
const fail = []
for (const { w, h, steps } of rows) {
  for (const s of steps) {
    const c = s.card
    if (!c) { fail.push(`${w}x${h} ${s.heading}: no card`); continue }
    const gutL = c.l, gutR = s.vw - c.r
    const needGut = s.vw < 480 ? 20 : 16
    const okBox = c.l >= 0 && c.r <= s.vw && c.t >= 0 && c.b <= s.vh
    const okGut = Math.min(gutL, gutR) >= needGut - 0.5
    const okBtn = s.minBtnHeight >= 44
    const okOver = s.hOverflow <= 0
    const line = `${w}x${h} | ${s.heading.slice(0, 26).padEnd(26)} card ${c.l},${c.t} ${c.w}x${c.h} | gut L${gutL} R${gutR} | btn ${s.minBtnHeight} | hOver ${s.hOverflow} | ${okBox && okGut && okBtn && okOver ? 'PASS' : 'FAIL'}`
    console.log(line)
    if (!okBox) fail.push(`${w}x${h} ${s.heading}: card outside viewport ${JSON.stringify(c)} vh=${s.vh}`)
    if (!okGut) fail.push(`${w}x${h} ${s.heading}: gutter ${Math.min(gutL, gutR)} < ${needGut}`)
    if (!okBtn) fail.push(`${w}x${h} ${s.heading}: smallest button ${s.minBtnHeight}px < 44`)
    if (!okOver) fail.push(`${w}x${h} ${s.heading}: horizontal overflow ${s.hOverflow}`)
  }
}
console.log(fail.length ? '\nFAILURES:\n' + fail.join('\n') : '\nALL PASS')
