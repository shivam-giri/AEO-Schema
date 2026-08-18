/**
 * readabilityScore.js
 * Simplified Flesch-Kincaid Reading Ease implementation.
 * Works entirely on plain text — no external dependencies.
 */

/**
 * Count syllables in a word (English approximation).
 */
function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;

  // Remove silent trailing 'e'
  word = word.replace(/e$/, '');

  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g);
  return vowelGroups ? vowelGroups.length : 1;
}

/**
 * Split text into sentences.
 */
function getSentences(text) {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

/**
 * Split text into words.
 */
function getWords(text) {
  return text
    .split(/\s+/)
    .map(w => w.replace(/[^a-zA-Z']/g, ''))
    .filter(w => w.length > 0);
}

/**
 * Calculate Flesch Reading Ease score.
 * Formula: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
 * Score ranges:
 *   90-100: Very Easy
 *   70-90:  Easy
 *   60-70:  Standard
 *   50-60:  Fairly Difficult
 *   30-50:  Difficult
 *   0-30:   Very Difficult
 *
 * @param {string} text
 * @returns {{ score: number, grade: string, avgWordsPerSentence: number, avgSyllablesPerWord: number }}
 */
export function calculateReadability(text) {
  if (!text || text.trim().length < 50) {
    return { score: 0, grade: 'Unknown', avgWordsPerSentence: 0, avgSyllablesPerWord: 0 };
  }

  const sentences = getSentences(text);
  const words = getWords(text);

  if (sentences.length === 0 || words.length === 0) {
    return { score: 0, grade: 'Unknown', avgWordsPerSentence: 0, avgSyllablesPerWord: 0 };
  }

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = totalSyllables / words.length;

  const score = Math.max(0, Math.min(100,
    206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)
  ));

  const roundedScore = Math.round(score);

  let grade;
  if (roundedScore >= 90) grade = 'Very Easy';
  else if (roundedScore >= 70) grade = 'Easy';
  else if (roundedScore >= 60) grade = 'Standard';
  else if (roundedScore >= 50) grade = 'Fairly Difficult';
  else if (roundedScore >= 30) grade = 'Difficult';
  else grade = 'Very Difficult';

  return {
    score: roundedScore,
    grade,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
  };
}

/**
 * Check average sentence length.
 * AEO best practice: ≤ 20 words per sentence.
 */
export function getAvgSentenceLength(text) {
  const sentences = getSentences(text);
  const words = getWords(text);
  if (!sentences.length) return 0;
  return Math.round(words.length / sentences.length);
}
