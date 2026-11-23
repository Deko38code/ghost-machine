import LegalPage from "./LegalPage.jsx";

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="What we collect, why we collect it, and how we protect it."
      lead="This policy covers account information, bookings, chat, notifications, and the site security records needed to run the marketplace."
      sections={[
        {
          heading: "Information we collect",
          bullets: [
            "Account details such as email, display name, and profile image.",
            "Listing, booking, payment, and deposit activity.",
            "Messages, support requests, and optional verification details.",
            "Security logs such as IP address and device information for fraud/abuse prevention.",
          ],
        },
        {
          heading: "How we use information",
          bullets: [
            "Create and secure your account.",
            "Process bookings, fees, and deposits.",
            "Send booking, message, and delivery notifications where enabled.",
            "Maintain trust, safety, abuse prevention, and service diagnostics.",
          ],
        },
        {
          heading: "Sharing",
          content:
            "We share account details with third parties only as needed to process payments, send email/SMS, and operate the product. We do not publicly expose booking history or private messages.",
        },
        {
          heading: "Cookies and local storage",
          content:
            "We use browser local storage to keep you signed in and remember your preferences on your device. Security-related site settings remain server-side.",
        },
        {
          heading: "Your choices",
          bullets: [
            "Update account information from your profile.",
            "Log out to remove access on that browser/device.",
            "Contact support about data access or removal, subject to security and legal obligations.",
          ],
        },
        {
          heading: "Security",
          content:
            "Access is authenticated and protected by hashing for credentials, optional 2FA, and HTTPS. No service can guarantee perfect security, so we monitor and update controls continuously.",
        },
      ]}
    />
  );
}
