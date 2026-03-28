// pages/api/webhook.js
// Vercel serverless function — listens for Paystack payment events
//
// ENV VARS needed in Vercel dashboard:
//   PAYSTACK_SECRET_KEY=sk_live_...
//
// In Paystack Dashboard, create a webhook pointing to:
//   https://your-app.vercel.app/api/webhook
// Listen for: charge.success event

import crypto from "crypto";
import { paidCustomers } from "./verify-pro";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const signature = req.headers["x-paystack-signature"];
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const body = JSON.stringify(req.body);

  // Verify webhook signature
  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(body)
    .digest("hex");

  if (hash !== signature) {
    console.error("Invalid webhook signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  const event = req.body;

  // Handle charge.success event
  if (event.event === "charge.success") {
    const { data } = event;
    const email = data.customer?.email;
    const reference = data.reference;
    const amount = data.amount;

    if (email && amount >= 900 * 100) {
      // Amount is in kobo, so 900*100 = 90000 kobo = 900 NGN
      paidCustomers.set(email.toLowerCase(), {
        active: true,
        reference,
        subscribedAt: new Date().toISOString(),
      });
      console.log(`✅ Pro activated: ${email}`);
    }
  }

  // Paystack requires a 200 response immediately
  return res.status(200).json({ received: true });
}
