import type { MeetingAiSummary, VisualNoteKind, VisualNoteStep } from '../services/api';

interface KindPalette {
  label: string;
  accent: string;
  softBg: string;
  border: string;
  glow: string;
}

export interface RenderedNotePage {
  pageNumber: number;
  totalPages: number;
  dataUrl: string;
}

const KIND_PALETTES: Record<VisualNoteKind, KindPalette> = {
  concept: {
    label: 'CONCEPT',
    accent: '#38BDF8',
    softBg: 'rgba(56, 189, 248, 0.14)',
    border: 'rgba(56, 189, 248, 0.52)',
    glow: 'rgba(56, 189, 248, 0.2)',
  },
  formula: {
    label: 'FORMULA / RULE',
    accent: '#FBBF24',
    softBg: 'rgba(251, 191, 36, 0.15)',
    border: 'rgba(251, 191, 36, 0.58)',
    glow: 'rgba(251, 191, 36, 0.2)',
  },
  step: {
    label: 'EXPLANATION',
    accent: '#34D399',
    softBg: 'rgba(52, 211, 153, 0.14)',
    border: 'rgba(52, 211, 153, 0.5)',
    glow: 'rgba(52, 211, 153, 0.18)',
  },
  example: {
    label: 'WORKED EXAMPLE',
    accent: '#C084FC',
    softBg: 'rgba(192, 132, 252, 0.15)',
    border: 'rgba(192, 132, 252, 0.55)',
    glow: 'rgba(192, 132, 252, 0.22)',
  },
  takeaway: {
    label: 'KEY TAKEAWAY',
    accent: '#FB7185',
    softBg: 'rgba(251, 113, 133, 0.15)',
    border: 'rgba(251, 113, 133, 0.55)',
    glow: 'rgba(251, 113, 133, 0.2)',
  },
};

const FONT_SANS = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif';
const FONT_MONO = '"JetBrains Mono", "Cascadia Code", Consolas, monospace';

const PAGE_W = 1200;
const PAGE_H = 1600;
const SCALE = 2; // 2400 × 3200 ultra-crisp Retina PNG per page
const PAD_X = 68;
const CONTENT_W = PAGE_W - PAD_X * 2;
const CENTER_X = PAGE_W / 2;
const BOTTOM_LIMIT = PAGE_H - 94;

function cleanLegacyPrefix(text: string): string {
  return text.replace(/^\[(Screen|Voice|Chat)\s*·[^\]]+\]\s*/i, '').trim();
}

export function resolveVisualFlow(summary: MeetingAiSummary, title: string): VisualNoteStep[] {
  const existing = summary.sources_summary?.visual_flow;
  if (Array.isArray(existing) && existing.length > 0) {
    return existing;
  }

  const cleanedPoints = (summary.key_points || [])
    .map(cleanLegacyPrefix)
    .filter((p) => p.length > 0 && !p.toLowerCase().includes('no voice captions'));

  if (cleanedPoints.length > 0) {
    return cleanedPoints.slice(0, 8).map((pt, idx, arr) => {
      const hasFormula = /[=^∫√∑±]|=>|\b(formula|equation|theorem)\b/i.test(pt);
      const kind: VisualNoteKind = hasFormula
        ? 'formula'
        : idx === 0
          ? 'concept'
          : idx === arr.length - 1
            ? 'takeaway'
            : 'step';
      return {
        title:
          kind === 'formula'
            ? 'Key Formula & Rule'
            : idx === 0
              ? 'Core Concept'
              : idx === arr.length - 1
                ? 'Key Conclusion'
                : `Topic Point ${idx + 1}`,
        kind,
        body: pt,
        show_arrow: kind === 'formula' && idx < arr.length - 1,
        ...(kind === 'formula' && idx < arr.length - 1 ? { arrow_label: 'Application' } : {}),
      };
    });
  }

  return [
    {
      title: title || 'Study Notes',
      kind: 'concept',
      body: summary.overview || 'Summary of discussed content.',
      show_arrow: false,
    },
  ];
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
): string[] {
  ctx.font = font;
  const paragraphs = text.replace(/\r/g, '').split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      if (lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
      }
      continue;
    }

    const words = trimmed.split(/\s+/);
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        if (ctx.measureText(word).width > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width <= maxWidth) {
              chunk += ch;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }

    if (current) lines.push(current);
  }

  return lines.length > 0 ? lines : [''];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawVerticalArrow(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  startY: number,
  endY: number,
  color: string,
  label?: string,
) {
  const headLen = 12;
  const headHalfW = 7.5;
  const shaftEndY = endY - headLen + 2;

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(centerX, startY, 3.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(centerX, startY + 2);
  ctx.lineTo(centerX, shaftEndY);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(centerX, endY);
  ctx.lineTo(centerX - headHalfW, endY - headLen);
  ctx.lineTo(centerX + headHalfW, endY - headLen);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (label && label.trim()) {
    const cleanLabel = label.trim().toUpperCase();
    const midY = (startY + shaftEndY) / 2;
    ctx.save();
    ctx.font = `700 11.5px ${FONT_SANS}`;
    const textW = ctx.measureText(cleanLabel).width;
    const pillW = textW + 22;
    const pillH = 24;
    const pillX = centerX + 16;
    const pillY = midY - pillH / 2;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX + 2, midY);
    ctx.lineTo(pillX, midY);
    ctx.stroke();

    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 12);
    ctx.fillStyle = '#070A10';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(cleanLabel, pillX + 11, midY + 0.5);
    ctx.restore();
  }
}

