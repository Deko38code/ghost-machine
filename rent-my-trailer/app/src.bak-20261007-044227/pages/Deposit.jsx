export default function Deposit() {
  return (
    <div className="page deposit">
      <h1 className="sec-title">Deposits, explained</h1>
      <p className="sec-sub">Flat, refundable cash deposit — set per listing, collected at pickup, handed back at return.</p>
      <ol className="steps">
        <li><b>01</b><h3>Held, not charged</h3><p>The deposit number is cash at pickup (or a hold), not a card charge. It shows on every listing before you book.</p></li>
        <li><b>02</b><h3>Full refund on clean return</h3><p>Trailer back on time with the equipment listed (ramps, straps, locks) — deposit returns same day.</p></li>
        <li><b>03</b><h3>Owner keeps deposit only for these</h3><p>Late return per listing rules, broken fittings, or lost keys. Disputed amounts go to the cancellation review queue — both sides upload photos.</p></li>
        <li><b>04</b><h3>Booking total ≠ deposit</h3><p>You pay rental + coupon discount at booking; deposit exchanges hands at pickup and never sits with the platform.</p></li>
      </ol>
      <table className="quotetab" style={{ maxWidth: 560 }}>
        <thead><tr><th>Example</th><th>Amount</th></tr></thead>
        <tbody>
          <tr><td>7x14 dump trailer, 7 days</td><td>$900</td></tr>
          <tr><td>HAULMORE coupon −10%</td><td class-name="disc">−$90</td></tr>
          <tr><td>Refundable deposit</td><td>$100 (returned)</td></tr>
          <tr className="due"><td>You pay at booking</td><td><b>$810</b></td></tr>
        </tbody>
      </table>
    </div>
  );
}