# Paystack API Setup Guide

## Overview
This guide walks you through getting Paystack API keys and configuring your Repurpose.ai app for payments.

---

## Step 1: Create a Paystack Account

1. Go to **https://paystack.com**
2. Click **Sign Up** (top right)
3. Fill in your details:
   - **Email**: Your business email
   - **Password**: Strong password
   - **Account Type**: Business (or Personal, your choice)
4. Verify your email via the link sent to your inbox
5. Complete your profile with:
   - Full name
   - Business name
   - Phone number
   - Country (Nigeria, Ghana, etc.)

---

## Step 2: Access Your API Keys

1. Log in to **https://dashboard.paystack.com**
2. Click **Settings** (bottom left sidebar)
3. Click **Developers** (or **API Keys**)
4. You'll see two keys:

### Test Keys (Development)
Use these while building and testing:
- **Secret Key**: `sk_test_...` (keep this private!)
- **Public Key**: `pk_test_...` (safe to use in frontend)

### Live Keys (Production)
Use these after going live:
- **Secret Key**: `sk_live_...`
- **Public Key**: `pk_live_...`

⚠️ **Never commit your Secret Keys to Git!** Use environment variables.

---

## Step 3: Verify Your Bank Account (Required for Live)

Before switching to live keys, Paystack requires bank verification:

1. In Dashboard → **Settings** → **Business**
2. Click **Bank Account**
3. Enter your bank details:
   - Bank name
   - Account number
   - Account holder name
4. Paystack will send test deposits to verify
5. Once verified, you can receive payouts

---

## Step 4: Set Up Webhook

Webhooks allow Paystack to notify your server when payments succeed.

### In Paystack Dashboard:

1. Go to **Settings** → **API Keys & Webhooks**
2. Scroll to **Webhooks**
3. Click **Add Webhook**
4. Enter your webhook URL:
   ```
   https://your-app.vercel.app/api/webhook
   ```
   (Replace `your-app` with your actual Vercel URL)

5. Select events to listen for:
   - ✅ `charge.success` (payment completed)
   - Optional: `charge.failed`, `charge.dispute.create`

6. Click **Save**

### In Your Code:

The webhook secret is automatically handled. Paystack sends a signature in the request header:
- Header: `x-paystack-signature`
- Value: HMAC SHA-512 hash of request body

Your `/api/webhook.js` validates this signature.

---

## Step 5: Add Keys to Your Environment

### For Local Development:

Edit `.env.local`:
```bash
PAYSTACK_SECRET_KEY=sk_test_YOUR_TEST_SECRET_KEY
PAYSTACK_PUBLIC_KEY=pk_test_YOUR_TEST_PUBLIC_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### For Production (Vercel):

1. Go to **Vercel Dashboard** → Your Project
2. Click **Settings** → **Environment Variables**
3. Add:
   - `PAYSTACK_SECRET_KEY` → `sk_live_YOUR_LIVE_SECRET_KEY`
   - `PAYSTACK_PUBLIC_KEY` → `pk_live_YOUR_LIVE_PUBLIC_KEY`
   - `NEXT_PUBLIC_APP_URL` → `https://your-app.vercel.app`

---

## Step 6: Test with Test Card

### Using Test Environment:

Use these test card details:

| Type | Card Number | Expiry | CVV |
|------|-------------|--------|-----|
| **Success** | `4111 1111 1111 1111` | 12/30 | 123 |
| **Failed** | `4000 0000 0000 0002` | 12/30 | 123 |
| **Expired** | `5555 5555 5555 4444` | 12/20 | 123 |

1. Go to your app → Click **PRO · $9/mo**
2. Enter any test email (e.g., `test@example.com`)
3. Click **Continue to Secure Checkout**
4. Use card number `4111 1111 1111 1111`
5. Enter future expiry (e.g., 12/30)
6. Enter any CVC (e.g., 123)
7. You'll see **Transaction Successful** ✅

---

## Step 7: Verify Payment in Dashboard

1. Go to **Paystack Dashboard**
2. Click **Transactions** (left sidebar)
3. You should see your test payment
4. Click it to see details:
   - Amount
   - Email
   - Reference number
   - Status: **Success**

---

## Step 8: Test Your Webhook

After a successful payment, your webhook should receive a notification:

1. Check **Vercel Logs** (or terminal if local):
   ```
   POST /api/webhook → 200 OK
   ✅ Pro activated: test@example.com
   ```

2. Go back to your app
3. Check **Settings** → **Profile** (if you added one)
4. Email should show as **Pro** ✅

---

## API Reference