function paintBlackPageCanvas(
  title: string,
  envLabel: string,
  pageNumber: number,
  totalPages: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; startY: number } {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W * SCALE;
  canvas.height = PAGE_H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to render visual notes canvas.');
  }
  ctx.scale(SCALE, SCALE);

  // Pure black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Subtle ambient studio glow
  const topGlow = ctx.createRadialGradient(220, 90, 10, 220, 90, 520);
  topGlow.addColorStop(0, 'rgba(56, 189, 248, 0.09)');
  topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, PAGE_W, 560);

  // Subtle blackboard dot-grid
  ctx.fillStyle = 'rgba(255, 255, 255, 0.055)';
  for (let gx = 28; gx < PAGE_W; gx += 32) {
    for (let gy = 28; gy < PAGE_H; gy += 32) {
      ctx.fillRect(gx, gy, 1.4, 1.4);
    }
  }

  // Outer sleek frame
  drawRoundedRect(ctx, 20, 20, PAGE_W - 40, PAGE_H - 40, 24);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Page counter pill (top-right)
  ctx.save();
  ctx.font = `700 12px ${FONT_MONO}`;
  const pageTag = `PAGE ${pageNumber} / ${totalPages}`;
  const tagW = ctx.measureText(pageTag).width + 24;
  drawRoundedRect(ctx, PAGE_W - PAD_X - tagW, 48, tagW, 28, 14);
  ctx.fillStyle = '#0B1120';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#94A3B8';
  ctx.textBaseline = 'middle';
  ctx.fillText(pageTag, PAGE_W - PAD_X - tagW + 12, 62.5);
  ctx.restore();

  // Footer
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD_X, PAGE_H - 66);
  ctx.lineTo(PAGE_W - PAD_X, PAGE_H - 66);
  ctx.stroke();

  ctx.font = `600 12px ${FONT_SANS}`;
  ctx.fillStyle = '#475569';
  ctx.textBaseline = 'middle';
  ctx.fillText('MEET · AI STUDY NOTES', PAD_X, PAGE_H - 42);
  ctx.textAlign = 'right';
  ctx.fillText(`${pageNumber} / ${totalPages}`, PAGE_W - PAD_X, PAGE_H - 42);
  ctx.restore();

  if (pageNumber === 1) {
    // Full cover header on Page 1
    let y = 48;
    ctx.save();
    ctx.font = `800 12.5px ${FONT_SANS}`;
    const badgeText = `✦  ${envLabel}`;
    const badgeW = ctx.measureText(badgeText).width + 28;
    drawRoundedRect(ctx, PAD_X, y, badgeW, 28, 14);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#7DD3FC';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, PAD_X + 14, y + 14.5);
    ctx.restore();

    y += 42;
    const titleFont = `800 36px ${FONT_SANS}`;
    const titleLines = wrapText(ctx, title, CONTENT_W - 140, titleFont);
    ctx.save();
    ctx.font = titleFont;
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';
    for (const line of titleLines) {
      ctx.fillText(line, PAD_X, y);
      y += 45;
    }
    ctx.restore();

    // Clean neon gradient rule
    y += 8;
    const grad = ctx.createLinearGradient(PAD_X, y, PAD_X + CONTENT_W, y);
    grad.addColorStop(0, '#38BDF8');
    grad.addColorStop(0.55, '#818CF8');
    grad.addColorStop(1, '#C084FC');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(PAD_X, y);
    ctx.lineTo(PAD_X + CONTENT_W, y);
    ctx.stroke();

    return { canvas, ctx, startY: y + 26 };
  }

  // Continuation header on Page 2+
  ctx.save();
  ctx.font = `700 18px ${FONT_SANS}`;
  ctx.fillStyle = '#E2E8F0';
  ctx.textBaseline = 'middle';
  const shortTitle = title.length > 56 ? `${title.slice(0, 56)}…` : title;
  ctx.fillText(shortTitle, PAD_X, 62);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(PAD_X, 90);
  ctx.lineTo(PAGE_W - PAD_X, 90);
  ctx.stroke();
  ctx.restore();

  return { canvas, ctx, startY: 116 };
}

