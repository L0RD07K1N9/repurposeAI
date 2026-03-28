// api/webhook.js
// Vercel serverless function — listens for Stripe payment events
//
// ENV VARS needed in Vercel dashboard:
//   STRIPE_SECRET_KEY=sk_live_...
//   STRIPE_WEBHOOK_SECRET=whsec_...   (from Stripe Dashboard > Webhooks)
//
// In Stripe Dashboard, create a webhook pointing to:
//   https://your-app.vercel.app/api/webhook
// Listen for these events:
//   - checkout.session.completed
//   - customer.subscription.deleted
//   - invoice.payment_failed

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// ─── Simple in-memory Pro user store ────────────────────────────────────────
// NOTE: For production, replace this with a real database (Vercel KV, PlanetScale,
// Supabase, etc). In-memory resets on each cold start.
//
// Recommended upgrade: Vercel KV (Redis) — free tier covers thousands of users.
// import { kv } from "@vercel/kv";
// await kv.set(`pro:${email}`, { active: true, since: Date.now() });
// ─────────────────────────────────────────────────────────────────────────────

// We export this so verify-pro.js can import it (works within same deployment)
// In production use a shared DB instead.
export const proUsers = new Map();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify the webhook came from Stripe (not a fake request)
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  // ── Handle events ──────────────────────────────────────────────────────────
  switch (event.type) {

    case "checkout.session.completed": {
      const session = event.data.object;
      const email = session.metadata?.email || session.customer_email;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      if (email) {
        proUsers.set(email.toLowerCase(), {
          active: true,
          customerId,
          subscriptionId,
          since: Date.now(),
        });
        console.log(`✅ Pro activated: ${email}`);
      }
      break;
    }

    case "customer.subscription.deleted": {
      // Subscription cancelled or payment failed hard
      const subscription = event.data.object;
      const customerId = subscription.customer;

      // Find the user by customerId and deactivate
      for (const [email, data] of proUsers.entries()) {
        if (data.customerId === customerId) {
          proUsers.set(email, { ...data, active: false });
          console.log(`❌ Pro deactivated: ${email}`);
          break;
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = invoice.customer;
      console.warn(`⚠️ Payment failed for customer: ${customerId}`);
      // You could send a dunning email here
      break;
    }

    default:
      // Ignore unhandled events
      break;
  }

  return res.status(200).json({ received: true });
}

// IMPORTANT: Vercel needs raw body for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
