// DEMO profiles only — fictional, for illustrating the directory layout.
// They are never shown as verified and cannot receive real requests.
export type DirectoryPro = {
  key: string;
  name: string;
  category: string;
  qualifications: string;
  registration: string | null;
  verification: "verified" | "pending" | "not_submitted" | "rejected";
  experience: number | null;
  languages: string[];
  state: string;
  city: string;
  modes: string[];
  expertise: string[];
  description: string;
  demo: boolean;
  membership?: string | null;
  cop?: string | null;
  photo?: string | null;
  availability?: string | null;
  feeFrom?: number | null;
  feeTo?: number | null;
};

export const DEMO_PROS: DirectoryPro[] = [
  { key: "demo-1", name: "Demo Professional A", category: "Chartered Accountant", qualifications: "Sample qualification", registration: null, verification: "not_submitted", experience: null, languages: ["English", "Hindi"], state: "Maharashtra", city: "Pune", modes: ["Online"], expertise: ["GST", "ITR"], description: "This is a demo profile to illustrate how listings will appear. It is not a real person.", demo: true },
  { key: "demo-2", name: "Demo Professional B", category: "Advocate", qualifications: "Sample qualification", registration: null, verification: "not_submitted", experience: null, languages: ["English", "Tamil"], state: "Tamil Nadu", city: "Chennai", modes: ["Online", "In-person"], expertise: ["Contracts", "Trademark"], description: "This is a demo profile to illustrate how listings will appear. It is not a real person.", demo: true },
  { key: "demo-3", name: "Demo Professional C", category: "Company Secretary", qualifications: "Sample qualification", registration: null, verification: "not_submitted", experience: null, languages: ["English", "Hindi", "Gujarati"], state: "Gujarat", city: "Ahmedabad", modes: ["Online"], expertise: ["Company Registration", "Compliance"], description: "This is a demo profile to illustrate how listings will appear. It is not a real person.", demo: true },
  { key: "demo-4", name: "Demo Professional D", category: "Tax Practitioner", qualifications: "Sample qualification", registration: null, verification: "not_submitted", experience: null, languages: ["English", "Bengali"], state: "West Bengal", city: "Kolkata", modes: ["Online"], expertise: ["TDS", "GST Returns"], description: "This is a demo profile to illustrate how listings will appear. It is not a real person.", demo: true },
];
