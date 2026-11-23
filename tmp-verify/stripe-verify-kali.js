// Read-only Stripe check for the kalilinuxneed@gmail.com $3 lite purchase.
// Prints only payment/invoice facts — never the key.
require('/home/ghost/haksterAi/server/node_modules/dotenv').config({ path: '/home/ghost/haksterAi/server/.env', quiet: true });
const Stripe = require('/home/ghost/haksterAi/server/node_modules/stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

(async () => {
  const sessionId = 'cs_live_agevOuUAgBrMItWeoSffwzHq6RyCml1mevI4to4dJdEx1zp3azY4qVOVep';
  const invoiceId = 'in_1UdxK5A0UrVsJMzeU9k7j5PK';

  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent', 'invoice'] });
  const out = {
    session: {
      id: session.id,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      mode: session.mode,
      customer_email: session.customer_details && session.customer_details.email,
      payment_method_types: session.payment_method_types,
      invoice: session.invoice && (session.invoice.id || session.invoice),
      subscription: session.subscription,
    },
  };
  if (session.payment_intent && typeof session.payment_intent === 'object') {
    const pi = session.payment_intent;
    out.payment_intent = {
      id: pi.id,
      status: pi.status,
      amount_received: pi.amount_received,
      payment_method: pi.payment_method,
    };
    if (pi.latest_charge && typeof pi.latest_charge === 'string') {
      const charge = await stripe.charges.retrieve(pi.latest_charge);
      out.charge = {
        id: charge.id,
        paid: charge.paid,
        amount: charge.amount,
        currency: charge.currency,
        payment_method_details: charge.payment_method_details,
        receipt_url: charge.receipt_url,
      };
    }
  }
  const invoice = await stripe.invoices.retrieve(invoiceId);
  out.invoice = {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    paid: invoice.paid,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency,
    billing_reason: invoice.billing_reason,
    customer_email: invoice.customer_email,
    hosted_invoice_url: invoice.hosted_invoice_url,
    invoice_pdf: invoice.invoice_pdf,
    period_start: invoice.period_start,
    period_end: invoice.period_end,
  };
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
