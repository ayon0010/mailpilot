// lib/contentGenerator.ts
const OPENERS = [
  "Hey, quick one —",
  "Morning! Random thought:",
  "Hey there,",
  "Hope your week's going well.",
  "Got a sec?",
  "Quick question for you —",
  "Hey! Been meaning to ask,",
  "So this happened today:",
];

const TOPICS = [
  "did you catch the game last night?",
  "I finally tried that coffee place you mentioned.",
  "we should grab lunch sometime this week.",
  "my flight got delayed again, classic.",
  "the new season of that show is actually good.",
  "I'm still trying to figure out this new laptop.",
  "the weather's been wild lately.",
  "I need recommendations for a good podcast.",
  "are you around this weekend?",
  "just finished a really long call, brain is mush.",
];

const CLOSERS = [
  "Let me know when you're free.",
  "No rush, just curious.",
  "Anyway, talk soon!",
  "Catch you later.",
  "Let's find time this week.",
  "",
  "",
];

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function generateCompositional(rng: () => number = Math.random): {
  subject: string;
  body: string;
} {
  const opener = pick(OPENERS, rng);
  const topic = pick(TOPICS, rng);
  const closer = pick(CLOSERS, rng);
  const body = [opener, topic, closer].filter(Boolean).join(" ");
  const subject = topic
    .replace(/[?.!]$/, "")
    .split(" ")
    .slice(0, 5)
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
  return { subject, body };
}

/** Levenshtein-based similarity, 0-1, 1 = identical. */
export function similarityRatio(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  const dp: number[][] = Array.from({ length: s1.length + 1 }, () =>
    new Array(s2.length + 1).fill(0),
  );
  for (let i = 0; i <= s1.length; i++) dp[i][0] = i;
  for (let j = 0; j <= s2.length; j++) dp[0][j] = j;
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return 1 - dp[s1.length][s2.length] / Math.max(s1.length, s2.length);
}

export function isTooSimilar(
  candidate: string,
  recentBodies: string[],
  threshold = 0.75,
): boolean {
  return recentBodies.some(
    (prev) => similarityRatio(candidate, prev) >= threshold,
  );
}

export async function generateWarmupContent(
  recentBodies: string[],
  opts: { rng?: () => number; maxAttempts?: number },
): Promise<{ subject: string; body: string }> {
  const maxAttempts = opts.maxAttempts ?? 5;
  let last: { subject: string; body: string } | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateCompositional(opts.rng);
    last = candidate;
    if (!isTooSimilar(candidate.body, recentBodies)) return candidate;
  }
  return last!; // better to send something than deadlock
}
