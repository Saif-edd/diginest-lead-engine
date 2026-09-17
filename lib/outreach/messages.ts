// ============================================================
// Outreach Copy Engine V2 – Sprint 3B.1
// ============================================================
// Rules:
//   - No invented facts. Every observation must be evidence-backed.
//   - No "Hope you're well", no agency intro, no "optimize your presence".
//   - 3 variants: AGGRESSIVE, CURIOUS, CLEAN.
//   - Subject lines: 2–7 words, pattern-interrupt only if evidence supports it.
//   - WhatsApp: 30–60 words.
//   - Email: 50–90 words.
//   - Instagram: 20–45 words.
//   - Low-friction CTAs only.
// ============================================================

export type CopyVariant = "AGGRESSIVE" | "CURIOUS" | "CLEAN";

export interface MessageContext {
  businessName: string;
  city: string;
  country?: string | null;
  currentWebsite?: string | null;
  mainProblem: string;
  secondaryProblem?: string | null;
  outreachAngle?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  finalPreviewUrl: string;
  previewType?: string | null;
  verifiedServices?: string[];
  channel?: "WHATSAPP" | "EMAIL" | "INSTAGRAM" | "NONE";
}

export interface CopyDraft {
  subject: string | null;    // null for WhatsApp / Instagram
  hook: string;
  message: string;
  cta: string;
  variant: CopyVariant;
  qualityFlags: string[];    // issues flagged by the quality gate
  passed: boolean;           // false if draft needs review
}

export interface AllVariants {
  aggressive: CopyDraft;
  curious: CopyDraft;
  clean: CopyDraft;
  recommended: CopyVariant;
}

// ─── Problem category inference ─────────────────────────────────────────────

type ProblemCategory =
  | "VISUAL_HIERARCHY"
  | "TRUST_BURIED"
  | "CTA_WEAK"
  | "BOOKING_PATH_UNCLEAR"
  | "MOBILE_FIRST_SCREEN"
  | "POPUP_BLOCKING_ENTRY"
  | "GENERIC_HERO"
  | "SERVICE_CLARITY"
  | "LOCAL_TRUST"
  | "OUTDATED_VISUAL_STRUCTURE"
  | "UNKNOWN";

const PROBLEM_KEYWORDS: Record<ProblemCategory, string[]> = {
  VISUAL_HIERARCHY:          ["hierarchy", "layout", "first screen", "above the fold", "structure"],
  TRUST_BURIED:              ["trust", "review", "rating", "buried", "proof", "hidden"],
  CTA_WEAK:                  ["cta", "call to action", "no booking", "book", "button", "next step", "action"],
  BOOKING_PATH_UNCLEAR:      ["booking", "appointment", "calendar", "unclear", "hard to find"],
  MOBILE_FIRST_SCREEN:       ["mobile", "phone", "responsive", "small screen"],
  POPUP_BLOCKING_ENTRY:      ["popup", "banner", "overlay", "modal"],
  GENERIC_HERO:              ["generic", "hero", "stock", "headline", "vague"],
  SERVICE_CLARITY:           ["service", "treatment", "offer", "unclear what"],
  LOCAL_TRUST:               ["local", "area", "neighbourhood", "community", "clinic near"],
  OUTDATED_VISUAL_STRUCTURE: ["outdated", "old", "2015", "2010", "dated", "legacy", "legacy design"],
  UNKNOWN:                   [],
};

