import LegalPage from "./LegalPage.jsx";

export default function About() {
  return (
    <LegalPage
      title="About"
      subtitle="Rent My Trailer was built for real haulers."
      lead="A marketplace focused on trailer owners and renters: real listings, clear pricing, direct communication, and practical support tools."
      sections={[
        {
          heading: "Our mission",
          content:
            "Make trailer rental easy without hiding the details. Owners should keep a competitive share of revenue. Renters should know the rates, deposit rules, and pickup plan before they book.",
        },
        {
          heading: "How the platform works",
          bullets: [
            "Browse live trailers in one place.",
            "Book with dates, rates, and deposit terms.",
            "Message the owner and arrange pickup.",
            "Return on time and release the deposit after inspection.",
          ],
        },
        {
          heading: "Built for owners and renters",
          bullets: [
            "Owners get listing tools, rental analytics, and priority booking controls.",
            "Renters get clear pricing and direct support.",
            "Both sides can use secure notifications and booking records.",
          ],
        },
        {
          heading: "Built by HaksterAI",
          content:
            "Rent My Trailer is part of the HaksterAI ecosystem. You can explore the platform at haksterai.com.",
        },
      ]}
    />
  );
}
