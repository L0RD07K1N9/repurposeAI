// pages/api/create-checkout.js
// Vercel serverless function — initiates a Paystack payment for Pro subscription
//
// ENV VARS needed in Vercel dashboard:
//   PAYSTACK_SECRET_KEY=sk_live_...
//   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

import axios from "axios";

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email required" });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    console.error("PAYSTACK_SECRET_KEY not configured");
    return res.status(500).json({ error: "Payment service not configured" });
  }

  try {
    // Initialize a Paystack transaction
    // For subscriptions, we create a plan and assign customer to it
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: email.toLowerCase(),
        amount: 900 * 100, // Amount in kobo (NGN cents) - 900 NGN = $9 USD equivalent
        metadata: {
          custom_fields: [
            {
              display_name: "Plan",
              variable_name: "plan",
              value: "pro_monthly",
            },
          ],
        },
        callback_url: `${appUrl}?upgraded=true&email=${encodeURIComponent(email)}`,
      },
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status) {
      return res.status(200).json({ url: response.data.data.authorization_url });
    } else {
      return res.status(500).json({ error: "Failed to initialize payment" });
    }
  } catch (err) {
    console.error("Paystack error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
}
