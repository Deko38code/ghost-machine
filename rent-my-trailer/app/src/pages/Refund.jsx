import LegalPage from "./LegalPage.jsx";

export default function Refund() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      subtitle="A clear rulebook for cancellations and deposit returns."
      lead="Cancel before pickup whenever plans change. After pickup, the handover and return records determine what happens next."
      aside={
        <div>
          <h3>Need a refund review?</h3>
          <p>
            Include your booking code, photos, and the issue. We investigate documented disputes first.
          </p>
        </div>
      }
      sections={[
        {
          heading: "Cancel before pickup",
          content:
            "A booking canceled before pickup is released from the calendar. Refunds or credits are handled according to the pricing shown at checkout.",
        },
        {
          heading: "Owner cancellations",
          content:
            "If an owner cancels after payment, the renter is refunded or rebooked. Repeat issues may reduce placement or access to owner features.",
        },
        {
          heading: "After pickup",
          content:
            "Once the trailer is in the renter's care, refund requests are reviewed against photos, timing, trailer condition, and rental terms.",
        },
        {
          heading: "Security deposits",
          content:
            "Deposits are held separately and released in full after the trailer is returned in the same condition and on time. Damage, missing equipment, or late return can result in deductions.",
        },
        {
          heading: "Processing",
          content:
            "Approved refunds are processed through the original payment method. Processing time depends on the user's card provider or bank.",
        },
      ]}
    />
  );
}
