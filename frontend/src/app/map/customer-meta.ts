export interface CustomerDeliverable {
  id: string;
  title: string;
  category: "website" | "app" | "ai" | "seo" | "ecommerce" | "branding" | "custom";
  status: "completed" | "in_progress" | "planned";
  date?: string;
}

export interface CustomerNoteEntry {
  id: string;
  text: string;
  createdAt: string;
  category?: "general" | "preference" | "requirement" | "meeting";
}

export interface CustomerMeta {
  deliverables: CustomerDeliverable[];
  techStack: string[];
  notes: CustomerNoteEntry[];
}

export const DELIVERABLE_CATEGORIES: Record<
  CustomerDeliverable["category"],
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  website: { label: "Website", icon: "🌐", color: "#34d399", bg: "rgba(6, 78, 59, 0.4)", border: "rgba(16, 185, 129, 0.4)" },
  app: { label: "Web Application", icon: "💻", color: "#38bdf8", bg: "rgba(12, 74, 110, 0.4)", border: "rgba(56, 189, 248, 0.4)" },
  ai: { label: "AI Assistant", icon: "🤖", color: "#c084fc", bg: "rgba(88, 28, 135, 0.4)", border: "rgba(192, 132, 252, 0.4)" },
  seo: { label: "SEO & Maps", icon: "📍", color: "#fbbf24", bg: "rgba(120, 53, 15, 0.4)", border: "rgba(251, 191, 36, 0.4)" },
  ecommerce: { label: "Booking & Payments", icon: "💳", color: "#f43f5e", bg: "rgba(136, 19, 55, 0.4)", border: "rgba(244, 63, 94, 0.4)" },
  branding: { label: "Branding & Identity", icon: "🎨", color: "#f472b6", bg: "rgba(131, 24, 67, 0.4)", border: "rgba(244, 114, 182, 0.4)" },
  custom: { label: "Custom Solution", icon: "⚡", color: "#2dd4bf", bg: "rgba(19, 78, 74, 0.4)", border: "rgba(45, 212, 191, 0.4)" },
};

export const POPULAR_TECH_PRESETS = [
  "Next.js",
  "React",
  "TypeScript",
  "Tailwind CSS",
  "PostgreSQL",
  "Ollama AI",
  "Google Maps API",
  "Stripe",
  "Docker",
  "Vercel",
  "ASP.NET Core",
  "Python",
];

export const PRESET_DELIVERABLE_TEMPLATES: Array<{
  title: string;
  category: CustomerDeliverable["category"];
}> = [
  { title: "Responsive Modern Website", category: "website" },
  { title: "Full Web Application", category: "app" },
  { title: "AI Assistant & Automation", category: "ai" },
  { title: "Online Booking System", category: "ecommerce" },
  { title: "Google Maps & Local SEO", category: "seo" },
  { title: "Brand Identity & Logo", category: "branding" },
];

export function getDefaultCustomerMeta(customerId: number, name: string, company?: string | null): CustomerMeta {
  const isZobir =
    name.toLowerCase().includes("zobir") ||
    (company && company.toLowerCase().includes("studio 22"));

  if (isZobir) {
    return {
      deliverables: [
        {
          id: "del-zobir-1",
          title: "Studio 22 Barber Booking Website",
          category: "website",
          status: "completed",
          date: "Sep 2026",
        },
        {
          id: "del-zobir-2",
          title: "Salon Mobile Web App for Clients",
          category: "app",
          status: "completed",
          date: "Sep 2026",
        },
        {
          id: "del-zobir-3",
          title: "AI Business Operations Assistant",
          category: "ai",
          status: "in_progress",
          date: "Oct 2026",
        },
        {
          id: "del-zobir-4",
          title: "Google Maps & Ballerup Local Presence",
          category: "seo",
          status: "completed",
          date: "Sep 2026",
        },
      ],
      techStack: [
        "Next.js",
        "React",
        "Tailwind CSS",
        "PostgreSQL",
        "Ollama AI",
        "Google Maps API",
        "TypeScript",
      ],
      notes: [
        {
          id: "note-zobir-1",
          text: "Studio 22 Frisør at Centrumgaden 22, 2750 Ballerup. Client requested rapid mobile booking on iPhones and sleek emerald dark mode.",
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          category: "requirement",
        },
        {
          id: "note-zobir-2",
          text: "Prefers direct communication on phone (+45 42 20 18 81) & WhatsApp. Very satisfied with the interactive Denmark customer map.",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          category: "preference",
        },
      ],
    };
  }

  return {
    deliverables: [],
    techStack: [],
    notes: [],
  };
}

const STORAGE_KEY = "ops_hub_customer_meta";

export function loadAllCustomerMeta(): Record<number, CustomerMeta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveAllCustomerMeta(data: Record<number, CustomerMeta>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function getCustomerMeta(customerId: number, name: string, company?: string | null): CustomerMeta {
  const all = loadAllCustomerMeta();
  if (all[customerId]) {
    return all[customerId];
  }
  const defaultMeta = getDefaultCustomerMeta(customerId, name, company);
  if (defaultMeta.deliverables.length > 0 || defaultMeta.techStack.length > 0 || defaultMeta.notes.length > 0) {
    all[customerId] = defaultMeta;
    saveAllCustomerMeta(all);
  }
  return defaultMeta;
}
