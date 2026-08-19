import { jsPDF } from 'jspdf';

const PAGE_TYPE_LABELS = {
  'auto':       'Auto-Detect',
  'homepage':   'Homepage',
  'article':    'Article / Blog',
  'news-media': 'News & Media',
  'contact-us': 'Contact Us',
  'bod':        'Board of Directors',
  'faq':        'FAQ Page',
};

// --- NEW: sanitize any text before it reaches jsPDF ---
// jsPDF's built-in "helvetica" font only supports WinAnsi/Latin-1.
// Characters outside that range (≤, ≥, –, —, curly quotes, …, etc.)
// get mis-measured by getStringUnitWidth(), which throws off
// splitTextToSize()'s line-wrapping math and causes text to spill
// past card/page boundaries — even though the glyph itself might
// render as blank or a stray character.
function sanitizeText(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/[\u2264]/g, '<=')      // ≤
    .replace(/[\u2265]/g, '>=')      // ≥
    .replace(/[\u2013\u2014]/g, '-') // – —
    .replace(/[\u2018\u2019]/g, "'") // ‘ ’
    .replace(/[\u201C\u201D]/g, '"') // “ ”
    .replace(/\u2026/g, '...')       // …
    .replace(/\u00A0/g, ' ')         // non-breaking space
    // catch-all: strip anything else outside printable ASCII so a
    // future unknown symbol can't silently corrupt layout again
    .replace(/[^\x20-\x7E]/g, '');
}

