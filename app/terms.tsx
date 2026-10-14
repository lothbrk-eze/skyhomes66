import React from "react";
import LegalPage from "../components/LegalPage";

export default function TermsScreen() {
  return (
    <LegalPage
      title="Terms & Privacy"
      subtitle="Please read these terms carefully before using SkyHomes."
      sections={[
        {
          heading: "Platform role",
          body:
            "SkyHomes is a premier rental discovery and advertising platform that connects tenants and landlords. SkyHomes does not own, manage, or operate listed properties, and does not act as an agent, broker, or legal representative for either party.",
        },
        {
          heading: "No guarantee",
          body:
            "SkyHomes does not guarantee the availability, quality, legality, or success of any listing or rental agreement made through the platform.",
        },
        {
          heading: "User eligibility",
          body:
            "You must be at least 18 years old to use SkyHomes. By using the app, you confirm that the information you provide is accurate and that you meet this age requirement.",
        },
        {
          heading: "Landlord responsibilities",
          body: [
            "Post accurate and complete property details.",
            "Keep pricing, condition, and availability updated.",
            'Remove listings or mark them as "Occupied" once no longer available.',
          ],
        },
        {
          heading: "Listing expiry",
          body:
            "Listings expire after 24 hours and move to archive. Landlords are required to repost active listings.",
        },
        {
          heading: "Tenant obligations",
          body:
            "Tenants must use the platform only for legitimate housing searches and must not engage in spam, fraud, scraping, platform abuse, or other harmful conduct.",
        },
        {
          heading: "Reviews",
          body:
            "Tenants and landlords may review one another after interaction on the platform.",
        },
        {
          heading: "Verification & security",
          body:
            "SkyHomes may request documentation or additional details to verify users or listings. Suspicious accounts may be restricted, suspended, or permanently removed.",
        },
        {
          heading: "Bad actor policy",
          body:
            "Fraudulent or deceptive listings may result in suspension, a 24-week ban, Premium-only restriction, or permanent removal from the platform.",
        },
        {
          heading: "Payments",
          body:
            "SkyHomes does not process rental payments. Any transactions between users are made at their own risk.",
        },
        {
          heading: "Limitation of liability",
          body:
            "SkyHomes is only a neutral facilitator and is not a party to any rental agreement, lease, or contract between users. SkyHomes is not liable for disputes, fraud, misrepresentation, or financial loss arising from user interactions.",
        },
      ]}
      footerText="By continuing, you agree to SkyHomes's Terms & Conditions."
      buttonText="I Accept"
      onAcceptRoute="/signup"
    />
  );
}