function inferProblemCategory(mainProblem: string): ProblemCategory {
  const lower = mainProblem.toLowerCase();
  for (const [cat, keywords] of Object.entries(PROBLEM_KEYWORDS) as [ProblemCategory, string[]][]) {
    if (cat === "UNKNOWN") continue;
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return "UNKNOWN";
}

// ─── Subject line library ────────────────────────────────────────────────────

const SUBJECT_LIBRARY: Record<ProblemCategory, { aggressive: string[]; curious: string[]; clean: string[] }> = {
  VISUAL_HIERARCHY: {
    aggressive: ["Your homepage is fighting you.", "I had to rebuild this.", "This surprised me."],
    curious:    ["Something stood out on your site.", "I rebuilt the first screen.", "I noticed something."],
    clean:      ["Your website structure — a quick thought.", "I rebuilt your homepage layout.", "A quick observation."],
  },
  TRUST_BURIED: {
    aggressive: ["This is hiding your strongest proof.", "I checked this twice.", "You have 4.9 stars. No one can see it."],
    curious:    ["Your best asset is buried.", "I found your strongest proof hidden.", "This surprised me."],
    clean:      ["Your trust signals need to be front and centre.", "A thought on your reviews.", "Quick website feedback."],
  },
  CTA_WEAK: {
    aggressive: ["I couldn't find the next step.", "Your site asks for nothing.", "I had to guess how to book."],
    curious:    ["This shouldn't be this hard to find.", "One thing was missing.", "I looked for a way to book."],
    clean:      ["Your booking path — a quick note.", "One improvement worth seeing.", "A small fix, big impact."],
  },
  BOOKING_PATH_UNCLEAR: {
    aggressive: ["I couldn't find the next step.", "This should take 2 seconds.", "I spent 40 seconds looking."],
    curious:    ["One thing was missing from your site.", "I looked for how to book.", "This shouldn't be this hard."],
    clean:      ["Your booking journey — a quick note.", "Making appointments easier to book.", "A small UX thought."],
  },
  MOBILE_FIRST_SCREEN: {
    aggressive: ["I checked on mobile. Ouch.", "The first screen doesn't convert.", "I had to scroll too much."],
    curious:    ["I opened your site on my phone.", "First impressions matter on mobile.", "I noticed something on mobile."],
    clean:      ["Your mobile experience — a quick thought.", "Mobile first-screen improvement.", "A mobile observation."],
  },
  POPUP_BLOCKING_ENTRY: {
    aggressive: ["I couldn't even see your site.", "This blocks your front door.", "I closed it three times."],
    curious:    ["Something is in the way on your site.", "Your first impression is blocked.", "I noticed something."],
    clean:      ["A note on your site entry experience.", "Reducing friction at the first screen.", "Quick UX feedback."],
  },
  GENERIC_HERO: {
    aggressive: ["I thought this was an old version.", "This could be any clinic.", "I rebuilt the first screen."],
    curious:    ["Your opening section feels generic.", "I rebuilt the hero — you need to see this.", "You need to see what I changed."],
    clean:      ["Your homepage intro — a quick thought.", "I rebuilt your opening section.", "A homepage observation."],
  },
  SERVICE_CLARITY: {
    aggressive: ["I couldn't tell what you offer.", "Your services are invisible.", "I had to guess what you do."],
    curious:    ["What you offer isn't immediately clear.", "I built something that fixes this.", "One thing surprised me."],
    clean:      ["Your services page — a quick thought.", "Making your offer clearer.", "A service clarity note."],
  },
  LOCAL_TRUST: {
    aggressive: ["This doesn't feel local.", "Nothing tells me you're in the area.", "I rebuilt your local section."],
    curious:    ["You're missing local trust signals.", "I noticed something about your location.", "Local trust matters."],
    clean:      ["Strengthening your local presence.", "A note on local trust signals.", "Quick localisation thought."],
  },
  OUTDATED_VISUAL_STRUCTURE: {
    aggressive: ["I thought this was an old version.", "This needs to look like 2025.", "I rebuilt this."],
    curious:    ["The visual structure surprised me.", "I had to rebuild the opening section.", "Something felt off here."],
    clean:      ["A visual structure observation.", "I rebuilt your homepage design.", "A design improvement to show you."],
  },
  UNKNOWN: {
    aggressive: ["I rebuilt part of this.", "You need to see what I changed.", "I had to check this twice."],
    curious:    ["Something stood out on your site.", "I noticed something.", "This surprised me."],
    clean:      ["A quick website observation.", "One thing worth improving.", "A thought on your site."],
  },
};

// ─── Hook library ────────────────────────────────────────────────────────────

const HOOK_LIBRARY: Record<ProblemCategory, { aggressive: string[]; curious: string[]; clean: string[] }> = {
  VISUAL_HIERARCHY: {
    aggressive: ["Your homepage is fighting you.", "The layout is working against your conversions."],
    curious:    ["The first screen stopped me.", "Something in the layout stood out."],
    clean:      ["The opening section of your site caught my attention."],
  },
  TRUST_BURIED: {
    aggressive: ["You have {rating} Google rating and {reviewCount} reviews. Barely visible on your first screen.", "Your strongest social proof is hidden below the fold."],
    curious:    ["I found your strongest trust signal — and it's buried.", "Your reputation isn't showing up where it matters most."],
    clean:      ["Your site has excellent trust signals — they're just not front and centre."],
  },
  CTA_WEAK: {
    aggressive: ["I couldn't find how to book an appointment. I looked twice.", "There's no obvious next step on your site."],
    curious:    ["I looked for a way to contact you. It wasn't obvious.", "The booking path took longer than it should."],
    clean:      ["The appointment booking path on your site could be clearer."],
  },
  BOOKING_PATH_UNCLEAR: {
    aggressive: ["I spent 40 seconds looking for how to book. Patients won't wait that long.", "The booking flow is invisible."],
    curious:    ["I looked for an appointment button. Took a while.", "Booking is harder than it should be."],
    clean:      ["The appointment journey on your site could be more direct."],
  },
  MOBILE_FIRST_SCREEN: {
    aggressive: ["I opened your site on my phone — the first screen doesn't convert.", "Mobile visitors can't find what they need."],
    curious:    ["I checked on mobile. The first screen surprised me.", "Something's off on the mobile view."],
    clean:      ["The mobile experience on your site has room for improvement."],
  },
  POPUP_BLOCKING_ENTRY: {
    aggressive: ["There's a popup blocking the first screen on mobile. Patients are leaving.", "Your front door is blocked."],
    curious:    ["Something is blocking your site entry on first load.", "The popup is the first thing visitors see — before your clinic."],
    clean:      ["The entry experience on your site could be more welcoming."],
  },
  GENERIC_HERO: {
    aggressive: ["Your opening section could be any clinic. It doesn't show what makes you different.", "The homepage hero is too generic to convert."],
    curious:    ["Your opening section doesn't tell me enough about who you are.", "The hero feels like a template."],
    clean:      ["Your homepage introduction has potential to be more specific to your clinic."],
  },
  SERVICE_CLARITY: {
    aggressive: ["I couldn't immediately tell what you specialise in from the homepage.", "Your services aren't clear on the first screen."],
    curious:    ["What you offer isn't obvious within the first few seconds.", "I had to scroll to understand what you do."],
    clean:      ["The services section on your site could be clearer to first-time visitors."],
  },
  LOCAL_TRUST: {
    aggressive: ["Nothing on your homepage tells me you're a local clinic people trust.", "Local trust signals are missing."],
    curious:    ["Your site doesn't immediately signal local credibility.", "Missing something that local patients need to see."],
    clean:      ["There's an opportunity to strengthen local trust signals on your site."],
  },
  OUTDATED_VISUAL_STRUCTURE: {
    aggressive: ["The visual structure feels dated — patients compare clinics, and this loses first impressions.", "Looks like an older version."],
    curious:    ["The design structure surprised me — it doesn't reflect the quality of the clinic.", "The visual hierarchy is holding you back."],
    clean:      ["The current visual structure could be modernised to better reflect your clinic's quality."],
  },
  UNKNOWN: {
    aggressive: ["I noticed something while looking at your site.", "Something stood out when I checked your site."],
    curious:    ["Something caught my attention on your site.", "I noticed one thing worth showing you."],
    clean:      ["While looking at your site, something stood out."],
  },
};

// ─── Observation patterns ────────────────────────────────────────────────────

function buildObservation(ctx: MessageContext, category: ProblemCategory): string {
  const ratingLine = ctx.rating && ctx.reviewCount
    ? `${ctx.rating} Google rating · ${ctx.reviewCount.toLocaleString()} reviews`
    : ctx.rating
      ? `${ctx.rating} Google rating`
      : null;

  const patterns: Record<ProblemCategory, string[]> = {
    TRUST_BURIED: [
      ratingLine ? `${ctx.businessName} has ${ratingLine} — strong social proof. But it doesn't appear prominently on the first screen.` : `${ctx.businessName} has solid proof, but it's not visible on the opening section.`,
    ],
    CTA_WEAK: [
      `There's no prominent booking or contact action visible on the first screen for ${ctx.businessName}.`,
    ],
    BOOKING_PATH_UNCLEAR: [
      ratingLine ? `For a clinic with ${ratingLine}, booking an appointment on your site requires more clicks than most patients will take.` : `Booking an appointment for ${ctx.businessName} requires more clicks than most patients will take.`,
    ],
    MOBILE_FIRST_SCREEN: [
      `On mobile, the first screen for ${ctx.businessName} doesn't lead the visitor to a clear next step.`,
    ],
    POPUP_BLOCKING_ENTRY: [
      `A popup is the first thing visitors see for ${ctx.businessName} — before your clinic brand, before your offer.`,
    ],
    GENERIC_HERO: [
      `The opening section of ${ctx.currentWebsite || "your site"} doesn't immediately tell a visitor what makes ${ctx.businessName} the right choice.`,
    ],
    SERVICE_CLARITY: [
      `The services offered by ${ctx.businessName} aren't clearly visible within the first scroll on your current site.`,
    ],
    LOCAL_TRUST: [
      ratingLine ? `${ctx.businessName} has ${ratingLine} from patients in ${ctx.city} — but this trust isn't visible on the opening section.` : `Local trust signals for ${ctx.businessName} in ${ctx.city} aren't front and centre.`,
    ],
    VISUAL_HIERARCHY: [
      ratingLine ? `You have ${ratingLine}, but that level of trust isn't doing enough work on the first screen due to the current visual hierarchy.` : `The visual hierarchy for ${ctx.businessName} makes it hard for a first-time visitor to know where to look first.`,
    ],
    OUTDATED_VISUAL_STRUCTURE: [
      ratingLine ? `For a clinic with ${ratingLine}, the current visual structure doesn't reflect the quality of care that ${ctx.businessName} provides.` : `The current design structure doesn't reflect the quality of care that ${ctx.businessName} provides.`,
    ],
    UNKNOWN: [
      `Looking at ${ctx.businessName}, I noticed: ${ctx.mainProblem}.`,
    ],
  };

  const options = patterns[category] ?? patterns.UNKNOWN;
  return options[0];
}

// ─── CTA library ─────────────────────────────────────────────────────────────

const LOW_FRICTION_CTAS = [
  "Worth showing you the full direction?",
  "Want me to send the full idea?",
  "Should I show you the rest?",
  "Want the complete version?",
  "Curious to see the full direction?",
  "Worth a look?",
  "Should I walk you through it?",
];

function pickCTA(variant: CopyVariant): string {
  if (variant === "AGGRESSIVE") return LOW_FRICTION_CTAS[0];
  if (variant === "CURIOUS")    return LOW_FRICTION_CTAS[4];
  return LOW_FRICTION_CTAS[1];
}

// ─── Quality gate ────────────────────────────────────────────────────────────

const BANNED_PHRASES = [
  "optimization issues",
  "improve your online presence",
  "boost your business",
  "modern solution",
  "take your website to the next level",
  "we are a web agency",
  "my name is",
  "hope you're well",
  "hope this finds you",
  "i offer website services",
  "satisfied patients",
  "verified reviews",
];

function qualityCheck(draft: string, ctx: MessageContext): string[] {
  const flags: string[] = [];
  const lower = draft.toLowerCase();

  // Must contain preview URL (and URL must be non-empty)
  if (!ctx.finalPreviewUrl || !draft.includes(ctx.finalPreviewUrl)) {
    flags.push("MISSING_PREVIEW_URL");
  }

  // Must not contain banned phrases
  for (const banned of BANNED_PHRASES) {
    if (lower.includes(banned)) {
      flags.push(`BANNED_PHRASE:${banned}`);
    }
  }

  // Must contain a factual observation (city or business name or rating)
  const hasRatingInDraft = ctx.rating && draft.includes(String(ctx.rating));
  const hasFact =
    draft.includes(ctx.businessName) ||
    draft.includes(ctx.city) ||
    hasRatingInDraft ||
    (ctx.reviewCount && draft.includes(String(ctx.reviewCount)));
  if (!hasFact) {
    flags.push("NO_SPECIFIC_FACT");
  }

  // No duplicate sentences
  const sentences = draft.split(/[.!?]\s+/).filter((s) => s.trim().length > 10);
  const seen = new Set<string>();
  for (const s of sentences) {
    const norm = s.trim().toLowerCase();
    if (seen.has(norm)) { flags.push("DUPLICATE_SENTENCE"); break; }
    seen.add(norm);
  }

  return flags;
}

// ─── Template filling ────────────────────────────────────────────────────────

function fillTemplate(template: string, ctx: MessageContext): string {
  return template
    .replace("{businessName}", ctx.businessName)
    .replace("{city}", ctx.city)
    .replace("{rating}", String(ctx.rating ?? ""))
    .replace("{reviewCount}", ctx.reviewCount?.toLocaleString() ?? "")
    .replace("{currentWebsite}", ctx.currentWebsite ?? "your site");
}

// ─── WhatsApp generator ──────────────────────────────────────────────────────

function generateWhatsAppDraft(ctx: MessageContext, variant: CopyVariant): CopyDraft {
  const category = inferProblemCategory(ctx.mainProblem);
  const hooks = HOOK_LIBRARY[category][variant.toLowerCase() as keyof typeof HOOK_LIBRARY[typeof category]];
  const rawHook = hooks[0];
  const hook = fillTemplate(rawHook, ctx);
  const observation = buildObservation(ctx, category);
  const cta = pickCTA(variant);

  const message = `${hook}

${observation}

I rebuilt the opening section to show you what I mean:
${ctx.finalPreviewUrl}

${cta}`;

  const flags = qualityCheck(message, ctx);
  return {
    subject: null,
    hook,
    message,
    cta,
    variant,
    qualityFlags: flags,
    passed: flags.length === 0,
  };
}

// ─── Email generator ─────────────────────────────────────────────────────────

function generateEmailDraft(ctx: MessageContext, variant: CopyVariant): CopyDraft {
  const category = inferProblemCategory(ctx.mainProblem);
  const subjects = SUBJECT_LIBRARY[category][variant.toLowerCase() as keyof typeof SUBJECT_LIBRARY[typeof category]];
  const rawSubject = subjects[0];
  const subject = fillTemplate(rawSubject, ctx);
  const hooks = HOOK_LIBRARY[category][variant.toLowerCase() as keyof typeof HOOK_LIBRARY[typeof category]];
  const rawHook = hooks[0];
  const hook = fillTemplate(rawHook, ctx);
  const observation = buildObservation(ctx, category);
  const cta = pickCTA(variant);

  const message = `${hook}

${observation}

Instead of sending a pitch, I rebuilt the opening section first to show you the direction:
${ctx.finalPreviewUrl}

${cta}`;

  const flags = qualityCheck(message, ctx);
  return {
    subject,
    hook,
    message,
    cta,
    variant,
    qualityFlags: flags,
    passed: flags.length === 0,
  };
}

// ─── Instagram generator ─────────────────────────────────────────────────────

function generateInstagramDraft(ctx: MessageContext, variant: CopyVariant): CopyDraft {
  const category = inferProblemCategory(ctx.mainProblem);
  const hooks = HOOK_LIBRARY[category][variant.toLowerCase() as keyof typeof HOOK_LIBRARY[typeof category]];
  const rawHook = hooks[0];
  const hook = fillTemplate(rawHook, ctx);
  const cta = pickCTA(variant);

  const message = `${hook}

I rebuilt the first section of your site to show you:
${ctx.finalPreviewUrl}

${cta}`;

  const flags = qualityCheck(message, ctx);
  return {
    subject: null,
    hook,
    message,
    cta,
    variant,
    qualityFlags: flags,
    passed: flags.length === 0,
  };
}

// ─── Three-variant generator (main export) ───────────────────────────────────

export function generateAllVariants(
  ctx: MessageContext,
  channel: "WHATSAPP" | "EMAIL" | "INSTAGRAM" | "NONE" = "WHATSAPP",
): AllVariants {
  const gen =
    channel === "WHATSAPP" ? generateWhatsAppDraft
    : channel === "EMAIL"  ? generateEmailDraft
    : generateInstagramDraft;

  const aggressive = gen(ctx, "AGGRESSIVE");
  const curious    = gen(ctx, "CURIOUS");
  const clean      = gen(ctx, "CLEAN");

  // Recommend: if rating exists and is ≥4.5 with >100 reviews, CURIOUS is
  // more credible (trust-anchor). Otherwise AGGRESSIVE. Clean is always fallback.
  const recommended: CopyVariant =
    ctx.rating && ctx.rating >= 4.5 && (ctx.reviewCount ?? 0) > 100
      ? "CURIOUS"
      : "AGGRESSIVE";

  return { aggressive, curious, clean, recommended };
}

// ─── Legacy API (backward-compat) ────────────────────────────────────────────

export function generateHook(ctx: MessageContext): string {
  return generateWhatsAppDraft(ctx, "CURIOUS").hook;
}

export function generateWhatsAppMessage(ctx: MessageContext): string {
  return generateWhatsAppDraft(ctx, "CURIOUS").message;
}

export function generateEmailSubject(ctx: MessageContext): string {
  return generateEmailDraft(ctx, "CURIOUS").subject ?? "I rebuilt part of your site";
}

export function generateEmailBody(ctx: MessageContext): string {
  return generateEmailDraft(ctx, "CURIOUS").message;
}

export function generateInstagramDM(ctx: MessageContext): string {
  return generateInstagramDraft(ctx, "CURIOUS").message;
}

// ─── Deep-link helpers ───────────────────────────────────────────────────────

export function getWhatsAppDeepLink(phone: string, text: string): string | null {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.length < 5) return null;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export function getEmailMailto(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}


