export interface MessageContext {
  businessName: string;
  city: string;
  mainProblem: string;
  finalPreviewUrl: string;
}

export function generateHook(ctx: MessageContext): string {
  const hooks = [
    "I had to check this twice...",
    "This surprised me...",
    "You need to see this",
    "I rebuilt part of this",
    "Something felt off here",
    "I noticed something on your site"
  ];
  return hooks[Math.floor(Math.random() * hooks.length)];
}

export function generateWhatsAppMessage(ctx: MessageContext, hook: string): string {
  return `${hook}

I noticed that ${ctx.mainProblem}.

I actually rebuilt the first part of your website to show you what I mean:
${ctx.finalPreviewUrl}

No commitment — just wanted to show you the direction.

Worth sending you the full idea?`;
}

export function generateEmailSubject(ctx: MessageContext): string {
  const subjects = [
    "I had to check this twice",
    "This surprised me...",
    "I rebuilt part of your site",
    "You need to see this"
  ];
  return subjects[Math.floor(Math.random() * subjects.length)];
}

export function generateEmailBody(ctx: MessageContext, hook: string): string {
  return `Hi,

${hook}

I was looking at the site for ${ctx.businessName} and noticed that ${ctx.mainProblem}.

I already rebuilt part of the site to show you how this could be fixed.

You can see the preview here:
${ctx.finalPreviewUrl}

Worth sending you the full idea?

Best,
Saif`;
}

export function generateInstagramDM(ctx: MessageContext): string {
  return `Hey — I noticed ${ctx.mainProblem} on your website.

I actually rebuilt the first part to show you what I mean:
${ctx.finalPreviewUrl}

If you want, I can send you the full direction.`;
}

export function getWhatsAppDeepLink(phone: string, text: string): string | null {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.length < 5) return null;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export function getEmailMailto(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
