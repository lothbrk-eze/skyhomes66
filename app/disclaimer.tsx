import React from "react";
import LegalPage from "../components/LegalPage";

export default function DisclaimerScreen() {
  return (
    <LegalPage
      title="Important Notice"
      subtitle="Please read this before using SkyHomes."
      sections={[
        {
          heading: "SkyHomes Is a Discovery Platform",
          body:
            "SkyHomes helps users discover rental listings and connect with each other.",
        },
        {
          heading: "Bloom Does Not",
          body: [
            "Own properties",
            "Act as an agent",
            "Guarantee availability",
            "Handle payments",
          ],
        },
        {
          heading: "Your Responsibility",
          body:
            "Users must verify details independently before making any decisions or transactions.",
        },
        {
          heading: "Acceptance",
          body:
            "By continuing, you accept responsibility for your own choices and verification steps.",
        },
      ]}
    />
  );
}