type LayoutItem =
  | {
      type: 'overview';
      lines: string[];
      height: number;
    }
  | {
      type: 'section';
      index: number;
      step: VisualNoteStep;
      palette: KindPalette;
      titleLines: string[];
      bodyLines: string[];
      formulaLines: string[];
      bulletLineGroups: string[][];
      height: number;
      showArrowAfter: boolean;
      arrowLabel?: string;
      nextAccent?: string;
    }
  | {
      type: 'keypoints';
      items: Array<{ lines: string[]; height: number }>;
      height: number;
    }
  | {
      type: 'actions';
      items: string[][];
      height: number;
    };

export function renderVisualNotesPages(
  meetingTitle: string,
  summary: MeetingAiSummary,
): RenderedNotePage[] {
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) {
    throw new Error('Unable to initialize 2D canvas context.');
  }

  const safeTitle = (meetingTitle || 'Visual Study Notes').trim();
  const envLabel = (summary.environment_label || 'VISUAL STUDY NOTES').trim().toUpperCase();
  const overviewText = (summary.overview || '').trim();
  const flowSteps = resolveVisualFlow(summary, safeTitle);
  const keyPoints = (summary.key_points || [])
    .map(cleanLegacyPrefix)
    .filter((k) => k.length > 0 && !k.toLowerCase().includes('no voice captions'));
  const actionItems = (summary.action_items || [])
    .map(cleanLegacyPrefix)
    .filter((a) => a.length > 0);

  const overviewFont = `500 17px ${FONT_SANS}`;
  const stepTitleFont = `800 20px ${FONT_SANS}`;
  const stepBodyFont = `400 16.5px ${FONT_SANS}`;
  const formulaFont = `600 17.5px ${FONT_MONO}`;
  const bulletFont = `400 15.5px ${FONT_SANS}`;

  // 1. Measure all logical content blocks
  const blocks: LayoutItem[] = [];

  if (overviewText) {
    const oLines = wrapText(mCtx, overviewText, CONTENT_W - 56, overviewFont);
    blocks.push({
      type: 'overview',
      lines: oLines,
      height: 48 + oLines.length * 26 + 20,
    });
  }

  flowSteps.forEach((step, idx) => {
    const palette = KIND_PALETTES[step.kind] || KIND_PALETTES.concept;
    const nextPalette =
      idx < flowSteps.length - 1
        ? KIND_PALETTES[flowSteps[idx + 1].kind] || palette
        : undefined;

    const titleLines = wrapText(mCtx, step.title, CONTENT_W - 220, stepTitleFont);
    const bodyLines = wrapText(mCtx, step.body, CONTENT_W - 104, stepBodyFont);
    const formulaLines = step.formula
      ? wrapText(mCtx, step.formula, CONTENT_W - 140, formulaFont)
      : [];
    const bulletLineGroups = (step.bullets || []).map((b) =>
      wrapText(mCtx, b, CONTENT_W - 134, bulletFont),
    );

    let h = 30 + titleLines.length * 26 + 10 + bodyLines.length * 25 + 22;
    if (formulaLines.length > 0) {
      h += 14 + formulaLines.length * 25 + 24;
    }
    if (bulletLineGroups.length > 0) {
      h +=
        14 +
        bulletLineGroups.reduce((acc, g) => acc + g.length * 23 + 8, 0) +
        4;
    }

    blocks.push({
      type: 'section',
      index: idx,
      step,
      palette,
      titleLines,
      bodyLines,
      formulaLines,
      bulletLineGroups,
      height: Math.max(h, 112),
      showArrowAfter: Boolean(step.show_arrow) && idx < flowSteps.length - 1,
      arrowLabel: step.arrow_label,
      nextAccent: nextPalette?.accent,
    });
  });

  if (keyPoints.length > 0) {
    const measuredKeys = keyPoints.map((kp) => {
      const lines = wrapText(mCtx, kp, CONTENT_W - 86, bulletFont);
      return { lines, height: lines.length * 23 + 12 };
    });
    const kpHeight = 52 + measuredKeys.reduce((acc, k) => acc + k.height, 0) + 12;
    blocks.push({
      type: 'keypoints',
      items: measuredKeys,
      height: kpHeight,
    });
  }

  if (actionItems.length > 0) {
    const measuredActs = actionItems.map((act) =>
      wrapText(mCtx, act, CONTENT_W - 86, bulletFont),
    );
    const actHeight = 52 + measuredActs.reduce((acc, l) => acc + l.length * 23 + 12, 0) + 12;
    blocks.push({
      type: 'actions',
      items: measuredActs,
      height: actHeight,
    });
  }

  // 2. Paginate blocks cleanly across as many pages as needed
  const titleLinesEstimate = wrapText(mCtx, safeTitle, CONTENT_W - 140, `800 36px ${FONT_SANS}`);
  const page1StartY = 48 + 42 + titleLinesEstimate.length * 45 + 8 + 26;
  const contStartY = 116;

  const pagesBuckets: LayoutItem[][] = [[]];
  let currentY = page1StartY;

  for (const block of blocks) {
    const arrowReserve = block.type === 'section' && block.showArrowAfter ? 54 : 22;
    const needed = block.height + arrowReserve;

    if (pagesBuckets[pagesBuckets.length - 1].length > 0 && currentY + block.height > BOTTOM_LIMIT) {
      pagesBuckets.push([block]);
      currentY = contStartY + needed;
    } else {
      pagesBuckets[pagesBuckets.length - 1].push(block);
      currentY += needed;
    }
  }

  const totalPages = pagesBuckets.length;

  // 3. Render every page to crisp 2x Retina PNG
  return pagesBuckets.map((pageItems, pIdx) => {
    const pageNumber = pIdx + 1;
    const { canvas, ctx, startY } = paintBlackPageCanvas(
      safeTitle,
      envLabel,
      pageNumber,
      totalPages,
    );

    let cursorY = startY;

    pageItems.forEach((item, idxOnPage) => {
      const isLastOnPage = idxOnPage === pageItems.length - 1;

      if (item.type === 'overview') {
        drawRoundedRect(ctx, PAD_X, cursorY, CONTENT_W, item.height, 16);
        ctx.fillStyle = '#090D16';
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.34)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        drawRoundedRect(ctx, PAD_X, cursorY + 12, 5, item.height - 24, 3);
        ctx.fillStyle = '#38BDF8';
        ctx.fill();

        ctx.save();
        ctx.font = `800 12px ${FONT_SANS}`;
        ctx.fillStyle = '#38BDF8';
        ctx.textBaseline = 'top';
        ctx.fillText('SESSION OVERVIEW', PAD_X + 24, cursorY + 16);

        ctx.font = overviewFont;
        ctx.fillStyle = '#E2E8F0';
        let oY = cursorY + 42;
        for (const line of item.lines) {
          ctx.fillText(line, PAD_X + 24, oY);
          oY += 26;
        }
        ctx.restore();

        cursorY += item.height + 24;
        return;
      }

      if (item.type === 'section') {
        const {
          index,
          step,
          palette,
          titleLines,
          bodyLines,
          formulaLines,
          bulletLineGroups,
          height,
          showArrowAfter,
          arrowLabel,
          nextAccent,
        } = item;

        // Card shadow + dark surface
        ctx.save();
        ctx.shadowColor = palette.glow;
        ctx.shadowBlur = 16;
        drawRoundedRect(ctx, PAD_X, cursorY, CONTENT_W, height, 18);
        ctx.fillStyle = '#0A0D14';
        ctx.fill();
        ctx.restore();

        drawRoundedRect(ctx, PAD_X, cursorY, CONTENT_W, height, 18);
        ctx.strokeStyle = palette.border;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Left colored stripe
        drawRoundedRect(ctx, PAD_X + 1, cursorY + 14, 4.5, height - 28, 3);
        ctx.fillStyle = palette.accent;
        ctx.fill();

        // Number circle badge
        const numCx = PAD_X + 38;
        const numCy = cursorY + 36;
        ctx.save();
        ctx.beginPath();
        ctx.arc(numCx, numCy, 17, 0, Math.PI * 2);
        ctx.fillStyle = palette.softBg;
        ctx.fill();
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = `800 13px ${FONT_MONO}`;
        ctx.fillStyle = palette.accent;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(index + 1).padStart(2, '0'), numCx, numCy + 0.5);
        ctx.restore();

        // Kind badge (top-right)
        ctx.save();
        ctx.font = `800 11px ${FONT_SANS}`;
        const kindW = ctx.measureText(palette.label).width + 20;
        const kindX = PAD_X + CONTENT_W - kindW - 20;
        const kindY = cursorY + 20;
        drawRoundedRect(ctx, kindX, kindY, kindW, 24, 12);
        ctx.fillStyle = palette.softBg;
        ctx.fill();
        ctx.strokeStyle = palette.border;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.fillStyle = palette.accent;
        ctx.textBaseline = 'middle';
        ctx.fillText(palette.label, kindX + 10, kindY + 12.5);
        ctx.restore();

        // Title
        let innerY = cursorY + 24;
        ctx.save();
        ctx.font = stepTitleFont;
        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'top';
        for (const line of titleLines) {
          ctx.fillText(line, PAD_X + 70, innerY);
          innerY += 26;
        }

        // Explanation Body
        innerY += 8;
        ctx.font = stepBodyFont;
        ctx.fillStyle = '#CBD5E1';
        for (const line of bodyLines) {
          ctx.fillText(line, PAD_X + 70, innerY);
          innerY += 25;
        }

        // Formula / Equation Box
        if (formulaLines.length > 0) {
          innerY += 12;
          const fBoxH = formulaLines.length * 25 + 20;
          const fBoxX = PAD_X + 70;
          const fBoxW = CONTENT_W - 94;

          drawRoundedRect(ctx, fBoxX, innerY, fBoxW, fBoxH, 11);
          ctx.fillStyle = '#030508';
          ctx.fill();
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
          ctx.lineWidth = 1.3;
          ctx.stroke();

          drawRoundedRect(ctx, fBoxX, innerY + 6, 4, fBoxH - 12, 2);
          ctx.fillStyle = '#FBBF24';
          ctx.fill();

          ctx.font = formulaFont;
          ctx.fillStyle = '#FDE68A';
          let fY = innerY + 11;
          for (const fl of formulaLines) {
            ctx.fillText(fl, fBoxX + 18, fY);
            fY += 25;
          }
          innerY += fBoxH + 2;
        }

        // Sub-points / Worked Example Steps
        if (bulletLineGroups.length > 0) {
          innerY += 12;
          ctx.font = bulletFont;
          bulletLineGroups.forEach((group, bIdx) => {
            const marker = step.kind === 'example' ? `${bIdx + 1}.` : '•';
            ctx.fillStyle = palette.accent;
            ctx.fillText(marker, PAD_X + 72, innerY);

            ctx.fillStyle = '#E2E8F0';
            for (const bLine of group) {
              ctx.fillText(bLine, PAD_X + 94, innerY);
              innerY += 23;
            }
            innerY += 8;
          });
        }
        ctx.restore();

        const cardBottom = cursorY + height;
        cursorY = cardBottom;

        // SELECTIVE ARROWS: ONLY draw an arrow when logically important (`showArrowAfter === true`)
        if (showArrowAfter) {
          if (!isLastOnPage) {
            drawVerticalArrow(
              ctx,
              CENTER_X,
              cardBottom + 3,
              cardBottom + 51,
              nextAccent || palette.accent,
              arrowLabel,
            );
            cursorY += 54;
          } else if (pageNumber < totalPages) {
            // Subtle continuation cue if connected step continues on the next page
            ctx.save();
            ctx.font = `700 12px ${FONT_SANS}`;
            const contText = `${arrowLabel ? `${arrowLabel.toUpperCase()} · ` : ''}CONTINUES ON PAGE ${pageNumber + 1}  →`;
            ctx.fillStyle = nextAccent || palette.accent;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText(contText, PAD_X + CONTENT_W, cardBottom + 14);
            ctx.restore();
            cursorY += 36;
          }
        } else {
          // Clean spacing without unnecessary arrows
          cursorY += 22;
        }
        return;
      }

      if (item.type === 'keypoints') {
        drawRoundedRect(ctx, PAD_X, cursorY, CONTENT_W, item.height, 16);
        ctx.fillStyle = '#090D16';
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.save();
        ctx.font = `800 13px ${FONT_SANS}`;
        ctx.fillStyle = '#38BDF8';
        ctx.textBaseline = 'top';
        ctx.fillText('QUICK REVISION · KEY TAKEAWAYS', PAD_X + 24, cursorY + 18);

        ctx.font = bulletFont;
        let ky = cursorY + 46;
        for (const kp of item.items) {
          ctx.fillStyle = '#38BDF8';
          ctx.fillText('▸', PAD_X + 24, ky);
          ctx.fillStyle = '#F1F5F9';
          for (const line of kp.lines) {
            ctx.fillText(line, PAD_X + 46, ky);
            ky += 23;
          }
          ky += 12;
        }
        ctx.restore();

        cursorY += item.height + 22;
        return;
      }

      if (item.type === 'actions') {
        drawRoundedRect(ctx, PAD_X, cursorY, CONTENT_W, item.height, 16);
        ctx.fillStyle = '#06120E';
        ctx.fill();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.save();
        ctx.font = `800 13px ${FONT_SANS}`;
        ctx.fillStyle = '#34D399';
        ctx.textBaseline = 'top';
        ctx.fillText('PRACTICE / HOMEWORK / NEXT STEPS', PAD_X + 24, cursorY + 18);

        ctx.font = bulletFont;
        let ay = cursorY + 46;
        for (const lines of item.items) {
          ctx.fillStyle = '#34D399';
          ctx.fillText('☐', PAD_X + 24, ay);
          ctx.fillStyle = '#ECFDF5';
          for (const line of lines) {
            ctx.fillText(line, PAD_X + 48, ay);
            ay += 23;
          }
          ay += 12;
        }
        ctx.restore();

        cursorY += item.height + 22;
      }
    });

    return {
      pageNumber,
      totalPages,
      dataUrl: canvas.toDataURL('image/png'),
    };
  });
}

function makeSlug(title: string): string {
  return (
    (title || 'meet-notes')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 44) || 'meet'
  );
}

export function downloadVisualNotesPagePng(
  meetingTitle: string,
  page: RenderedNotePage,
): void {
  const slug = makeSlug(meetingTitle);
  const link = document.createElement('a');
  link.href = page.dataUrl;
  link.download =
    page.totalPages > 1
      ? `${slug}-notes-page-${page.pageNumber}.png`
      : `${slug}-visual-notes.png`;
  link.click();
}

export function downloadAllVisualNotesPngs(
  meetingTitle: string,
  pages: RenderedNotePage[],
): void {
  pages.forEach((page, idx) => {
    setTimeout(() => {
      downloadVisualNotesPagePng(meetingTitle, page);
    }, idx * 260);
  });
}
