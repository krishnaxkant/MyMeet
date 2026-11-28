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
    label: 'Concept',
    accent: '#60A5FA',
    softBg: 'rgba(96, 165, 250, 0.12)',
    border: 'rgba(148, 163, 184, 0.16)',
    glow: 'transparent',
  },
  formula: {
    label: 'Formula & Rule',
    accent: '#FBBF24',
    softBg: 'rgba(251, 191, 36, 0.12)',
    border: 'rgba(251, 191, 36, 0.24)',
    glow: 'transparent',
  },
  step: {
    label: 'Explanation',
    accent: '#34D399',
    softBg: 'rgba(52, 211, 153, 0.12)',
    border: 'rgba(148, 163, 184, 0.16)',
    glow: 'transparent',
  },
  example: {
    label: 'Worked Example',
    accent: '#A78BFA',
    softBg: 'rgba(167, 139, 250, 0.12)',
    border: 'rgba(148, 163, 184, 0.16)',
    glow: 'transparent',
  },
  takeaway: {
    label: 'Key Takeaway',
    accent: '#FB7185',
    softBg: 'rgba(251, 113, 133, 0.12)',
    border: 'rgba(148, 163, 184, 0.16)',
    glow: 'transparent',
  },
};

const FONT_SANS = '"Plus Jakarta Sans", "Inter", "Segoe UI", system-ui, -apple-system, sans-serif';
const FONT_BODY = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif';
const FONT_MONO = '"JetBrains Mono", "Cascadia Code", Consolas, monospace';

