/**
 * geminiService.js
 * Handles Gemini AI Q&A generation for AEO schemas with seamless heuristic fallback.
 */

/**
 * Clean and extract readable body text from DOM (up to maxChars).
 * @param {Document} doc
 * @param {number} maxChars
 * @returns {string}
 */
export function extractCleanPageText(doc, maxChars = 12000) {
  if (!doc || !doc.body) return '';

  // Clone body to avoid mutating active DOM
  const clone = doc.body.cloneNode(true);

  // Remove scripts, styles, noscript, iframe, svg, nav, footer
  const removeSelectors = ['script', 'style', 'noscript', 'iframe', 'svg', 'nav', 'footer'];
  removeSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  const text = clone.textContent || '';
  return text.replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

/**
 * Generate Q&A pairs for each schema using Gemini API via Express proxy.
 * Falls back to heuristic generation if the API call fails or no key is set.
 *
 * @param {Array<{ type: string, label: string, schema: Object }>} schemas
 * @param {Document} doc
 * @param {Object} meta
 * @param {Object} signals
 * @param {string} pageUrl
 * @param {string} [userApiKey]
 * @returns {Promise<{ qna: Record<string, Array<{ question: string, answer: string }>>, source: 'gemini' | 'heuristic', error?: string }>}
 */
export async function generateQAPairsForSchemas(schemas, doc, meta, signals, pageUrl, userApiKey = '') {
  const pageText = extractCleanPageText(doc, 12000);

  // Exclude BreadcrumbList and WebSite from receiving forced Q&A
  const eligibleSchemas = schemas.filter(s => s.type !== 'BreadcrumbList' && s.type !== 'WebSite');

  // Payload for backend
  const schemaPayload = eligibleSchemas.map(s => ({
    type: s.type,
    label: s.label || s.type,
    name: s.schema?.name || s.schema?.headline || '',
  }));

  try {
    const response = await fetch('/api/generate-qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageUrl,
        title: meta.title || '',
        pageText,
        schemas: schemaPayload,
        apiKey: userApiKey || undefined,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.qna && typeof data.qna === 'object' && Object.keys(data.qna).length > 0) {
        return {
          qna: data.qna,
          source: 'gemini',
        };
      }
    } else {
      const errJson = await response.json().catch(() => ({}));
      console.warn('[geminiService] Backend Q&A generation warning:', errJson.error || response.statusText);
    }
  } catch (err) {
    console.warn('[geminiService] Q&A fetch failed, switching to heuristic generation:', err.message);
  }

  // Graceful fallback to heuristic generation
  const heuristicQnA = generateHeuristicQAPairs(schemas, doc, meta, signals, pageUrl);
  return {
    qna: heuristicQnA,
    source: 'heuristic',
  };
}

/**
 * High-quality heuristic Q&A generation based on extracted DOM entities.
 * Only generates Q&A for schemas that actually have substantive on-page content.
 */
export function generateHeuristicQAPairs(schemas, doc, meta, signals, pageUrl) {
  const qna = {};
  const org = signals?.org || {};
  const orgName = org.name || meta.siteName || 'this organization';
  const pageTitle = meta.title || 'this page';

  for (const item of schemas) {
    const type = item.type;
    // Exclude technical metadata schemas that should not have Q&A
    if (type === 'BreadcrumbList' || type === 'WebSite') continue;

    const pairs = [];

    switch (type) {
      case 'Organization':
        if (meta.description || org.email || org.phone || org.address) {
          pairs.push({
            question: `What is ${orgName}?`,
            answer: meta.description || `${orgName} is an official organization providing verified services and resources.`,
          });
          if (org.email || org.phone || org.address) {
            const contactParts = [
              org.phone ? `phone: ${org.phone}` : '',
              org.email ? `email: ${org.email}` : '',
              org.address ? `address: ${org.address}` : '',
            ].filter(Boolean).join(', ');
            pairs.push({
              question: `How can I contact ${orgName}?`,
              answer: `You can reach ${orgName} via ${contactParts}.`,
            });
          }
          if (org.socials && org.socials.length > 0) {
            pairs.push({
              question: `Where can I find ${orgName} on social media?`,
              answer: `${orgName} maintains official profiles at ${org.socials.slice(0, 3).join(', ')}.`,
            });
          }
        }
        break;


      case 'Article':
      case 'NewsArticle':
        pairs.push({
          question: `What is this article about?`,
          answer: meta.description || `The article covers: ${pageTitle}.`,
        });
        if (meta.author) {
          pairs.push({
            question: `Who wrote this article?`,
            answer: `This article was written by ${meta.author}.`,
          });
        }
        if (meta.datePublished) {
          pairs.push({
            question: `When was this article published?`,
            answer: `Published on ${meta.datePublished}.`,
          });
        }
        break;

      case 'FAQPage':
        if (signals?.faqData?.pairs?.length) {
          signals.faqData.pairs.slice(0, 4).forEach(p => {
            pairs.push({ question: p.question, answer: p.answer });
          });
        } else {
          pairs.push({
            question: `What key questions are answered on this page?`,
            answer: meta.description || `This page provides answers to frequent inquiries regarding ${pageTitle}.`,
          });
        }
        break;

      case 'HowTo':
        pairs.push({
          question: `What does this how-to guide explain?`,
          answer: meta.description || `This guide provides actionable, step-by-step instructions for ${pageTitle}.`,
        });
        if (signals?.howtoSteps?.length) {
          const stepNames = signals.howtoSteps.slice(0, 4).map((s, i) => `${i + 1}. ${s.name}`).join('; ');
          pairs.push({
            question: `What are the key steps in this process?`,
            answer: `The main steps are: ${stepNames}.`,
          });
        }
        break;

      case 'ItemList':
        if (signals?.leadershipMembers && signals.leadershipMembers.length > 0) {
          const names = signals.leadershipMembers.slice(0, 5).map(m => m.jobTitle ? `${m.name} (${m.jobTitle})` : m.name).join(', ');
          pairs.push({
            question: `Who are the board members or leaders of ${orgName}?`,
            answer: `The board and executive leadership includes ${names}.`,
          });
          pairs.push({
            question: `How many leadership or board members are listed on this page?`,
            answer: `There are ${signals.leadershipMembers.length} leadership and board members detailed on this official roster.`,
          });
        }
        break;

      case 'Event':
        pairs.push({
          question: `What is the upcoming event "${item.schema?.name || pageTitle}"?`,
          answer: meta.description || `An official scheduled event organized by ${orgName}.`,
        });
        if (item.schema?.startDate) {
          pairs.push({
            question: `When is the event taking place?`,
            answer: `The event is scheduled for ${item.schema.startDate}.`,
          });
        }
        break;

      case 'Product':
        pairs.push({
          question: `What is ${item.schema?.name || 'this product'}?`,
          answer: meta.description || `${item.schema?.name || 'Product'} offered by ${orgName}.`,
        });
        if (item.schema?.offers?.price) {
          pairs.push({
            question: `What is the price of ${item.schema?.name || 'this product'}?`,
            answer: `The current listed price is ${item.schema.offers.price} ${item.schema.offers.priceCurrency || 'USD'}.`,
          });
        }
        break;

      case 'ContactPage':
        pairs.push({
          question: `How do I get in touch with ${orgName}?`,
          answer: `Official contact methods including phone, email, and inquiry forms are provided on this page.`,
        });
        break;

      default:
        pairs.push({
          question: `What information is featured on this page?`,
          answer: meta.description || `This page contains verified information regarding ${pageTitle}.`,
        });
        break;
    }

    qna[type] = pairs;
  }

  return qna;
}
