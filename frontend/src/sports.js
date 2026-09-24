export const SPORTS = [
  { id: "cricket", label: "Cricket", emoji: "🏏" },
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "basketball", label: "Basketball", emoji: "🏀" },
  { id: "tennis", label: "Tennis", emoji: "🎾" },
  { id: "badminton", label: "Badminton", emoji: "🏸" },
  {
    id: "asian_games_2026",
    label: "Asian Games 2026",
    emoji: "🌏",
    welcome:
      "Ask me about the 2026 Asian Games — host, dates, and sports program. (Note: I only have fixed event facts, not live medal counts or results.)",
  },
];

export const DEFAULT_SPORT_ID = "cricket";

export function getSport(id) {
  return SPORTS.find((s) => s.id === id) ?? SPORTS[0];
}

export function welcomeTextFor(sportId) {
  const sport = getSport(sportId);
  return sport.welcome ?? `Ask me anything about ${sport.label}'s rules and laws.`;
}
