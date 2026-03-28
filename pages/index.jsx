import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-ABUSE: Device Fingerprint (Layer 1)
// ─────────────────────────────────────────────────────────────────────────────
function getDeviceFingerprint() {
  const nav = window.navigator;
  const scr = window.screen;
  const parts = [
    nav.userAgent, nav.language, nav.platform || "",
    scr.width + "x" + scr.height, scr.colorDepth,
    new Date().getTimezoneOffset(),
    nav.hardwareConcurrency || "",
    nav.maxTouchPoints || "",
  ];
  let hash = 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  return "d_" + Math.abs(hash).toString(36);
}

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-ABUSE: IP Hash (Layer 2)
// ─────────────────────────────────────────────────────────────────────────────
async function getIPKey() {
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const ip = data.ip || "unknown";
    let hash = 0;
    for (let i = 0; i < ip.length; i++) hash = (Math.imul(31, hash) + ip.charCodeAt(i)) | 0;
    return "ip_" + Math.abs(hash).toString(36);
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// USAGE TRACKING
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = "rp_v2";
const PRO_EMAIL_KEY = "rp_pro_email";
const FREE_LIMIT = 3;

function getUsage(keys) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Math.max(...keys.filter(Boolean).map(k => data[k] || 0), 0);
  } catch { return 0; }
}

function incrementUsage(keys) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    keys.filter(Boolean).forEach(k => { data[k] = (data[k] || 0) + 1; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return Math.max(...keys.filter(Boolean).map(k => data[k]));
  } catch { return FREE_LIMIT; }
}

function saveProEmail(email) {
  localStorage.setItem(PRO_EMAIL_KEY, email.toLowerCase());
}

