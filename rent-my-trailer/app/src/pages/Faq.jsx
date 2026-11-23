import LegalPage from "./LegalPage.jsx";

export default function Faq() {
  return (
    <LegalPage
      title="FAQ / Help"
      subtitle="Everything you need before you tow."
      lead="Quick answers about browsing, renting, deposits, support, and owner tools."
      sections={[
        {
          heading: "How do I rent a trailer?",
          content:
            "Open Browse Trailers, find your trailer, review specs and the rate, then book. The site will guide you through payment and pickup steps.",
        },
        {
          heading: "How do I list my trailer?",
          content:
            "Use List Your Trailer, enter the daily/weekly/monthly rates, add photos, and set your deposit and delivery details. Your listing appears on the platform when it is live.",
        },
        {
          heading: "What is a security deposit?",
          content:
            "A refundable amount held during the rental. It is released after the trailer is returned in its agreed condition and on time.",
        },
        {
          heading: "What are platform fees?",
          content:
            "Platform fees and taxes are clearly shown in the pricing and payment interface. Premium members can receive reduced fees and priority features.",
        },
        {
          heading: "Can I cancel my membership?",
          content:
            "Yes. You can cancel membership before renewal to stop future billing. Your active membership period is not cut short by canceling.",
        },
        {
          heading: "How do I report a problem?",
          content:
            "Use your booking details and contact support. If there is damage, add photos from checkout and return and describe what happened.",
        },
        {
          heading: "Do I need to be verified?",
          content:
            "Some account actions may request verification to protect users, especially for deposits, bookings, or payouts.",
        },
        {
          heading: "Can I set up delivery?",
          content:
            "Yes. Owners can advertise a delivery radius and renters can message owners to discuss pickup or drop-off.",
        },
      ]}
    />
  );
}