const PAGE_W = 1200;
const PAGE_H = 1600;
const SCALE = 2; // 2400 × 3200 ultra-crisp Retina PNG per page
const PAD_X = 78;
const CONTENT_W = PAGE_W - PAD_X * 2;
const CENTER_X = PAGE_W / 2;
const BOTTOM_LIMIT = PAGE_H - 96;

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

  // Calm editorial charcoal-ink canvas (gentle on the eyes, razor-sharp typography)
  ctx.fillStyle = '#090C12';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Subtle top ambient light wash
  const topGlow = ctx.createRadialGradient(260, 60, 10, 260, 60, 560);
  topGlow.addColorStop(0, 'rgba(96, 165, 250, 0.06)');
  topGlow.addColorStop(1, 'rgba(9, 12, 18, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, PAGE_W, 560);

  // Clean understated page frame
  drawRoundedRect(ctx, 24, 24, PAGE_W - 48, PAGE_H - 48, 22);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Page counter pill (top-right)
  ctx.save();
  ctx.font = `600 12px ${FONT_MONO}`;
  const pageTag = `Page ${pageNumber} of ${totalPages}`;
  const tagW = ctx.measureText(pageTag).width + 24;
  drawRoundedRect(ctx, PAGE_W - PAD_X - tagW, 52, tagW, 28, 14);
  ctx.fillStyle = '#111622';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#94A3B8';
  ctx.textBaseline = 'middle';
  ctx.fillText(pageTag, PAGE_W - PAD_X - tagW + 12, 66.5);
  ctx.restore();

  // Footer
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD_X, PAGE_H - 68);
  ctx.lineTo(PAGE_W - PAD_X, PAGE_H - 68);
  ctx.stroke();

  ctx.font = `600 12px ${FONT_BODY}`;
  ctx.fillStyle = '#64748B';
  ctx.textBaseline = 'middle';
  ctx.fillText('MYMEET · AI STUDY NOTES', PAD_X, PAGE_H - 44);
  ctx.textAlign = 'right';
  ctx.fillText(`${pageNumber} / ${totalPages}`, PAGE_W - PAD_X, PAGE_H - 44);
  ctx.restore();

  if (pageNumber === 1) {
    // Editorial cover header on Page 1
    let y = 52;
    ctx.save();
    ctx.font = `700 12px ${FONT_BODY}`;
    const badgeText = envLabel;
    const badgeW = ctx.measureText(badgeText).width + 26;
    drawRoundedRect(ctx, PAD_X, y, badgeW, 28, 14);
    ctx.fillStyle = 'rgba(96, 165, 250, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.34)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#93C5FD';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, PAD_X + 13, y + 14.5);
    ctx.restore();

    y += 44;
    const titleFont = `800 38px ${FONT_SANS}`;
    const titleLines = wrapText(ctx, title, CONTENT_W - 150, titleFont);
    ctx.save();
    ctx.font = titleFont;
    ctx.fillStyle = '#F8FAFC';
    ctx.textBaseline = 'top';
    for (const line of titleLines) {
      ctx.fillText(line, PAD_X, y);
      y += 48;
    }
    ctx.restore();

    // Subtle refined hairline rule
    y += 10;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD_X, y);
    ctx.lineTo(PAD_X + CONTENT_W, y);
    ctx.stroke();

    return { canvas, ctx, startY: y + 28 };
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

  const overviewFont = `400 18px ${FONT_BODY}`;
  const stepTitleFont = `700 21px ${FONT_SANS}`;
  const stepBodyFont = `400 17.5px ${FONT_BODY}`;
  const formulaFont = `500 17px ${FONT_MONO}`;
  const bulletFont = `400 16.5px ${FONT_BODY}`;

  // 1. Measure all logical content blocks
  const blocks: LayoutItem[] = [];

  if (overviewText) {
    const oLines = wrapText(mCtx, overviewText, CONTENT_W - 60, overviewFont);
    blocks.push({
      type: 'overview',
      lines: oLines,
      height: 50 + oLines.length * 29 + 22,
    });
  }

  flowSteps.forEach((step, idx) => {
    const palette = KIND_PALETTES[step.kind] || KIND_PALETTES.concept;
    const nextPalette =
      idx < flowSteps.length - 1
        ? KIND_PALETTES[flowSteps[idx + 1].kind] || palette
        : undefined;

    const titleLines = wrapText(mCtx, step.title, CONTENT_W - 224, stepTitleFont);
    const bodyLines = wrapText(mCtx, step.body, CONTENT_W - 108, stepBodyFont);
    const formulaLines = step.formula
      ? wrapText(mCtx, step.formula, CONTENT_W - 144, formulaFont)
      : [];
    const bulletLineGroups = (step.bullets || []).map((b) =>
      wrapText(mCtx, b, CONTENT_W - 138, bulletFont),
    );

    let h = 34 + titleLines.length * 28 + 12 + bodyLines.length * 28 + 26;
    if (formulaLines.length > 0) {
      h += 16 + formulaLines.length * 27 + 28;
    }
    if (bulletLineGroups.length > 0) {
      h +=
        16 +
        bulletLineGroups.reduce((acc, g) => acc + g.length * 26 + 10, 0) +
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
      height: Math.max(h, 122),
      showArrowAfter: Boolean(step.show_arrow) && idx < flowSteps.length - 1,
      arrowLabel: step.arrow_label,
      nextAccent: nextPalette?.accent,
    });
  });

  if (keyPoints.length > 0) {
    const measuredKeys = keyPoints.map((kp) => {
      const lines = wrapText(mCtx, kp, CONTENT_W - 92, bulletFont);
      return { lines, height: lines.length * 26 + 14 };
    });
    const kpHeight = 56 + measuredKeys.reduce((acc, k) => acc + k.height, 0) + 14;
    blocks.push({
      type: 'keypoints',
      items: measuredKeys,
      height: kpHeight,
    });
  }

  if (actionItems.length > 0) {
    const measuredActs = actionItems.map((act) =>
      wrapText(mCtx, act, CONTENT_W - 92, bulletFont),
    );
    const actHeight = 56 + measuredActs.reduce((acc, l) => acc + l.length * 26 + 14, 0) + 14;
    blocks.push({
      type: 'actions',
      items: measuredActs,
      height: actHeight,
    });
  }

  // 2. Paginate blocks cleanly across as many pages as needed
  const titleLinesEstimate = wrapText(mCtx, safeTitle, CONTENT_W - 150, `800 38px ${FONT_SANS}`);
  const page1StartY = 52 + 44 + titleLinesEstimate.length * 48 + 10 + 28;
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
        drawRoundedRect(ctx, PAD_X, cursorY, CONTENT_W, item.height, 14);
        ctx.fillStyle = '#0F141F';
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        drawRoundedRect(ctx, PAD_X, cursorY + 14, 3.5, item.height - 28, 2);
        ctx.fillStyle = '#60A5FA';
        ctx.fill();

        ctx.save();
        ctx.font = `700 11.5px ${FONT_BODY}`;
        ctx.fillStyle = '#93C5FD';
        ctx.textBaseline = 'top';
        ctx.fillText('OVERVIEW', PAD_X + 26, cursorY + 18);

        ctx.font = overviewFont;
        ctx.fillStyle = '#E2E8F0';
        let oY = cursorY + 44;
        for (const line of item.lines) {
          ctx.fillText(line, PAD_X + 26, oY);
          oY += 29;
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

        // Clean calm editorial surface (zero neon glow)
        drawRoundedRect(ctx, PAD_X, cursorY, CONTENT_W, height, 16);
        ctx.fillStyle = '#0F141F';
        ctx.fill();
        ctx.strokeStyle = palette.border;
        ctx.lineWidth = 1.1;
        ctx.stroke();

        // Subtle left accent stripe
        drawRoundedRect(ctx, PAD_X + 1, cursorY + 16, 3.5, height - 32, 2);
        ctx.fillStyle = palette.accent;
        ctx.fill();

        // Minimal index pill
        const numCx = PAD_X + 38;
        const numCy = cursorY + 38;
        ctx.save();
        ctx.beginPath();
        ctx.arc(numCx, numCy, 16, 0, Math.PI * 2);
        ctx.fillStyle = palette.softBg;
        ctx.fill();

        ctx.font = `700 12.5px ${FONT_MONO}`;
        ctx.fillStyle = palette.accent;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(index + 1).padStart(2, '0'), numCx, numCy + 0.5);
        ctx.restore();

        // Understated kind pill (top-right)
        ctx.save();
        ctx.font = `600 11.5px ${FONT_BODY}`;
        const kindW = ctx.measureText(palette.label).width + 20;
        const kindX = PAD_X + CONTENT_W - kindW - 22;
        const kindY = cursorY + 24;
        drawRoundedRect(ctx, kindX, kindY, kindW, 24, 12);
        ctx.fillStyle = palette.softBg;
        ctx.fill();
        ctx.fillStyle = palette.accent;
        ctx.textBaseline = 'middle';
        ctx.fillText(palette.label, kindX + 10, kindY + 12.5);
        ctx.restore();

        // Title
        let innerY = cursorY + 26;
        ctx.save();
        ctx.font = stepTitleFont;
        ctx.fillStyle = '#F8FAFC';
        ctx.textBaseline = 'top';
        for (const line of titleLines) {
          ctx.fillText(line, PAD_X + 70, innerY);
          innerY += 28;
        }

        // Explanation Body (generous line height for effortless reading)
        innerY += 10;
        ctx.font = stepBodyFont;
        ctx.fillStyle = '#CBD5E1';
        for (const line of bodyLines) {
          ctx.fillText(line, PAD_X + 70, innerY);
          innerY += 28;
        }

        // Formula / Equation Box
        if (formulaLines.length > 0) {
          innerY += 14;
          const fBoxH = formulaLines.length * 27 + 24;
          const fBoxX = PAD_X + 70;
          const fBoxW = CONTENT_W - 96;

          drawRoundedRect(ctx, fBoxX, innerY, fBoxW, fBoxH, 10);
          ctx.fillStyle = '#06090F';
          ctx.fill();
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.28)';
          ctx.lineWidth = 1;
          ctx.stroke();

          drawRoundedRect(ctx, fBoxX, innerY + 8, 3, fBoxH - 16, 2);
          ctx.fillStyle = '#FBBF24';
          ctx.fill();

          ctx.font = formulaFont;
          ctx.fillStyle = '#FDE68A';
          let fY = innerY + 13;
          for (const fl of formulaLines) {
            ctx.fillText(fl, fBoxX + 18, fY);
            fY += 27;
          }
          innerY += fBoxH + 2;
        }

        // Sub-points / Worked Example Steps
        if (bulletLineGroups.length > 0) {
          innerY += 14;
          ctx.font = bulletFont;
          bulletLineGroups.forEach((group, bIdx) => {
            const marker = step.kind === 'example' ? `${bIdx + 1}.` : '•';
            ctx.fillStyle = palette.accent;
            ctx.fillText(marker, PAD_X + 72, innerY);

            ctx.fillStyle = '#E2E8F0';
            for (const bLine of group) {
              ctx.fillText(bLine, PAD_X + 94, innerY);
              innerY += 26;
            }
            innerY += 10;
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
        drawRoundedRect(ctx, PAD_X, cursorY, CONTENT_W, item.height, 14);
        ctx.fillStyle = '#0F141F';
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        ctx.save();
        ctx.font = `700 12px ${FONT_BODY}`;
        ctx.fillStyle = '#93C5FD';
        ctx.textBaseline = 'top';
        ctx.fillText('KEY TAKEAWAYS', PAD_X + 26, cursorY + 20);

        ctx.font = bulletFont;
        let ky = cursorY + 48;
        for (const kp of item.items) {
          ctx.fillStyle = '#60A5FA';
          ctx.beginPath();
          ctx.arc(PAD_X + 30, ky + 10, 3, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#E2E8F0';
          for (const line of kp.lines) {
            ctx.fillText(line, PAD_X + 46, ky);
            ky += 26;
          }
          ky += 14;
        }
        ctx.restore();

        cursorY += item.height + 22;
        return;
      }

      if (item.type === 'actions') {
        drawRoundedRect(ctx, PAD_X, cursorY, CONTENT_W, item.height, 14);
        ctx.fillStyle = '#0C1614';
        ctx.fill();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.24)';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        ctx.save();
        ctx.font = `700 12px ${FONT_BODY}`;
        ctx.fillStyle = '#6EE7B7';
        ctx.textBaseline = 'top';
        ctx.fillText('PRACTICE & NEXT STEPS', PAD_X + 26, cursorY + 20);

        ctx.font = bulletFont;
        let ay = cursorY + 48;
        for (const lines of item.items) {
          ctx.fillStyle = '#34D399';
          ctx.fillText('☐', PAD_X + 26, ay);
          ctx.fillStyle = '#E2E8F0';
          for (const line of lines) {
            ctx.fillText(line, PAD_X + 50, ay);
            ay += 26;
          }
          ay += 14;
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
