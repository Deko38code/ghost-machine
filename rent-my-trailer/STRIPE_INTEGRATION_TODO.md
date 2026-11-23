# Stripe Checkout Integration

## Values to Replace

There are no Checkout Session placeholders in the existing deposit flow. It uses the booking's actual deposit amount and trailer name, and builds the success and cancel URLs from the current request origin and booking ID.

## Configured Parameters

**File containing these parameters:**
- [server.js](server.js)

| Parameter | Value |
|-----------|-------|
| ui_mode | hosted_page (SDK/API compatibility still needs confirmation; see setup below) |
| mode | payment (one-time booking deposit) |
| billing_address_collection | auto |
| phone_number_collection.enabled | false |
| automatic_tax.enabled | false |
| allow_promotion_codes | false |
| submit_type | auto |
| integration_identifier | hosted_mobile_app_0001 |
| origin_context | mobile_app |

`payment_method_collection` is intentionally omitted because this flow uses `mode: payment`.

## Setup and Next Steps

- Configure `STRIPE_SECRET_KEY` in the server's secret environment. The server code already reads this server-only variable; never put it in browser code or commit it.
- The `rent-my-trailer` package does not currently declare or resolve the `stripe` Node SDK. Install and pin the SDK in the deployment environment before using this route.
- The installed SDK version could not be determined because the dependency is absent. Confirm the SDK/API accepts `ui_mode: hosted_page` before enabling the route; Checkout Studio's configured value is retained here.
- The repository's current `success_url` and `cancel_url` are runtime values based on the booking request origin. Confirm the deployed origin is trusted and HTTPS in production.
- The line item is generated from each booking's actual deposit amount and trailer title; it does not use a placeholder Price ID.
- Use Stripe test mode and a test secret key first. Stripe's standard successful test card is `4242 4242 4242 4242`; use any future expiry date and any three-digit CVC. Use Stripe's official testing guide for decline and authentication scenarios: <https://docs.stripe.com/testing>.
- The booking confirmation route retrieves the Checkout Session from Stripe and checks `payment_status`; the browser success redirect alone does not prove payment.

## Project Structure

- Existing server route: [server.js](server.js), `POST /api/bookings/:id/deposit-checkout`.
- No new routes or files were added to the application. This guide is the only new file.

## Flow Overview

The booking route calculates the refundable deposit, creates a hosted Checkout Session with booking-specific line item data, stores the resulting session ID on the booking, and returns the hosted URL. The customer pays on Stripe. The confirmation route retrieves the stored session and marks payment based on Stripe's returned status.

## Testing and Fulfillment

- Exercise a successful test payment and verify the confirmation route reports paid only after retrieving the session from Stripe.
- Exercise a cancelled Checkout and confirm the booking remains unpaid.
- Test a declined card and an authentication-required card using Stripe's official test scenarios.
- Before live mode, verify the deployed secret, HTTPS origin, deposit calculation, and support/fulfillment process. Do not treat the success page as payment verification.

## Resources

- [Stripe Checkout](https://docs.stripe.com/checkout)
- [Stripe testing](https://docs.stripe.com/testing)
- [Stripe support](https://support.stripe.com)
- [Stripe docs MCP](https://docs.stripe.com/mcp)
