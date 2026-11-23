import LegalPage from "./LegalPage.jsx";

export default function Contact() {
  return (
    <LegalPage
      title="Contact"
      subtitle="Here's the fastest way to get help."
      lead="Use the relevant path below and include the booking code if the issue is about a live rental."
      sections={[
        {
          heading: "Booking help",
          content:
            "If a booking is pending, paid, or returning, contact support with your booking code. This speeds up the review and deposit release process.",
        },
        {
          heading: "Listing support",
          content:
            "For listing setup, photo changes, delivery radius, or owner tools, describe the trailer and the change you want to make.",
        },
        {
          heading: "Account and security",
          content:
            "For login problems, 2FA, or profile changes, send an email to support@rentmytrailer.com with the email on your account.",
        },
        {
          heading: "Payments and disputes",
          content:
            "Send booking details and any relevant proof, such as photos of checkout, return, or trailer condition. We review documented cases first.",
        },
        {
          heading: "General inquiries",
          content:
            "For general questions or partnership requests, email support@rentmytrailer.com or use the FAQ page for common product questions.",
        },
      ]}
    />
  );
}
