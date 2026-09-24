export const SPORTS = [
  { id: "cricket", label: "Cricket", emoji: "🏏" },
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "basketball", label: "Basketball", emoji: "🏀" },
  { id: "tennis", label: "Tennis", emoji: "🎾" },
  { id: "badminton", label: "Badminton", emoji: "🏸" },
];

export const DEFAULT_SPORT_ID = "cricket";

export function getSport(id) {
  return SPORTS.find((s) => s.id === id) ?? SPORTS[0];
}

export function welcomeTextFor(sportId) {
  const sport = getSport(sportId);
  return `Ask me anything about ${sport.label}'s rules and laws.`;
}