function getSavedProEmail() {
  return localStorage.getItem(PRO_EMAIL_KEY) || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYSTACK HELPERS
// ─────────────────────────────────────────────────────────────────────────────
async function createCheckoutSession(email) {
  const res = await fetch("/api/create-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else throw new Error(data.error || "Failed to start checkout");
}

async function verifyProStatus(email) {
  try {
    const res = await fetch(`/api/verify-pro?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    return data.pro === true;
  } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM CONFIG & PROMPTS
// ─────────────────────────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: "linkedin",   label: "LinkedIn",    color: "#0A84FF", emoji: "💼" },
  { id: "twitter",    label: "X / Twitter", color: "#C8C8C8", emoji: "𝕏" },
  { id: "instagram",  label: "Instagram",   color: "#E1306C", emoji: "📸" },
  { id: "newsletter", label: "Newsletter",  color: "#F4A11D", emoji: "📧" },
  { id: "shorts",     label: "YT Shorts",   color: "#FF4444", emoji: "🎬" },
];

const PROMPTS = {
  linkedin: `You are an elite LinkedIn ghostwriter for top creators and executives.
Transform the content into a high-performing LinkedIn post.
RULES:
- Line 1: Bold punchy hook that stops the scroll. No "I" starts. Make it contrarian or surprising.
- Body: Short punchy paragraphs, max 2 lines each, double line breaks between them
- 3-5 emojis used ONLY where they add meaning — not decoration
- End with ONE thought-provoking question directed at the reader
- 5 niche hashtags on the final line
- Max 1800 characters total
Output ONLY the post text. Zero commentary or preamble.`,

  twitter: `You are a viral Twitter/X thread ghostwriter.
Transform the content into a high-engagement thread.
RULES:
- Tweet 1 (HOOK): Max 240 chars. Creates immediate curiosity or delivers a shock stat. NO hashtags. End with "🧵"
- Tweets 2-8: Each is a self-contained insight or story beat. Numbered "2/" "3/" etc.
- Tweet 9 (CLOSER): Core lesson in 1 punchy line + CTA to follow
- Max 280 chars per tweet. Line breaks within tweets for readability.
Output ONLY the thread. Each tweet separated by a blank line. No preamble.`,

  instagram: `You are a top Instagram caption strategist.
Transform the content into a high-engagement Instagram caption.
RULES:
- Line 1 (HOOK, max 125 chars): Must make someone stop scrolling and tap "more"
- Body: Compelling micro-story OR 3-5 punchy insights, written conversationally
- Emojis woven naturally inline
- CTA: Specific question or clear action on its own line
- Blank line then 6 dots then hashtag block: 25 niche hashtags
Output ONLY the caption. No preamble.`,

  newsletter: `You are a world-class newsletter writer (Morning Brew energy, personal essay depth).
Transform the content into a compelling newsletter segment.
FORMAT:
[SUBJECT: subject line]
[PREVIEW: max 90 char preview]

Opening hook (2 sentences, use "you" not "we")

**Bold Subheading 1**
Content...

**Bold Subheading 2**
Content...

💡 KEY TAKEAWAY: One sentence.

[CTA: specific action]

RULES: Short sentences. Contractions. Zero corporate speak.
Output ONLY the newsletter segment. No preamble.`,

  shorts: `You are a top YouTube Shorts scriptwriter.
Transform the content into a punchy vertical video script.

[HOOK — 0 to 3s]
On-screen text: ...
Voiceover: ...

[SETUP — 3 to 10s]
Voiceover: ...

[POINT 1 — 10 to 22s]
[VISUAL: ...]
Voiceover: ...

[POINT 2 — 22 to 35s]
[VISUAL: ...]
Voiceover: ...

[POINT 3 — 35 to 45s]
[VISUAL: ...]
Voiceover: ...

[CTA — 45 to 55s]
On-screen text: ...
Voiceover: ...

RULES: Natural speech. Contractions. Punchy. ~55 seconds total.
Output ONLY the script. No preamble.`,
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  card: {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16, padding: 24,
  },
  label: {
    fontSize: 10, letterSpacing: "2px",
    textTransform: "uppercase", color: "#484848",
    marginBottom: 12, display: "block",
  },
  btn: (variant = "ghost") => ({
    primary: {
      padding: "17px 0", width: "100%", borderRadius: 10,
      background: "linear-gradient(135deg, #FFDC64, #FF6B35)",
      border: "none", color: "#09090C",
      fontSize: 14, fontWeight: 800, cursor: "pointer",
    },
    ghost: {
      padding: "8px 16px", borderRadius: 6,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      color: "#888", fontSize: 12, cursor: "pointer",
    },
    danger: {
      padding: "7px 14px", borderRadius: 6,
      background: "rgba(255,90,90,0.08)",
      border: "1px solid rgba(255,90,90,0.2)",
      color: "#FF5A5A", fontSize: 11, cursor: "pointer",
    },
  }[variant]),
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL WRAPPER
// ─────────────────────────────────────────────────────────────────────────────
function Modal({ onClose, children, borderColor = "rgba(255,220,100,0.18)" }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.88)", backdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#0F0F14", border: `1px solid ${borderColor}`,
        borderRadius: 22, padding: "44px 36px",
        maxWidth: 400, width: "100%", textAlign: "center",
      }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function RepurposeAI() {
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState(["linkedin", "twitter", "instagram", "newsletter", "shorts"]);
  const [results, setResults] = useState({});
  const [generating, setGenerating] = useState({});
  const [activeTab, setActiveTab] = useState(null);

  // Auth / usage state
  const [isPro, setIsPro] = useState(false);
  const [proEmail, setProEmail] = useState("");
  const [usageCount, setUsageCount] = useState(0);
  const [abuseKeys, setAbuseKeys] = useState([]);
  const [ipStatus, setIpStatus] = useState("checking");

  // Modal state
  const [modal, setModal] = useState(null); // null | "upgrade" | "email-login" | "checkout-loading" | "abuse" | "success" | "verify-email"

  // Upgrade flow state
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  // Verify-after-payment flow
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  const [copied, setCopied] = useState(null);

  // ── INIT ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Build anti-abuse keys
    const deviceFp = getDeviceFingerprint();
    getIPKey().then(ipKey => {
      const keys = [deviceFp, ipKey].filter(Boolean);
      setAbuseKeys(keys);
      setUsageCount(getUsage(keys));
      setIpStatus(ipKey ? "ready" : "fallback");
    });

    // Check if returning from Paystack checkout
    const params = new URLSearchParams(window.location.search);
    const upgraded = params.get("upgraded");
    const emailParam = params.get("email");

    if (upgraded === "true" && emailParam) {
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
      // Auto-verify the returning user
      handleReturnFromPaystack(emailParam);
    } else if (params.get("cancelled") === "true") {
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Check saved Pro email from previous session
    const saved = getSavedProEmail();
    if (saved) {
      verifyProStatus(saved).then(ok => {
        if (ok) {
          setIsPro(true);
          setProEmail(saved);
        } else {
          localStorage.removeItem(PRO_EMAIL_KEY);
        }
      });
    }
  }, []);

  async function handleReturnFromPaystack(email) {
    setModal("checkout-loading");
    // Give Paystack webhook a moment to process
    await new Promise(r => setTimeout(r, 2000));
    const ok = await verifyProStatus(email);
    if (ok) {
      saveProEmail(email);
      setIsPro(true);
      setProEmail(email);
      setModal("success");
    } else {
      // Webhook may still be in flight — show manual verify screen
      setVerifyEmail(email);
      setModal("verify-email");
    }
  }

  // ── COMPUTED ──────────────────────────────────────────────────────────────
  const remaining = Math.max(0, FREE_LIMIT - usageCount);
  const isBlocked = !isPro && usageCount >= FREE_LIMIT;
  const isBusy = Object.values(generating).some(Boolean);
  const hasResults = Object.keys(results).length > 0;
  const activePlatform = PLATFORMS.find(p => p.id === activeTab);

  // ── ACTIONS ───────────────────────────────────────────────────────────────
  function togglePlatform(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  async function generateOne(platform, content) {
    setGenerating(prev => ({ ...prev, [platform]: true }));
    setActiveTab(prev => prev || platform);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: PROMPTS[platform],
          messages: [{
            role: "user",
            content: `SOURCE CONTENT:\n---\n${content}\n---\n\nRepurpose this now following your instructions exactly.`,
          }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "Something went wrong — please try again.";
      setResults(prev => ({ ...prev, [platform]: text }));
    } catch (e) {
      setResults(prev => ({ ...prev, [platform]: `⚠️ Error: ${e.message}` }));
    } finally {
      setGenerating(prev => ({ ...prev, [platform]: false }));
    }
  }

  async function handleRepurpose() {
    if (!input.trim() || selected.length === 0) return;

    const freshCount = getUsage(abuseKeys);
    if (!isPro && freshCount >= FREE_LIMIT) {
      setUsageCount(freshCount);
      const ipBlocked = abuseKeys.some(k => k.startsWith("ip_"));
      setModal(ipBlocked ? "abuse" : "upgrade");
      return;
    }

    const newCount = incrementUsage(abuseKeys);
    setUsageCount(newCount);
    setResults({});
    setActiveTab(null);
    await Promise.all(selected.map(p => generateOne(p, input)));
  }

  // ── PAYSTACK CHECKOUT ──────────────────────────────────────────────────────
  async function startCheckout() {
    if (!upgradeEmail || !upgradeEmail.includes("@")) {
      setCheckoutError("Please enter a valid email address.");
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      await createCheckoutSession(upgradeEmail);
      // Page will redirect — no need to handle success here
    } catch (e) {
      setCheckoutError(e.message || "Something went wrong. Please try again.");
      setCheckoutLoading(false);
    }
  }

  // ── MANUAL VERIFY (if webhook was slow) ──────────────────────────────────
  async function handleManualVerify() {
    if (!verifyEmail.includes("@")) {
      setVerifyError("Please enter the email you paid with.");
      return;
    }
    setVerifying(true);
    setVerifyError("");
    const ok = await verifyProStatus(verifyEmail);
    setVerifying(false);
    if (ok) {
      saveProEmail(verifyEmail);
      setIsPro(true);
      setProEmail(verifyEmail);
      setModal("success");
    } else {
      setVerifyError("No active subscription found for this email. If you just paid, wait 30 seconds and try again.");
    }
  }

  // ── SIGN OUT PRO ──────────────────────────────────────────────────────────
  function signOutPro() {
    localStorage.removeItem(PRO_EMAIL_KEY);
    setIsPro(false);
    setProEmail("");
  }

  function copy(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#09090C", color: "#E4E0D4", fontFamily: "'Georgia', 'Times New Roman', serif" }}>

      {/* Grid background */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage:
          "linear-gradient(rgba(255,220,100,0.025) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(255,220,100,0.025) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }} />

      {/* ── HEADER ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(9,9,12,0.94)", backdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(255,220,100,0.08)",
        height: 58, padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: "linear-gradient(135deg, #FFDC64, #FF6B35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 13, color: "#09090C",
          }}>✦</div>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px" }}>
            repurpose<span style={{ color: "#FFDC64" }}>.ai</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* IP status */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#3A3A3A" }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: ipStatus === "ready" ? "#34C759" : ipStatus === "checking" ? "#FFDC64" : "#3A3A3A",
              boxShadow: ipStatus === "ready" ? "0 0 6px #34C75966" : "none",
              transition: "all 0.4s",
            }} />
            {ipStatus === "ready" ? "Protected" : ipStatus === "checking" ? "Checking…" : "Device only"}
          </div>

          {isPro ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 20,
                color: "#34C759", border: "1px solid rgba(52,199,89,0.25)",
                background: "rgba(52,199,89,0.06)",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <span>✦</span> Pro · {proEmail}
              </div>
              <button onClick={signOutPro} style={{ ...S.btn("ghost"), fontSize: 10, padding: "4px 8px" }}>
                Sign out
              </button>
            </div>
          ) : (
            <>
              <div style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 20,
                color: remaining > 0 ? "#FFDC64" : "#FF5A5A",
                border: `1px solid ${remaining > 0 ? "rgba(255,220,100,0.2)" : "rgba(255,90,90,0.2)"}`,
                background: remaining > 0 ? "rgba(255,220,100,0.05)" : "rgba(255,90,90,0.05)",
              }}>
                {remaining > 0 ? `${remaining} free left` : "Limit reached"}
              </div>
              <button onClick={() => setModal("upgrade")} style={{
                padding: "7px 15px", borderRadius: 7,
                background: "linear-gradient(135deg, #FFDC64, #FF6B35)",
                border: "none", color: "#09090C",
                fontSize: 11, fontWeight: 800, cursor: "pointer",
              }}>
                PRO · $9/mo
              </button>
            </>
          )}
        </div>
      </header>

      <main style={{ position: "relative", zIndex: 1, maxWidth: 880, margin: "0 auto", padding: "52px 20px 100px" }}>

        {/* ── HERO ── */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 10, letterSpacing: "2.5px", textTransform: "uppercase",
            color: "#FFDC64", border: "1px solid rgba(255,220,100,0.18)",
            borderRadius: 20, padding: "5px 14px", marginBottom: 22,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#FFDC64", display: "inline-block" }} />
            AI Content Engine
          </div>
          <h1 style={{
            fontSize: "clamp(38px,7vw,66px)", fontWeight: 700,
            lineHeight: 1.04, letterSpacing: "-2.5px",
            margin: "0 0 18px",
          }}>
            One piece of content.<br />
            <span style={{
              background: "linear-gradient(95deg, #FFDC64 10%, #FF6B35 90%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Five platforms. Instantly.</span>
          </h1>
          <p style={{ color: "#525252", fontSize: 15, lineHeight: 1.75, maxWidth: 420, margin: "0 auto" }}>
            Paste any content and get platform-perfect posts for LinkedIn, X, Instagram, Newsletter & YouTube Shorts in one click.
          </p>
        </div>

        {/* ── INPUT ── */}
        <div style={{ ...S.card, marginBottom: 16 }}>
          <span style={S.label}>Your source content</span>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={"Paste your blog post, podcast transcript, newsletter draft, or raw idea here…\n\nThe more context you give, the sharper the outputs."}
            rows={9}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: 16,
              color: "#E4E0D4", fontSize: 14, lineHeight: 1.75,
              resize: "vertical", outline: "none",
              fontFamily: "inherit", transition: "border-color 0.2s",
            }}
            onFocus={e => (e.target.style.borderColor = "rgba(255,220,100,0.3)")}
            onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.06)")}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "#383838" }}>
              {input.length > 0 ? `${input.length.toLocaleString()} chars` : "Tip: 200–3000 chars works best"}
            </span>
            {input.length > 0 && (
              <button onClick={() => setInput("")} style={{ fontSize: 11, color: "#444", background: "none", border: "none", cursor: "pointer" }}>
                Clear ✕
              </button>
            )}
          </div>
        </div>

        {/* ── PLATFORM SELECTOR ── */}
        <div style={{ marginBottom: 22 }}>
          <span style={S.label}>Output platforms — {selected.length} of 5 selected</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PLATFORMS.map(p => {
              const on = selected.includes(p.id);
              return (
                <button key={p.id} onClick={() => togglePlatform(p.id)} style={{
                  padding: "10px 18px", borderRadius: 8, fontSize: 13,
                  border: on ? `1px solid ${p.color}44` : "1px solid rgba(255,255,255,0.06)",
                  background: on ? `${p.color}12` : "rgba(255,255,255,0.02)",
                  color: on ? p.color : "#525252",
                  fontWeight: on ? 600 : 400,
                  cursor: "pointer", transition: "all 0.17s",
                  display: "flex", alignItems: "center", gap: 7,
                }}>
                  <span style={{ fontSize: 15 }}>{p.emoji}</span>
                  {p.label}
                  {on && <span style={{ fontSize: 9, opacity: 0.55 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── REPURPOSE BUTTON ── */}
        <button
          onClick={handleRepurpose}
          disabled={isBusy || !input.trim() || selected.length === 0}
          style={{
            width: "100%", padding: 19, borderRadius: 12, border: "none",
            background: (isBusy || !input.trim() || selected.length === 0)
              ? "rgba(255,220,100,0.08)" : "linear-gradient(135deg, #FFDC64, #FF6B35)",
            color: (isBusy || !input.trim() || selected.length === 0) ? "#3A3A3A" : "#09090C",
            fontSize: 15, fontWeight: 800, letterSpacing: "0.2px",
            cursor: (isBusy || !input.trim() || selected.length === 0) ? "not-allowed" : "pointer",
            marginBottom: 52, transition: "all 0.25s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          {isBusy
            ? <><span style={{ display: "inline-block", animation: "spin 0.9s linear infinite" }}>✦</span> Generating {selected.length} platform{selected.length > 1 ? "s" : ""}…</>
            : `✦  Repurpose → ${selected.length} Platform${selected.length !== 1 ? "s" : ""}`}
        </button>

        {/* ── RESULTS ── */}
        {hasResults && (
          <div>
            <span style={S.label}>Your repurposed content</span>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: -1 }}>
              {PLATFORMS.filter(p => results[p.id] || generating[p.id]).map(p => {
                const active = activeTab === p.id;
                return (
                  <button key={p.id} onClick={() => setActiveTab(p.id)} style={{
                    padding: "9px 15px", borderRadius: "8px 8px 0 0",
                    border: `1px solid ${active ? p.color + "44" : "rgba(255,255,255,0.06)"}`,
                    borderBottom: active ? "1px solid #09090C" : "1px solid rgba(255,255,255,0.06)",
                    background: active ? "rgba(255,255,255,0.035)" : "transparent",
                    color: active ? p.color : "#525252",
                    fontSize: 12, fontWeight: active ? 700 : 400,
                    cursor: "pointer", transition: "all 0.14s",
                    marginBottom: active ? -1 : 0,
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    {p.emoji} {p.label}
                    {generating[p.id] && <span style={{ display: "inline-block", animation: "spin 0.7s linear infinite", fontSize: 10 }}>◌</span>}
                  </button>
                );
              })}
            </div>

            {activeTab && (
              <div style={{
                background: "rgba(255,255,255,0.025)",
                border: `1px solid ${activePlatform?.color + "33" || "rgba(255,255,255,0.06)"}`,
                borderRadius: "0 8px 8px 8px", padding: 28, minHeight: 200,
              }}>
                {generating[activeTab] ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#404040" }}>
                    <div style={{ fontSize: 28, animation: "pulse 1.4s ease-in-out infinite", marginBottom: 10 }}>✦</div>
                    <div style={{ fontSize: 13 }}>Crafting your {activePlatform?.label} content…</div>
                  </div>
                ) : results[activeTab] ? (
                  <>
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      marginBottom: 20, paddingBottom: 14,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{activePlatform?.emoji}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: activePlatform?.color }}>{activePlatform?.label}</span>
                        <span style={{ fontSize: 11, color: "#383838" }}>· {results[activeTab].length.toLocaleString()} chars</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => !isBusy && generateOne(activeTab, input)} disabled={isBusy} style={S.btn("ghost")}>
                          ↺ Regenerate
                        </button>
                        <button onClick={() => copy(results[activeTab], activeTab)} style={{
                          ...S.btn("ghost"),
                          background: copied === activeTab ? "rgba(52,199,89,0.1)" : undefined,
                          border: copied === activeTab ? "1px solid rgba(52,199,89,0.3)" : undefined,
                          color: copied === activeTab ? "#34C759" : undefined,
                        }}>
                          {copied === activeTab ? "✓ Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                    <pre style={{
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                      fontSize: 14, lineHeight: 1.85, color: "#D4D0C4",
                      margin: 0, fontFamily: "inherit",
                    }}>
                      {results[activeTab]}
                    </pre>
                  </>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Trust bar */}
        <div style={{ marginTop: 72, display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
          {["🔒 IP + device protected", "⚡ Claude AI · Real-time", "✦ 5 platforms · 1 click", "💳 Paystack · Secure payments"].map(t => (
            <span key={t} style={{ fontSize: 11, color: "#333" }}>{t}</span>
          ))}
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════ */}

      {/* UPGRADE MODAL — email capture + checkout */}
      {modal === "upgrade" && (
        <Modal onClose={() => { setModal(null); setCheckoutError(""); setUpgradeEmail(""); }}>
          <div style={{
            width: 54, height: 54, borderRadius: 14,
            background: "linear-gradient(135deg, #FFDC64, #FF6B35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, margin: "0 auto 20px", color: "#09090C", fontWeight: 900,
          }}>✦</div>

          <h2 style={{ fontSize: 22, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
            Upgrade to Pro
          </h2>
          <p style={{ color: "#5A5A5A", fontSize: 13, lineHeight: 1.7, margin: "0 0 24px" }}>
            Unlimited repurposing across all 5 platforms. Cancel anytime.
          </p>

          {/* Price */}
          <div style={{
            background: "rgba(255,220,100,0.05)",
            border: "1px solid rgba(255,220,100,0.12)",
            borderRadius: 12, padding: "16px 20px", marginBottom: 22,
            display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6,
          }}>
            <span style={{ fontSize: 42, fontWeight: 700, color: "#FFDC64", letterSpacing: "-2px" }}>$9</span>
            <span style={{ fontSize: 13, color: "#525252" }}>/month · cancel anytime</span>
          </div>

          {/* Features */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 24 }}>
            {["✓ Unlimited repurposes", "✓ All 5 platforms", "✓ Priority generation", "✓ Regenerate any time", "✓ New formats monthly", "✓ API access (soon)"].map(f => (
              <div key={f} style={{
                fontSize: 11, color: "#888", textAlign: "left",
                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 6, padding: "7px 10px",
              }}>{f}</div>
            ))}
          </div>

          {/* Email input */}
          <div style={{ marginBottom: 12, textAlign: "left" }}>
            <label style={{ fontSize: 11, color: "#525252", display: "block", marginBottom: 6, letterSpacing: "1px", textTransform: "uppercase" }}>
              Your email address
            </label>
            <input
              type="email"
              value={upgradeEmail}
              onChange={e => { setUpgradeEmail(e.target.value); setCheckoutError(""); }}
              onKeyDown={e => e.key === "Enter" && startCheckout()}
              placeholder="you@example.com"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,0.04)",
                border: checkoutError ? "1px solid rgba(255,90,90,0.4)" : "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "12px 14px",
                color: "#E4E0D4", fontSize: 14, outline: "none",
                fontFamily: "inherit", transition: "border-color 0.2s",
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(255,220,100,0.35)")}
              onBlur={e => (e.target.style.borderColor = checkoutError ? "rgba(255,90,90,0.4)" : "rgba(255,255,255,0.1)")}
            />
            {checkoutError && (
              <div style={{ fontSize: 11, color: "#FF5A5A", marginTop: 6 }}>{checkoutError}</div>
            )}
          </div>

          <button
            onClick={startCheckout}
            disabled={checkoutLoading}
            style={{
              ...S.btn("primary"),
              opacity: checkoutLoading ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {checkoutLoading
              ? <><span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>✦</span> Redirecting to Paystack…</>
              : "Continue to Secure Checkout →"
            }
          </button>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 }}>
            <span style={{ fontSize: 11, color: "#383838" }}>🔒 Powered by Paystack · 256-bit SSL</span>
          </div>

          {/* Already paid? */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <button onClick={() => { setModal("verify-email"); setVerifyEmail(upgradeEmail); }} style={{
              background: "none", border: "none", color: "#525252",
              fontSize: 12, cursor: "pointer", textDecoration: "underline",
            }}>
              Already paid? Restore Pro access →
            </button>
          </div>

          <button onClick={() => { setModal(null); setCheckoutError(""); setUpgradeEmail(""); }} style={{
            background: "none", border: "none", color: "#404040",
            fontSize: 11, marginTop: 14, cursor: "pointer",
          }}>Maybe later</button>
        </Modal>
      )}

      {/* CHECKOUT LOADING (auto-verifying after Paystack return) */}
      {modal === "checkout-loading" && (
        <Modal onClose={() => {}}>
          <div style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 36, animation: "pulse 1.2s ease-in-out infinite", marginBottom: 16 }}>✦</div>
            <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>Verifying your payment…</h2>
            <p style={{ color: "#5A5A5A", fontSize: 13 }}>Just a moment while we confirm with Paystack.</p>
          </div>
        </Modal>
      )}

      {/* SUCCESS MODAL */}
      {modal === "success" && (
        <Modal onClose={() => setModal(null)} borderColor="rgba(52,199,89,0.25)">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 22, margin: "0 0 8px", color: "#34C759" }}>Welcome to Pro!</h2>
          <p style={{ color: "#5A5A5A", fontSize: 13, lineHeight: 1.7, margin: "0 0 24px" }}>
            You now have unlimited repurposing across all 5 platforms. Start creating.
          </p>
          <button onClick={() => setModal(null)} style={S.btn("primary")}>
            Start Repurposing ✦
          </button>
        </Modal>
      )}

      {/* VERIFY EMAIL MODAL (restore access / webhook delay) */}
      {modal === "verify-email" && (
        <Modal onClose={() => setModal(null)}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "rgba(255,220,100,0.1)", border: "1px solid rgba(255,220,100,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, margin: "0 auto 20px",
          }}>🔑</div>
          <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>Restore Pro Access</h2>
          <p style={{ color: "#5A5A5A", fontSize: 13, lineHeight: 1.7, margin: "0 0 22px" }}>
            Enter the email address you used when you subscribed.
          </p>

          <div style={{ marginBottom: 12, textAlign: "left" }}>
            <input
              type="email"
              value={verifyEmail}
              onChange={e => { setVerifyEmail(e.target.value); setVerifyError(""); }}
              onKeyDown={e => e.key === "Enter" && handleManualVerify()}
              placeholder="you@example.com"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,0.04)",
                border: verifyError ? "1px solid rgba(255,90,90,0.4)" : "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "12px 14px",
                color: "#E4E0D4", fontSize: 14, outline: "none",
                fontFamily: "inherit",
              }}
            />
            {verifyError && (
              <div style={{ fontSize: 11, color: "#FF5A5A", marginTop: 6, lineHeight: 1.5 }}>{verifyError}</div>
            )}
          </div>

          <button
            onClick={handleManualVerify}
            disabled={verifying}
            style={{
              ...S.btn("primary"),
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: verifying ? 0.7 : 1,
            }}
          >
            {verifying
              ? <><span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>✦</span> Checking…</>
              : "Verify & Restore Access"
            }
          </button>

          <button onClick={() => setModal(null)} style={{
            background: "none", border: "none", color: "#404040",
            fontSize: 11, marginTop: 14, cursor: "pointer",
          }}>Cancel</button>
        </Modal>
      )}

      {/* ABUSE WALL */}
      {modal === "abuse" && (
        <Modal onClose={() => {}} borderColor="rgba(255,90,90,0.2)">
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, margin: "0 0 10px", color: "#FF5A5A" }}>Network limit reached</h2>
          <p style={{ color: "#5A5A5A", fontSize: 13, lineHeight: 1.7, margin: "0 0 24px" }}>
            Your network has already used all 3 free repurposes. Upgrade to Pro for unlimited access.
          </p>
          <button onClick={() => { setModal("upgrade"); }} style={S.btn("primary")}>
            Upgrade to Pro — $9/month →
          </button>
        </Modal>
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:.3; } 50% { opacity:1; } }
        * { box-sizing: border-box; }
        ::selection { background: rgba(255,220,100,0.2); }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #09090C; }
        ::-webkit-scrollbar-thumb { background: #1E1E1E; border-radius: 4px; }
        textarea::placeholder { color: #2A2A2A; line-height: 1.75; }
        input::placeholder { color: #383838; }
      `}</style>
    </div>
  );
}
