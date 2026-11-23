import LegalPage from "./LegalPage.jsx";

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle="Renting & listing, the straightforward way."
      lead="By using Rent My Trailer, you agree to give truthful listing details, honor booking commitments, and treat equipment and people responsibly."
      sections={[
        {
          heading: "1. Your account",
          content:
            "You are responsible for the information you provide and for keeping your credentials secure. Accounts used for fraud, harassment, or unsafe activity may be suspended.",
        },
        {
          heading: "2. Listings and bookings",
          bullets: [
            "Owners accurately describe trailers, rates, deposits, and pickup details.",
            "Renters review trailer specs and rental terms before booking.",
            "Both sides return messages in good faith and agree on pickup and return times.",
          ],
        },
        {
          heading: "3. Payments and deposits",
          content:
            "Platform fees and sales tax apply where shown in checkout. A rental deposit may be held separately from the rental payment and is released after a clean handover and return.",
        },
        {
          heading: "4. Member fees",
          content:
            "Premium members may receive reduced platform fees, priority placement, and direct chat features. Membership is billed monthly and can be canceled before renewal.",
        },
        {
          heading: "5. Safety and legal use",
          bullets: [
            "Trailers must be towed by a capable, licensed vehicle and properly secured.",
            "Users follow local towing, road, and safety laws.",
            "Trailers may not be used for illegal cargo or unsafe transport.",
          ],
        },
        {
          heading: "6. Damage and disputes",
          content:
            "Owners and renters should document condition at checkout and return. If damage or a dispute occurs, contact support with photos and booking details so the case can be reviewed.",
        },
        {
          heading: "7. Changes and contact",
          content:
            "These terms may be updated to reflect changes in product features or legal requirements. Continued use after an update means you accept the revised terms.",
        },
      ]}
    />
  );
}
