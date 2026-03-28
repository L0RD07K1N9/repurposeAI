// api/create-checkout.js
// Vercel serverless function — creates a Stripe Checkout session
//
// ENV VARS needed in Vercel dashboard:
//   STRIPE_SECRET_KEY=sk_live_...   (or sk_test_... for testing)
//   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

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

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],

      customer_email: email,

      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            product_data: {
              name: "Repurpose.ai Pro",
              description: "Unlimited content repurposing across 5 platforms",
              images: [], // Add your logo URL here if you have one
            },
            unit_amount: 900, // $9.00 in cents
          },
          quantity: 1,
        },
      ],

      // Store email in metadata so webhook can find it
      metadata: { email },

      // Where to send the user after payment
      success_url: `${appUrl}?session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(email)}&upgraded=true`,
      cancel_url: `${appUrl}?cancelled=true`,

      // Allow promo codes
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err.message);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
}
