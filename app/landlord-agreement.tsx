import React from "react";
import LegalPage from "../components/LegalPage";

export default function LandlordAgreementScreen() {
  return (
    <LegalPage
      title="Landlord Agreement"
      subtitle="These rules apply when posting property listings on SkyHomes."
      sections={[
        {
          heading: "By Posting on SkyHomes You Agree To",
          body: [
            "Provide accurate listings",
            "Upload real photos and videos",
            "Update availability",
            "Mark listings occupied when filled",
          ],
        },
        {
          heading: "Listing Expiry",
          body:
            "Listings expire after 7 days and must be reposted if still active.",
        },
        {
          heading: "Prohibited Conduct",
          body: [
            "Fake listings",
            "Misleading information",
            "Fraud",
            "Harassment",
          ],
        },
        {
          heading: "Violations",
          body: [
            "Suspension",
            "24-week ban",
            "Premium restriction",
          ],
        },
        {
          heading: "Payments",
          body:
            "Bloom does not handle payments between landlords and tenants.",
        },
      ]}
    />
  );
}