### Key Endpoints Used:

#### 1. Initialize Payment
```
POST https://api.paystack.co/transaction/initialize
Authorization: Bearer {PAYSTACK_SECRET_KEY}
Content-Type: application/json

{
  "email": "customer@example.com",
  "amount": 90000,  // Amount in kobo (₦900 = 90,000 kobo)
  "metadata": {
    "custom_fields": [
      {
        "display_name": "Plan",
        "variable_name": "plan",
        "value": "pro_monthly"
      }
    ]
  }
}

Response:
{
  "status": true,
  "message": "Authorization URL created",
  "data": {
    "authorization_url": "https://checkout.paystack.com/...",
    "access_code": "...",
    "reference": "..."
  }
}
```

#### 2. Verify Payment
```
GET https://api.paystack.co/transaction/verify/{reference}
Authorization: Bearer {PAYSTACK_SECRET_KEY}

Response:
{
  "status": true,
  "message": "Verification successful",
  "data": {
    "amount": 90000,
    "currency": "NGN",
    "status": "success",
    "customer": {
      "email": "customer@example.com"
    }
  }
}
```

#### 3. Webhook Event
```
POST /api/webhook
x-paystack-signature: {HMAC_SHA512}
Content-Type: application/json

{
  "event": "charge.success",
  "data": {
    "id": 123456,
    "reference": "ref_123abc",
    "amount": 90000,
    "customer": {
      "email": "customer@example.com"
    }
  }
}
```

---

## Troubleshooting

### Payment redirects but doesn't complete
- ✅ Check that `PAYSTACK_SECRET_KEY` is correct
- ✅ Verify webhook is registered in Paystack Dashboard
- ✅ Check `NEXT_PUBLIC_APP_URL` matches your domain

### Webhook not being called
- ✅ Verify webhook URL in Paystack Dashboard (Settings → Webhooks)
- ✅ Make sure it's publicly accessible (not localhost)
- ✅ Check that your server is returning `200 OK` response

### "Invalid signature" error
- ✅ Ensure `PAYSTACK_SECRET_KEY` is correct
- ✅ Verify webhook body is not being parsed as JSON before verification
- ✅ Check that request body is sent as raw bytes, not string

### Test card not working
- ✅ Use exactly: `4111 1111 1111 1111`
- ✅ Expiry must be in future (e.g., 12/30)
- ✅ CVV can be any 3 digits
- ✅ Make sure you're in **test environment** (not live)

### Can't see transactions in dashboard
- ✅ Make sure you're looking at the correct account
- ✅ Check that payments completed (watch for success redirects)
- ✅ Transactions may take 1-2 minutes to appear

---

## What Happens When User Pays

1. **User clicks "PRO · $9/mo"**
2. **Email modal appears** → User enters email
3. **Redirect to Paystack** → They fill card details
4. **Payment processed** → Paystack charges card
5. **Redirect back** → App URL includes `?upgraded=true&email=user@example.com`
6. **Auto-verify** → App checks if payment was successful
7. **Pro activated** → User can now use unlimited repurposing

---

## Moving from Test to Live

When you're ready for real money:

1. **Complete Paystack verification**
   - Add bank account
   - Pass identity checks

2. **Get Live Keys**
   - Go to Settings → Developers
   - Copy `sk_live_` and `pk_live_` keys

3. **Update Environment Variables**
   - Replace test keys with live keys in Vercel

4. **Update Webhook URL**
   - Go to Paystack → Webhooks
   - Add live webhook URL: `https://your-app.vercel.app/api/webhook`

5. **Test one payment** with your own card
   - Monitor dashboard
   - Verify webhook fires
   - Check funds arrive in bank account (1-2 business days)

---

## Security Checklist

- ✅ Never commit `.env.local` to Git (use `.gitignore`)
- ✅ Keep `PAYSTACK_SECRET_KEY` private (server-side only)
- ✅ Use `PAYSTACK_PUBLIC_KEY` for frontend (it's safe)
- ✅ Always validate webhook signature before processing
- ✅ Use HTTPS in production (Vercel provides this)
- ✅ Don't log secret keys to console
- ✅ Rotate keys if compromised

---

## Support

- **Paystack Documentation**: https://paystack.com/docs
- **API Status**: https://status.paystack.com
- **Support Email**: support@paystack.com
- **Paystack Chat**: Available in dashboard

---

## Next Steps

1. Create Paystack account
2. Get test keys
3. Add to `.env.local`
4. Test with test card
5. Verify webhook works
6. Deploy to Vercel
7. Use live keys when ready
