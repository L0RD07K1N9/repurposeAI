// pages/api/verify-pro.js
// Vercel serverless function — frontend calls this to check if an email is Pro
//
// GET /api/verify-pro?email=user@example.com
// Returns: { pro: true/false }

import axios from "axios";

// Simple in-memory store for paid customers
// In production, use a real database (Vercel KV, Supabase, etc)
const paidCustomers = new Map();

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.query;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email required" });
  }

  const normalizedEmail = email.toLowerCase();

  try {
    // Check our in-memory store first (set by webhook)
    if (paidCustomers.has(normalizedEmail)) {
      const customer = paidCustomers.get(normalizedEmail);
      if (customer.active) {
        return res.status(200).json({
          pro: true,
          customerId: customer.reference,
          subscribedAt: customer.subscribedAt,
        });
      }
    }

    // Optionally query Paystack API for verification
    // This is slower but ensures accuracy if webhook is delayed
    // Uncomment below to enable:
    /*
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    try {
      const response = await axios.get(
        `https://api.paystack.co/customer/${normalizedEmail}`,
        {
          headers: { Authorization: `Bearer ${secretKey}` },
        }
      );
      if (response.data.status && response.data.data.subscriptions?.length > 0) {
        return res.status(200).json({ pro: true });
      }
    } catch (err) {
      // Customer not found or error
    }
    */

    return res.status(200).json({ pro: false });
  } catch (err) {
    console.error("Verify error:", err.message);
    return res.status(500).json({ error: "Verification failed", pro: false });
  }
}

// Export for webhook to use
export { paidCustomers };
