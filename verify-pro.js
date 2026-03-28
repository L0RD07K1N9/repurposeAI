// api/verify-pro.js
// Vercel serverless function — frontend calls this to check if an email is Pro
//
// GET /api/verify-pro?email=user@example.com
// Returns: { pro: true/false }

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.query;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email required" });
  }

  try {
    // Look up the customer in Stripe directly (source of truth)
    const customers = await stripe.customers.list({
      email: email.toLowerCase(),
      limit: 1,
    });

    if (customers.data.length === 0) {
      return res.status(200).json({ pro: false });
    }

    const customer = customers.data[0];

    // Check for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    const isPro = subscriptions.data.length > 0;

    return res.status(200).json({
      pro: isPro,
      customerId: customer.id,
      // Return subscription end date so you can show "renews on X"
      renewsAt: isPro ? subscriptions.data[0].current_period_end : null,
    });

  } catch (err) {
    console.error("Stripe verify error:", err.message);
    return res.status(500).json({ error: "Verification failed", pro: false });
  }
}
