/**
 * robotsChecker.js
 * Parses a robots.txt file and determines whether known AI search / answer-
 * engine crawlers are permitted to access the site.
 *
 * This backs the audit's "AI Crawler Access" gate — research across AEO/GEO
 * audit frameworks (AirOps, ZipTie) treats crawler accessibility as a
 * prerequisite, not just another weighted bucket: if an AI bot is blocked at
 * robots.txt, no amount of schema or content quality can get that page cited
 * by that engine. See ScoringCriteriaPage for the full rationale.
 */

// User-agents actually used by AI answer/search engines when retrieving pages
// for a live answer or citation. Pure model-training crawlers are deliberately
// excluded — being blocked from training doesn't affect whether an existing
// page can be cited in an AI answer, only these fetch-time bots do.
export const AI_SEARCH_BOTS = [
  'OAI-SearchBot',     // ChatGPT Search
  'ChatGPT-User',       // ChatGPT browsing / plugin fetches
  'PerplexityBot',      // Perplexity search index
  'Perplexity-User',
  'ClaudeBot',           // Anthropic search/index crawler
  'Claude-SearchBot',
  'Claude-User',
  'Google-Extended',     // Gemini / Google AI Overviews opt-out signal
  'Bingbot',              // powers Bing Copilot answers
  'Applebot',              // powers Apple Intelligence / Siri search
];

/**
 * Parse robots.txt content into an array of { agents: string[], rules: [{type, path}] } groups.
 * Consecutive `User-agent:` lines with no rules between them belong to one group,
 * per the robots.txt spec.
 */
function parseRobotsTxt(text) {
  const groups = [];
  let current = null;

  text.split(/\r?\n/).forEach(rawLine => {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) return;
    const match = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!match) return;
    const field = match[1].toLowerCase();
    const value = match[2].trim();

    if (field === 'user-agent') {
      if (!current || current.rules.length > 0) {
        current = { agents: [value], rules: [] };
        groups.push(current);
      } else {
        current.agents.push(value);
      }
    } else if ((field === 'disallow' || field === 'allow') && current) {
      current.rules.push({ type: field, path: value });
    }
  });

  return groups;
}

/**
 * Whether a given bot is blocked from the whole site by a blanket root-level
 * Disallow rule. Deliberately conservative in two ways:
 *  - Path-specific Disallow rules (e.g. "Disallow: /admin") are common and
 *    legitimate, and are NOT treated as blocking the bot; only a rule
 *    disallowing "/" (the entire site) counts.
 *  - An EMPTY Disallow value ("Disallow:") means "disallow nothing" per the
 *    robots.txt spec — it's the standard idiom for explicitly allowing a bot
 *    — so it must NOT be treated the same as "Disallow: /". (An earlier
 *    version of this function got this backwards and flagged every bot as
 *    blocked on the extremely common "User-agent: *\nDisallow:" pattern.)
 */
function isBotBlocked(groups, botName) {
  const lowerBot = botName.toLowerCase();
  const specific = groups.find(g => g.agents.some(a => a.toLowerCase() === lowerBot));
  const wildcard = groups.find(g => g.agents.some(a => a === '*'));
  const group = specific || wildcard;
  if (!group) return false; // no matching rule at all = allowed by default

  const blocked = group.rules.some(r => r.type === 'disallow' && r.path === '/');
  const explicitlyAllowed = group.rules.some(r => r.type === 'allow' && r.path === '/');
  return blocked && !explicitlyAllowed;
}

/**
 * Analyze robots.txt content against the list of known AI search bots.
 * @param {string|null} robotsTxt - Raw robots.txt content, or null/empty if unavailable.
 * @returns {{ checked: boolean, blockedBots: string[], allowedBots: string[], blockedRatio: number }}
 */
export function analyzeRobotsTxt(robotsTxt) {
  if (!robotsTxt || !robotsTxt.trim()) {
    // No robots.txt (or it couldn't be fetched) — per spec, absence of
    // robots.txt means everything is allowed by default.
    return { checked: false, blockedBots: [], allowedBots: [...AI_SEARCH_BOTS], blockedRatio: 0 };
  }

  const groups = parseRobotsTxt(robotsTxt);
  const blockedBots = AI_SEARCH_BOTS.filter(bot => isBotBlocked(groups, bot));
  const allowedBots = AI_SEARCH_BOTS.filter(bot => !blockedBots.includes(bot));

  return {
    checked: true,
    blockedBots,
    allowedBots,
    blockedRatio: blockedBots.length / AI_SEARCH_BOTS.length,
  };
}