export function exportAuditPDF({ overallScore, grade, meta, pageType, selectedPageType, pillars, recommendations, uxPillar }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header Banner
  doc.setFillColor(17, 7, 25); // #110719 Dark Plum
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('AEO Studio', 15, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 0, 111); // Magenta accent
  doc.text('ANSWER ENGINE OPTIMIZATION AUDIT REPORT', 15, 23);

  // Metadata Box
  y = 38;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(15, y, pageWidth - 30, 22, 3, 3, 'FD');

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Target URL:', 20, y + 7);
  doc.setFont('helvetica', 'normal');
  const urlText = sanitizeText(meta?.canonicalUrl || 'Website Audit');
  doc.text(urlText.length > 60 ? urlText.substring(0, 60) + '...' : urlText, 42, y + 7);

  const displayType = sanitizeText((() => {
    const effLabel = PAGE_TYPE_LABELS[pageType] || pageType || 'Generic';
    if (!selectedPageType || selectedPageType === 'auto') {
      return `Auto-Detect (${effLabel})`;
    }
    return PAGE_TYPE_LABELS[selectedPageType] || selectedPageType;
  })());

  doc.setFont('helvetica', 'bold');
  doc.text('Target Page Type:', 20, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(displayType, 52, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', 130, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString(), 142, y + 14);

  // Overall Score Card
  y += 28;
  const scoreColor = overallScore >= 80 ? [40, 160, 50] : overallScore >= 65 ? [0, 104, 255] : overallScore >= 40 ? [200, 140, 0] : [217, 16, 16];

  doc.setFillColor(242, 242, 245);
  doc.roundedRect(15, y, pageWidth - 30, 28, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(`${overallScore}/100`, 22, y + 18);

  doc.setFontSize(14);
  doc.text(sanitizeText((grade || 'Assessment').toUpperCase()), 75, y + 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Formula: Schema (30%) + Content (25%) + Technical (25%) + E-E-A-T (20%)', 75, y + 21);

  // 4 Pillars Breakdown Table
  y += 35;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 7, 25);
  doc.text('4-Pillar Assessment Breakdown', 15, y);

  y += 5;
  // Table Header
  doc.setFillColor(17, 7, 25);
  doc.rect(15, y, pageWidth - 30, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('Pillar', 20, y + 5.5);
  doc.text('Weight', 85, y + 5.5);
  doc.text('Checks Passed', 125, y + 5.5);
  doc.text('Score', 170, y + 5.5);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);

  if (pillars && pillars.length > 0) {
    pillars.forEach((p, idx) => {
      const bg = idx % 2 === 0 ? [255, 255, 255] : [248, 248, 250];
      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.rect(15, y, pageWidth - 30, 8, 'F');

      doc.text(sanitizeText(p.label), 20, y + 5.5);
      doc.text(sanitizeText(p.pct || ''), 85, y + 5.5);
      const passCount = p.checks.filter(c => c.passed).length;
      doc.text(`${passCount}/${p.checks.length}`, 125, y + 5.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`${p.score}%`, 170, y + 5.5);
      doc.setFont('helvetica', 'normal');

      y += 8;
    });
  }

  // UX Pillar Row
  if (uxPillar) {
    doc.setFillColor(240, 244, 255);
    doc.rect(15, y, pageWidth - 30, 8, 'F');
    doc.text('UX & Experience (UX Only)', 20, y + 5.5);
    doc.text('Separate', 85, y + 5.5);
    const uxPass = uxPillar.checks.filter(c => c.passed).length;
    doc.text(`${uxPass}/${uxPillar.checks.length}`, 125, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`${uxPillar.score}%`, 170, y + 5.5);
    y += 14;
  } else {
    y += 6;
  }

  // Actionable Recommendations Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 7, 25);
  doc.text('Actionable Recommendations', 15, y);

  y += 6;
  if (recommendations && recommendations.length > 0) {
    const textX = 20;                       // matches table's text indent (Pillar/Weight/etc. start at x=20)
    const bulletX = 15.6;                    // matches table's left edge (box starts at x=15)
    const maxTextWidth = pageWidth - textX - 15; // right margin 15mm, matches table's right edge (x=195)

    recommendations.forEach((rec, idx) => {
      const priorityLabel = sanitizeText((rec.priority || 'info').toUpperCase());
      const titleText = sanitizeText(rec.title || '');
      const descText  = sanitizeText(rec.description || rec.detail || '');

      // IMPORTANT: set font BEFORE splitTextToSize. jsPDF measures text using
      // whatever font/size is currently active on the doc — if we split first
      // and set the font after, the wrap width is calculated against the WRONG
      // (often narrower) font, so the actually-rendered bold/larger text ends up
      // wider than the box and runs off the page edge, silently clipping words.
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      const splitTitle = doc.splitTextToSize(titleText, maxTextWidth);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      const splitDesc = doc.splitTextToSize(descText, maxTextWidth);

      const titleHeight = splitTitle.length * 4.5;
      const descHeight  = splitDesc.length * 4.0;
      // Block height = label line (5) + title lines + gap (1) + desc lines + gap before divider (2) + spacing after (5)
      const blockHeight = 5 + titleHeight + 1 + descHeight + 2 + 5;

      if (y + blockHeight > 275) {
        doc.addPage();
        y = 20;
      }

      const recColor = rec.priority === 'high' ? [217, 16, 16] : rec.priority === 'medium' ? [200, 140, 0] : [40, 160, 50];

      // Colored dot bullet, aligned to the priority label baseline
      doc.setFillColor(recColor[0], recColor[1], recColor[2]);
      doc.circle(bulletX, y + 1.8, 1.3, 'F');

      // Priority label (small, bold, colored)
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(recColor[0], recColor[1], recColor[2]);
      doc.text(priorityLabel, textX, y + 2.7);

      let currentY = y + 2.7 + 5;

      // Title (bold, dark), hanging-indented under the label
      // (re-set font explicitly — do not rely on state left over from measuring)
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      splitTitle.forEach((line) => {
        doc.text(line, textX, currentY);
        currentY += 4.5;
      });

      currentY += 1; // gap between title and description

      // Description (normal, gray)
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      splitDesc.forEach((line) => {
        doc.text(line, textX, currentY);
        currentY += 4.0;
      });

      // Thin divider between items (skip after the last one)
      currentY += 2;
      if (idx < recommendations.length - 1) {
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.2);
        doc.line(15, currentY, pageWidth - 15, currentY);
      }

      y = currentY + 5; // spacing to next recommendation
    });
  } else {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 160, 50);
    doc.text('Excellent! No critical recommendations found.', 20, y + 4);
  }

  // Footer for all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`AEO Studio Audit Report - Page ${i} of ${totalPages}`, 15, 290);
    doc.text('https://aeo-schema.vercel.app/', pageWidth - 60, 290);
  }

  const cleanFilename = (meta?.canonicalUrl || 'audit')
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 30);

  doc.save(`AEO_Audit_Report_${cleanFilename}.pdf`);
}