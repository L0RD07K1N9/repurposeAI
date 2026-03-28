# 🚀 Repurpose.ai — Launch Checklist

## Files in this project
```
repurpose-ai.jsx          ← Main React app (your frontend)
pages/api/create-checkout.js    ← Serverless: initiates Paystack payment
pages/api/webhook.js            ← Serverless: listens for Paystack payment events
pages/api/verify-pro.js         ← Serverless: checks if email has active subscription
package.json              ← Dependencies
```

---

## STEP 1 — Create your Paystack account (5 min)
1. Go to https://paystack.com and create an account
2. Complete identity verification (required to receive payouts)
3. In the Paystack Dashboard, go to Settings → Developers/API Keys and note your:
   - **Secret key**: `sk_test_...` (for testing) or `sk_live_...` (for production)
   - **Public key**: `pk_test_...` (for testing) or `pk_live_...` (for production)

---

## STEP 2 — Deploy to Vercel (5 min)
1. Push all files to a GitHub repo
2. Go to https://vercel.com → New Project → Import your repo
3. Vercel auto-detects Next.js — just click Deploy
4. Note your app URL: `https://your-app.vercel.app`

---

## STEP 3 — Add environment variables in Vercel (2 min)
In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `PAYSTACK_SECRET_KEY` | `sk_live_...` (from Paystack) |
| `PAYSTACK_PUBLIC_KEY` | `pk_live_...` (from Paystack) |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

---

## STEP 4 — Set up Paystack Webhook (3 min)
1. Paystack Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-app.vercel.app/api/webhook`
3. Select events to listen for:
   - ✅ `charge.success`
4. Copy the webhook signing secret if provided (some webhook events may require it)

---

## STEP 5 — Test the full flow (5 min)
1. Use Paystack test card:
   - Card number: `4111 1111 1111 1111`
   - Expiry: Any future date (e.g., 12/30)
   - CVV: Any 3 digits (e.g., 123)
2. Go to your app → click PRO · $9/mo → enter your email → checkout
3. After payment, you should be redirected back and auto-verified as Pro
4. Check Paystack Dashboard → Transactions to confirm the payment

---

## STEP 6 — Go live
1. In Paystack, activate your account (add bank details for payouts)
2. Switch `PAYSTACK_SECRET_KEY` from `sk_test_...` to `sk_live_...`
3. Switch `PAYSTACK_PUBLIC_KEY` from `pk_test_...` to `pk_live_...`
4. Update the webhook URL to use your live keys
5. Post your link on Reddit, X, and LinkedIn 🚀

---

## 💡 Upgrade: Persistent Pro database (recommended)
The current setup uses in-memory storage for Pro users (resets on each deployment).
For production scale, add Vercel KV (Redis) or Supabase:

```bash
# Option 1: Vercel KV (free tier: 256MB)
npm install @vercel/kv

# Option 2: Supabase PostgreSQL (free tier: 500MB)
npm install @supabase/supabase-js
```

Then update `/pages/api/verify-pro.js` and `/pages/api/webhook.js` to use persistent storage.

---

## 💰 Revenue targets
| Users | MRR |
|---|---|
| 10 | ₦4,500 (or $30 USD) |
| 50 | ₦22,500 (or $150 USD) |
| 100 | ₦45,000 (or $300 USD) |
| 500 | ₦225,000 (or $1,500 USD) |

**First 10 customers = your first ₦4,500/mo. That's the goal for week 1.**
