// ─────────────────────────────────────────────────────────────────────────────
// Sample / mock data for the Mediacorp grounding agent.
// Replace these with real API integrations or a proper knowledge base later.
// ─────────────────────────────────────────────────────────────────────────────

export const exampleShowInfo = {
  title: "Sample Show",
  channel: "Channel 5",
  genre: "Drama",
  airTime: "9:30 PM",
  description: "Placeholder show description.",
};

export const exampleChannels = [
  { name: "Channel 5",     language: "English",  genre: "General Entertainment" },
  { name: "Channel 8",     language: "Mandarin", genre: "General Entertainment" },
  { name: "Channel U",     language: "Mandarin", genre: "General Entertainment" },
  { name: "Suria",         language: "Malay",    genre: "General Entertainment" },
  { name: "Vasantham",     language: "Tamil",    genre: "General Entertainment" },
  { name: "okto",          language: "English",  genre: "Kids & Lifestyle"       },
  { name: "CNA",           language: "English",  genre: "News"                   },
];

export const exampleStreamingInfo = {
  platform: "meWATCH",
  url: "https://www.mewatch.sg",
  description: "Mediacorp's free streaming platform offering live TV, on-demand shows, movies, and exclusive digital content.",
  subscription: "Free with optional premium tiers.",
};
