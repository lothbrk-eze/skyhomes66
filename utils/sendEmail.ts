import { send } from "@emailjs/browser";

const SERVICE_ID = "service_xxx";
const TEMPLATE_ID = "template_xxx";
const PUBLIC_KEY = "your_public_key";

export const sendOTPEmail = async (
  email: string,
  name: string,
  otp: string
) => {
  try {
    const result = await send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: email,
        to_name: name,
        otp: otp,
      },
      PUBLIC_KEY
    );

    console.log("Email sent:", result.text);
    return true;
  } catch (error) {
    console.log("Email error:", error);
    return false;
  }
};