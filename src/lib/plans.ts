// Software subscription plans. Prices are configurable placeholders and
// NEVER include professional fees, which are quoted separately by professionals.
export type Plan = {
  id: string;
  name: string;
  audience: string;
  price: string;
  interval: string;
  features: string[];
  limits: string;
  cta: string;
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  { id: "free", name: "Free Account", audience: "Individuals", price: "₹0", interval: "forever", features: ["Browse services and professionals", "Submit service requests", "Secure document storage", "Request tracking & messaging"], limits: "Up to 100 MB document storage", cta: "Create free account" },
  { id: "essentials", name: "Business Essentials", audience: "Small businesses", price: "To be announced", interval: "per month", features: ["Everything in Free", "Compliance calendar reminders", "Multiple team members", "Priority support queue"], limits: "Up to 2 GB storage · 3 users", cta: "Join waitlist", highlight: true },
  { id: "plus", name: "Business Plus", audience: "Growing companies", price: "To be announced", interval: "per month", features: ["Everything in Essentials", "Multiple business entities", "Advanced document organisation", "Dedicated support contact"], limits: "Up to 10 GB storage · 10 users", cta: "Join waitlist" },
  { id: "pro", name: "Professional Workspace", audience: "CAs, advocates, CSs", price: "To be announced", interval: "per month", features: ["Profile & credential verification", "Engagement & document workflow", "Appointment management", "Secure client messaging"], limits: "Software subscription only — no lead fees or referral charges", cta: "Join as a Professional" },
];

export const GST_NOTE = "Paid plan prices will be shown exclusive of GST, with applicable GST added at checkout.";
