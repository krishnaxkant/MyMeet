import { env } from '../config/env.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import type { AuthenticatedUser } from '../middleware/authMiddleware.js';
import {
  consumeOneProCreditIfNeeded,
  getUserSubscriptionStatus,
  type UserSubscriptionStatus,
} from './billingService.js';
import { getMeetingByCode, HttpError, normalizeMeetingCode } from './meetingService.js';
import { getOrCreateProfile } from './profileService.js';

export interface ProNoteDeepSection {
  title: string;
  kind: 'concept' | 'code' | 'derivation' | 'example' | 'decision';
  explanation: string;
  code_or_formula?: string;
  bullets?: string[];
  worked_example?: string;
}

export interface ProComparisonTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface ProExamTrap {
  trap: string;
  fix: string;
}

export interface MeetingProNotesRecord {
  id: string;
  meeting_id: string;
  user_id: string;
  unlock_source: string;
  environment_label: string;
  pro_overview: string;
  deep_sections: ProNoteDeepSection[];
  comparison_table: ProComparisonTable | null;
  exam_traps: ProExamTrap[];
  cheat_sheet: string[];
  pro_markdown: string;
  model_used: string;
  created_at: string;
}

export interface SessionMcqQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correct_index: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  concept: string;
}

export interface MeetingMcqQuizRecord {
  id: string;
  meeting_id: string;
  topic_label: string;
  questions: SessionMcqQuestion[];
  model_used: string;
  created_at: string;
}

export type VisualNoteKind = 'concept' | 'formula' | 'step' | 'example' | 'takeaway';

export interface VisualNoteStep {
  title: string;
  kind: VisualNoteKind;
  body: string;
  formula?: string;
  bullets?: string[];
  show_arrow?: boolean;
  arrow_label?: string;
}

export interface MeetingAiSummaryRecord {
  id: string;
  meeting_id: string;
  environment_type: string;
  environment_label: string;
  overview: string;
  detailed_notes_markdown: string;
  key_points: string[];
  action_items: string[];
  sources_summary: {
    transcript_segments?: number;
    screen_captures?: number;
    chat_messages?: number;
    visual_flow?: VisualNoteStep[];
    regenerate_count?: number;
  };
  model_used: string;
  generated_at: string;
  updated_at: string;
}

export const LARGE_ROOM_AI_THRESHOLD = 8;

type SpeakerAuthority = 'HOST' | 'CO-HOST' | 'PARTICIPANT';

interface TranscriptRow {
  id: string;
  speaker_id: string | null;
  speaker_name: string;
  content: string;
  created_at: string;
}

interface ParticipantRoleRow {
  user_id: string;
  role: string;
}

interface ScreenNoteRow {
  id: string;
  sharer_name: string;
  extracted_text: string;
  created_at: string;
}

interface MessageRow {
  sender_id: string;
  content: string;
  created_at: string;
}

const VALID_KINDS: VisualNoteKind[] = ['concept', 'formula', 'step', 'example', 'takeaway'];

const NON_IMPORTANT_CHATTER_PATTERNS: RegExp[] = [
  // Attendance / roll call
  /\b(roll\s*number|roll\s*no\.?|present\s*(sir|ma'?am|madam)|absent|attendance|mark\s+attendance|haziri)\b/i,
  // Audio / screen / connection / app UI testing checks (English + Hinglish)
  /\b(am\s+i\s+audible|can\s+you\s+hear\s+me|can\s+you\s+see\s+my\s+screen|is\s+my\s+screen\s+visible|screen\s+dikh\s+rahi|awaz\s+aa\s+rahi|voice\s+is\s+breaking|network\s+issue|internet\s+issue)\b/i,
  /\b(mute\s+your\s+mic|unmute\s+yourself|turn\s+off\s+your\s+mic|keep\s+quiet|be\s+quiet|wait\s+a\s+(sec|second|minute)|one\s+minute|join\s+again)\b/i,
  /\b(unable\s+to\s+open|meeting\s+not\s+found|check\s+the\s+code|full\s*screen|ful\s*screen|click\s+karke|button\s+(daba|click)|control[su]*\s+bahut|website\s+mein|phone\s+ke|screen\s+ko)\b/i,
  /\b(light\s+band\s+kar|pankha\s+band|fan\s+band|gate\s+band|pata\s+nahi|kuchh?\s+nahi(n)?\s+(hamen\s+)?karna|kuch\s+nahi|chhod\s+de|rehne\s+de|ruko\s+ek|ek\s+second|ek\s+minute|sun\s+bhai|sun\s+na|haan\s+bhai|kya\s+hua|kya\s+bol\s+raha)\b/i,
  // Repeated greetings / filler
  /^(hi|hello|hey|good\s+(morning|afternoon|evening|night)|ok|okay|yes|no|yeah|haan|ji|hm+|thank\s+you|thanks|bye|bye\s+everyone|welcome|bro|bhai|yaar|arey|acha|accha|theek\s+hai|sahi\s+hai)([\s.!?,]+(hi|hello|hey|ok|okay|haan|ji|bhai|bro|yaar))*[\s.!?,]*$/i,
];

const SUBSTANTIVE_CONTENT_PATTERNS: RegExp[] = [
  /[=^∫√∑±÷×]|=>/,
  /\b(formula|equation|theorem|proof|derivative|integral|matrix|vector|algorithm|complexity|function|variable|database|architecture|protocol|molecule|reaction|voltage|current|velocity|acceleration|momentum|gravity|energy|theorem|definition|concept|principle|chapter|syllabus|exam|homework|assignment|deadline|milestone|roadmap|budget|revenue|decision|action\s+item|strategy|design|implementation|deploy|release|server|client|authentication|encryption|react|python|javascript|typescript|java|sql|physics|chemistry|biology|calculus|algebra|geometry|trigonometry|probability|statistics)\b/i,
];

export function isNonImportantChatter(text: string): boolean {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 10) return true;
  // Drop transcripts that are mostly repeated greetings like "hello hello hello"
  const words = cleaned.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length <= 3) return true;
  const uniqueRatio = new Set(words).size / words.length;
  if (words.length >= 4 && uniqueRatio < 0.45) return true;
  return NON_IMPORTANT_CHATTER_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function hasRealSubstantiveContent(text: string): boolean {
  if (isNonImportantChatter(text)) return false;
  if (SUBSTANTIVE_CONTENT_PATTERNS.some((p) => p.test(text))) return true;
  // Otherwise require a genuinely meaningful multi-word explanation (>= 12 words)
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length >= 12;
}

const isPlaceholder = (value: string): boolean => {
  return !value || value.includes('your-') || value.trim().length === 0;
};

export function isGeminiConfigured(): boolean {
  return !isPlaceholder(env.geminiApiKey);
}

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new HttpError(503, 'Supabase is not configured on the backend.');
  }
  return supabase;
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const GEMINI_FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
];

function getGeminiModelCandidates(useProTier = false): string[] {
  const baseList = useProTier
    ? [env.geminiProModel, 'gemini-3-flash-preview', env.geminiModel, ...GEMINI_FALLBACK_MODELS]
    : [env.geminiModel, ...GEMINI_FALLBACK_MODELS];
  const ordered = baseList
    .map((m) => m.trim())
    .filter((m) => m.length > 0 && m !== 'gemini-2.5-flash');
  return Array.from(new Set(ordered));
}

async function callGeminiApi(
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
  expectJson = false,
  useProTier = false,
): Promise<{ text: string; model: string } | null> {
  if (!isGeminiConfigured()) return null;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: useProTier ? 0.3 : 0.35,
      ...(expectJson ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const candidates = getGeminiModelCandidates(useProTier);
  for (const model of candidates) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(25_000),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          const retrySameModel = response.status === 500 || response.status === 502 || response.status === 504;
          console.warn(
            `[ai-agent] Gemini (${model}) HTTP ${response.status} (attempt ${attempt}/2):`,
            errText.slice(0, 200),
          );
          if (retrySameModel && attempt < 2) {
            await sleepMs(1000);
            continue;
          }
          // Immediately fail over to next healthy model on 404 / 429 / 503
          break;
        }

        const json = (await response.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };

        const text = json.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? '')
          .join('')
          .trim();

        if (text) {
          return { text, model };
        }
        break;
      } catch (err) {
        console.warn(`[ai-agent] Gemini (${model}) request failed (attempt ${attempt}/2):`, err);
        if (attempt < 2) {
          await sleepMs(900);
          continue;
        }
      }
    }
  }

  return null;
}

export async function recordMeetingTranscript(
  rawCode: string,
  user: AuthenticatedUser,
  content: string,
  speakerNameOverride?: string,
): Promise<{ ok: true; skipped?: boolean }> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new HttpError(400, 'Transcript text is empty.');
  }

  // Skip obvious attendance, greetings, mic checks, and filler chatter before saving
  if (isNonImportantChatter(trimmed)) {
    return { ok: true, skipped: true };
  }

  const meeting = await getMeetingByCode(rawCode, user.id);
  if (!meeting.is_host && meeting.my_status !== 'joined') {
    throw new HttpError(403, 'You must be joined to record voice transcripts.');
  }

  // Smart 100-person scale guard: in large rooms (>8 joined), only Host & Co-Hosts capture AI voice
  if (meeting.joined_count > LARGE_ROOM_AI_THRESHOLD && !meeting.can_manage) {
    return { ok: true, skipped: true };
  }

  const supabase = requireSupabase();
  const profile = await getOrCreateProfile(user.id, user.email, user.fullName);
  const speakerName =
    speakerNameOverride?.trim() || profile.full_name || user.email || 'Participant';

  const { error } = await supabase.from('meeting_transcripts').insert({
    meeting_id: meeting.id,
    speaker_id: user.id,
    speaker_name: speakerName,
    content: trimmed.slice(0, 2000),
  });

  if (error) {
    throw new HttpError(500, `Failed to save voice transcript: ${error.message}`);
  }

  return { ok: true, skipped: false };
}

export async function transcribeAndStoreAudioChunk(
  rawCode: string,
  user: AuthenticatedUser,
  input: { audioBase64: string; mimeType?: string; speakerName?: string },
): Promise<{ saved: boolean; skipped: boolean; usedAi: boolean; text?: string }> {
  const meeting = await getMeetingByCode(rawCode, user.id);
  if (!meeting.is_host && meeting.my_status !== 'joined') {
    throw new HttpError(403, 'You must be joined to transcribe meeting audio.');
  }

  // Smart 100-person scale guard: in large rooms (>8 joined), only Host & Co-Hosts call Gemini Audio
  if (meeting.joined_count > LARGE_ROOM_AI_THRESHOLD && !meeting.can_manage) {
    return { saved: false, skipped: true, usedAi: true };
  }

  if (!isGeminiConfigured()) {
    return { saved: false, skipped: true, usedAi: false };
  }

  const cleanedBase64 = input.audioBase64
    .replace(/^data:audio\/[a-zA-Z0-9+.;=\-\s]+;base64,/, '')
    .trim();
  if (!cleanedBase64 || cleanedBase64.length > 4_000_000) {
    throw new HttpError(400, 'Invalid or oversized audio chunk payload.');
  }

  // Gemini expects clean base MIME type without codec parameters (e.g. "audio/webm", "audio/mp4")
  const rawMime = (input.mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
  const mimeType = /^audio\/(webm|ogg|mp4|mpeg|wav|mp3|aac|flac)$/.test(rawMime)
    ? rawMime
    : 'audio/webm';

  const extractedRes = await callGeminiApi([
    {
      text: [
        `You are an intelligent AI Note-Taker listening to a live audio clip from "${meeting.title}".`,
        'The speaker may speak in English, Hindi, or Hinglish (mixed Hindi + English).',
        '',
        'YOUR JOB:',
        '- Transcribe and distill ONLY genuinely IMPORTANT educational, technical, or meeting content (concepts taught, formulas/equations explained, definitions, worked examples, code logic, decisions, homework, or deadlines).',
        '- Write the distilled points in clear, concise English (preserving exact math formulas, terms, and technical names in plain readable Unicode math, never raw LaTeX).',
        '',
        'STRICTLY IGNORE AND DO NOT INCLUDE:',
        '- Roll call / attendance ("roll number 12", "present sir", "absent", "attendance le raha hoon").',
        '- Tech/audio checks ("am I audible?", "can you see my screen?", "awaz aa rahi hai?", "network issue", "mute your mic").',
        '- Greetings, waiting, classroom discipline, jokes, or casual small talk ("good morning", "wait 2 minutes", "let others join", "be quiet", "ok thank you").',
        '',
        'OUTPUT RULE:',
        '- If this audio clip has ONLY silence, background noise, attendance, greetings, or non-important chatter, reply with the single word: SKIP',
        '- Otherwise, return ONLY the clean important spoken content (no speaker labels, no timestamps, no meta commentary).',
      ].join('\n'),
    },
    {
      inlineData: {
        mimeType,
        data: cleanedBase64,
      },
    },
  ]);

  if (!extractedRes?.text) {
    return { saved: false, skipped: true, usedAi: false };
  }

  const normalized = extractedRes.text.replace(/^["'`]+|["'`]+$/g, '').trim();
  if (
    !normalized ||
    /^SKIP\b/i.test(normalized) ||
    isNonImportantChatter(normalized)
  ) {
    return { saved: false, skipped: true, usedAi: true };
  }

  const supabase = requireSupabase();
  const profile = await getOrCreateProfile(user.id, user.email, user.fullName);
  const speakerName =
    input.speakerName?.trim() || profile.full_name || user.email || 'Speaker';

  const { error } = await supabase.from('meeting_transcripts').insert({
    meeting_id: meeting.id,
    speaker_id: user.id,
    speaker_name: speakerName,
    content: normalized.slice(0, 2000),
  });

  if (error) {
    throw new HttpError(500, `Failed to save audio transcript: ${error.message}`);
  }

  return { saved: true, skipped: false, usedAi: true, text: normalized };
}

export async function analyzeAndStoreScreenFrame(
  rawCode: string,
  user: AuthenticatedUser,
  input: { imageBase64: string; mimeType?: string; sharerName?: string },
): Promise<{ extractedText: string; usedAi: boolean }> {
  const meeting = await getMeetingByCode(rawCode, user.id);
  if (!meeting.is_host && meeting.my_status !== 'joined') {
    throw new HttpError(403, 'You must be joined to analyze shared screens.');
  }

  const cleanedBase64 = input.imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
  if (!cleanedBase64 || cleanedBase64.length > 3_500_000) {
    throw new HttpError(400, 'Invalid or oversized screen capture payload.');
  }

  const mimeType = input.mimeType || 'image/jpeg';
  const sharerName = input.sharerName?.trim() || 'Screen Share';

  let extractedText: string | null = null;
  let usedAi = false;

  if (isGeminiConfigured()) {
    const screenRes = await callGeminiApi([
      {
        text: [
          `Analyze the shared screen content from "${meeting.title}".`,
          'Extract ALL educational, mathematical, technical, or presentation content visible on screen:',
          '- Transcribe every equation, formula, theorem, variable definition, and worked calculation step accurately in clean Unicode math (no raw LaTeX backslashes).',
          '- Capture code blocks, diagrams described in clear steps, headings, and key bullet points.',
          '- Do NOT mention browser tabs, app UI chrome, who is sharing, or meeting metadata.',
          '- Keep it clear, structured, and strictly factual (up to 260 words).',
        ].join('\n'),
      },
      {
        inlineData: {
          mimeType,
          data: cleanedBase64,
        },
      },
    ]);
    extractedText = screenRes?.text ?? null;
    usedAi = Boolean(extractedText);
  }

  const finalNote =
    extractedText ||
    'Visual screen frame captured (configure GEMINI_API_KEY in .env to extract equations, slides, and diagrams automatically).';

  const supabase = requireSupabase();
  const { error } = await supabase.from('meeting_screen_notes').insert({
    meeting_id: meeting.id,
    captured_by: user.id,
    sharer_name: sharerName,
    extracted_text: finalNote,
  });

  if (error) {
    throw new HttpError(500, `Failed to save screen note: ${error.message}`);
  }

  return { extractedText: finalNote, usedAi };
}

function detectEnvironmentHeuristic(
  title: string,
  corpus: string,
): { type: string; label: string } {
  const combined = `${title} ${corpus}`.toLowerCase();

  if (
    /\b(math|algebra|calculus|geometry|trigonometry|equation|theorem|integral|derivative|matrix|formula|proof|polynomial|quadratic|probability|statistics)\b/.test(
      combined,
    )
  ) {
    return { type: 'math_class', label: 'Math Class · Study Notes' };
  }

  if (
    /\b(code|coding|algorithm|react|typescript|python|javascript|database|sql|function|api|architecture|system design|dsa)\b/.test(
      combined,
    )
  ) {
    return { type: 'coding_session', label: 'Coding & Technical Notes' };
  }

  if (
    /\b(class|lecture|lesson|chapter|syllabus|exam|homework|assignment|physics|chemistry|biology|study|tutorial|course)\b/.test(
      combined,
    )
  ) {
    return { type: 'class_lecture', label: 'Lecture · Study Notes' };
  }

  if (
    /\b(sprint|standup|roadmap|deploy|bug|release|deadline|client|kpi|quarter|strategy|product)\b/.test(
      combined,
    )
  ) {
    return { type: 'team_meeting', label: 'Discussion & Decisions Notes' };
  }

  if (/\b(interview|candidate|resume|role|hiring)\b/.test(combined)) {
    return { type: 'interview', label: 'Interview · Key Notes' };
  }

  return { type: 'general', label: 'Visual Topic Notes' };
}

function detectStepKind(text: string, index: number, total: number): VisualNoteKind {
  if (/[=^∫√∑±÷×]|=>|\b(formula|equation|theorem|rule|law|syntax|code)\b/i.test(text)) {
    return 'formula';
  }
  if (/\b(example|for instance|suppose|consider|sample|e\.g\.|solve|let x)\b/i.test(text)) {
    return 'example';
  }
  if (index === total - 1 && total >= 3) {
    return 'takeaway';
  }
  if (index === 0) {
    return 'concept';
  }
  return 'step';
}

function extractInlineFormula(text: string): string | undefined {
  const match = text.match(/([A-Za-z0-9()[\]\s^/*+\-√∫∑±]{2,42}\s*=\s*[A-Za-z0-9()[\]\s^/*+\-√∫∑±.,]{1,50})/);
  if (match && match[1].trim().length >= 5) {
    return match[1].trim();
  }
  return undefined;
}

function sanitizeVisualFlow(raw: unknown): VisualNoteStep[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: VisualNoteStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    const body = typeof obj.body === 'string' ? obj.body.trim() : '';
    if (!title && !body) continue;

    const rawKind = typeof obj.kind === 'string' ? obj.kind.trim().toLowerCase() : 'concept';
    const kind: VisualNoteKind = VALID_KINDS.includes(rawKind as VisualNoteKind)
      ? (rawKind as VisualNoteKind)
      : 'concept';

    const formula =
      typeof obj.formula === 'string' && obj.formula.trim().length > 0
        ? obj.formula.trim().slice(0, 180)
        : undefined;

    const bullets = Array.isArray(obj.bullets)
      ? obj.bullets
          .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
          .map((b) => b.trim().slice(0, 240))
          .slice(0, 8)
      : undefined;

    const showArrow = obj.show_arrow === true;
    const arrowLabel =
      showArrow && typeof obj.arrow_label === 'string' && obj.arrow_label.trim().length > 0
        ? obj.arrow_label.trim().slice(0, 44)
        : undefined;

    cleaned.push({
      title: (title || 'Topic Section').slice(0, 110),
      kind,
      body: (body || title).slice(0, 700),
      ...(formula ? { formula } : {}),
      ...(bullets && bullets.length > 0 ? { bullets } : {}),
      show_arrow: showArrow,
      ...(arrowLabel ? { arrow_label: arrowLabel } : {}),
    });
  }
  return cleaned.slice(0, 16);
}

function resolveSpeakerAuthority(
  userId: string | null | undefined,
  hostId: string,
  roleMap: Map<string, SpeakerAuthority>,
): SpeakerAuthority {
  if (!userId) return 'PARTICIPANT';
  if (userId === hostId) return 'HOST';
  return roleMap.get(userId) ?? 'PARTICIPANT';
}

function buildFallbackSummary(params: {
  title: string;
  hostId: string;
  roleMap: Map<string, SpeakerAuthority>;
  transcripts: TranscriptRow[];
  screenNotes: ScreenNoteRow[];
  chatContents: string[];
}): {
  environment_type: string;
  environment_label: string;
  overview: string;
  detailed_notes_markdown: string;
  key_points: string[];
  action_items: string[];
  visual_flow: VisualNoteStep[];
} {
  const usableScreenNotes = params.screenNotes
    .map((s) => s.extracted_text.trim())
    .filter(
      (txt) =>
        txt.length > 0 &&
        !txt.startsWith('Shared screen frame captured') &&
        !txt.startsWith('Visual screen frame captured'),
    );

  // Prefer Host & Co-Host spoken content when present so participant chatter doesn't dominate fallback
  const hostTranscripts = params.transcripts
    .filter((t) => {
      const auth = resolveSpeakerAuthority(t.speaker_id, params.hostId, params.roleMap);
      return auth === 'HOST' || auth === 'CO-HOST';
    })
    .map((t) => t.content.trim())
    .filter((txt) => hasRealSubstantiveContent(txt));

  const allTranscripts = params.transcripts
    .map((t) => t.content.trim())
    .filter((txt) => hasRealSubstantiveContent(txt));

  const usableTranscripts = hostTranscripts.length > 0 ? hostTranscripts : allTranscripts;

  const usableChats = params.chatContents
    .map((c) => c.trim())
    .filter((c) => !c.startsWith('[Recording') && hasRealSubstantiveContent(c));

  const corpus = [...usableScreenNotes, ...usableTranscripts, ...usableChats].join(' ');
  const envDetected = detectEnvironmentHeuristic(params.title, corpus);

  // Merge consecutive short spoken sentences into coherent study paragraphs (no speaker metadata)
  const groupedTranscriptBlocks: string[] = [];
  let buffer = '';
  for (const line of usableTranscripts) {
    if (!buffer) {
      buffer = line;
    } else if (buffer.length + line.length < 340) {
      buffer = `${buffer}. ${line}`.replace(/\.\.+/g, '.');
    } else {
      groupedTranscriptBlocks.push(buffer);
      buffer = line;
    }
  }
  if (buffer) groupedTranscriptBlocks.push(buffer);

  const contentBlocks: string[] = [];
  for (const item of [...usableScreenNotes, ...groupedTranscriptBlocks, ...usableChats]) {
    const clean = item.replace(/\s+/g, ' ').trim();
    if (clean && !contentBlocks.includes(clean)) {
      contentBlocks.push(clean);
    }
  }

  const keyPoints = contentBlocks.slice(0, 8).map((c) => c.slice(0, 220));

  const actionItems = [...usableTranscripts, ...usableChats]
    .filter((c) =>
      /\b(todo|action|homework|assign|submit|review|next|follow up|deadline|practice|exercise|solve)\b/i.test(
        c,
      ),
    )
    .slice(0, 6)
    .map((c) => c.slice(0, 220));

  let visualFlow: VisualNoteStep[] = [];
  if (contentBlocks.length > 0) {
    const source = contentBlocks.slice(0, 12);
    visualFlow = source.map((text, idx) => {
      const kind = detectStepKind(text, idx, source.length);
      const nextKind =
        idx < source.length - 1 ? detectStepKind(source[idx + 1], idx + 1, source.length) : null;
      const formula = extractInlineFormula(text);
      const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 6);
      const mainBody = sentences[0] || text;
      const extraBullets = sentences.length > 1 ? sentences.slice(1, 5) : undefined;

      // Selective arrows ONLY where logically connected (e.g. formula -> example, concept -> formula/step)
      const shouldShowArrow =
        idx < source.length - 1 &&
        ((kind === 'formula' && (nextKind === 'example' || nextKind === 'step')) ||
          (kind === 'concept' && nextKind === 'formula') ||
          (kind === 'step' && nextKind === 'step'));

      const arrowLabel =
        kind === 'formula' && nextKind === 'example'
          ? 'Worked Example'
          : kind === 'concept' && nextKind === 'formula'
            ? 'Formula / Rule'
            : shouldShowArrow
              ? 'Next Step'
              : undefined;

      const titleLabel =
        kind === 'formula'
          ? 'Formula & Explanation'
          : kind === 'example'
            ? 'Worked Example'
            : kind === 'takeaway'
              ? 'Key Summary'
              : idx === 0
                ? 'Core Concept'
                : `Topic Point ${idx + 1}`;

      return {
        title: titleLabel,
        kind,
        body: mainBody.slice(0, 420),
        ...(formula ? { formula } : {}),
        ...(extraBullets && extraBullets.length > 0 ? { bullets: extraBullets } : {}),
        show_arrow: shouldShowArrow,
        ...(arrowLabel ? { arrow_label: arrowLabel } : {}),
      };
    });
  } else {
    // Zero genuinely important study/work content — NEVER fabricate fake notes from casual talk!
    return {
      environment_type: 'no_important_content',
      environment_label: 'Casual Session · No Study Notes',
      overview:
        'No important educational, technical, or business content was detected in this session. Casual conversation, greetings, and audio/UI checks were automatically filtered out.',
      detailed_notes_markdown: `# ${params.title}\n\nNo important study or meeting notes were detected in this session (casual conversation was automatically filtered out).`,
      key_points: [],
      action_items: [],
      visual_flow: [],
    };
  }

  const overview =
    contentBlocks.length > 0
      ? contentBlocks.slice(0, 2).join(' ').slice(0, 380)
      : `Topic: ${params.title}. No spoken content or shared-screen material was captured yet.`;

  const mdSections = [
    `# ${params.title}`,
    `**Topic Area:** ${envDetected.label}`,
    '',
    '## Core Overview',
    overview,
    '',
    '## Detailed Study Notes',
    ...visualFlow.map(
      (step, i) =>
        `### ${i + 1}. ${step.title}\n${step.body}${step.formula ? `\n\n\`${step.formula}\`` : ''}${
          step.bullets?.length ? `\n${step.bullets.map((b) => `- ${b}`).join('\n')}` : ''
        }`,
    ),
  ];

  if (actionItems.length > 0) {
    mdSections.push('', '## Practice / Next Steps', ...actionItems.map((a) => `- [ ] ${a}`));
  }

  return {
    environment_type: envDetected.type,
    environment_label: envDetected.label,
    overview,
    detailed_notes_markdown: mdSections.join('\n\n'),
    key_points: keyPoints,
    action_items: actionItems,
    visual_flow: visualFlow,
  };
}

export async function generateMeetingAiSummaryById(
  meetingId: string,
  regenerateCount = 0,
): Promise<MeetingAiSummaryRecord | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data: meeting, error: mErr } = await supabase
    .from('meetings')
    .select('id, code, title, host_id, started_at, ended_at, created_at')
    .eq('id', meetingId)
    .maybeSingle<{
      id: string;
      code: string;
      title: string;
      host_id: string;
      started_at: string | null;
      ended_at: string | null;
      created_at: string;
    }>();

  if (mErr || !meeting) return null;

  const [transcriptsRes, screenRes, msgsRes, participantsRes] = await Promise.all([
    supabase
      .from('meeting_transcripts')
      .select('id, speaker_id, speaker_name, content, created_at')
      .eq('meeting_id', meeting.id)
      .order('created_at', { ascending: true })
      .limit(500),
    supabase
      .from('meeting_screen_notes')
      .select('id, sharer_name, extracted_text, created_at')
      .eq('meeting_id', meeting.id)
      .order('created_at', { ascending: true })
      .limit(80),
    supabase
      .from('meeting_messages')
      .select('sender_id, content, created_at')
      .eq('meeting_id', meeting.id)
      .order('created_at', { ascending: true })
      .limit(200),
    supabase
      .from('meeting_participants')
      .select('user_id, role')
      .eq('meeting_id', meeting.id),
  ]);

  const transcripts = (transcriptsRes.data ?? []) as TranscriptRow[];
  const screenNotes = (screenRes.data ?? []) as ScreenNoteRow[];
  const msgRows = (msgsRes.data ?? []) as MessageRow[];
  const participantRoles = (participantsRes.data ?? []) as ParticipantRoleRow[];

  const roleMap = new Map<string, SpeakerAuthority>();
  roleMap.set(meeting.host_id, 'HOST');
  for (const row of participantRoles) {
    if (row.user_id === meeting.host_id || row.role === 'host') {
      roleMap.set(row.user_id, 'HOST');
    } else if (row.role === 'co_host') {
      roleMap.set(row.user_id, 'CO-HOST');
    } else if (!roleMap.has(row.user_id)) {
      roleMap.set(row.user_id, 'PARTICIPANT');
    }
  }

  const formattedTranscripts = transcripts.map((t) => {
    const auth = resolveSpeakerAuthority(t.speaker_id, meeting.host_id, roleMap);
    const label = t.speaker_name ? `${auth} · ${t.speaker_name}` : auth;
    return `- [${label}]: ${t.content}`;
  });

  const formattedChats = msgRows
    .map((m) => {
      const content = m.content.trim();
      if (!content || content.startsWith('[Recording')) return null;
      const auth = resolveSpeakerAuthority(m.sender_id, meeting.host_id, roleMap);
      return `- [${auth}]: ${content}`;
    })
    .filter((line): line is string => Boolean(line));

  const chatContents = msgRows
    .map((m) => m.content.trim())
    .filter((c) => c.length > 0 && !c.startsWith('[Recording'));

  const usableScreenTexts = screenNotes
    .map((s) => s.extracted_text.trim())
    .filter(
      (txt) =>
        txt.length > 0 &&
        !txt.startsWith('Shared screen frame captured') &&
        !txt.startsWith('Visual screen frame captured'),
    );

  let generated: {
    environment_type: string;
    environment_label: string;
    overview: string;
    detailed_notes_markdown: string;
    key_points: string[];
    action_items: string[];
    visual_flow: VisualNoteStep[];
  } | null = null;
  let modelUsed = 'meet-built-in-analyzer';

  const hasRichContent =
    transcripts.length > 0 || usableScreenTexts.length > 0 || chatContents.length > 0;

  if (isGeminiConfigured() && hasRichContent) {
    const prompt = [
      'You are an expert Study Notes & Meeting Synthesizer for Meet.',
      'Your job is to combine EVERYTHING the host/speaker explained by voice AND EVERYTHING shown on the shared screen into thorough, crystal-clear, multi-page notes that anyone can study from and understand completely.',
      '',
      'STRICT QUALITY & SPEAKER AUTHORITY RULES:',
      '1. HOST & CO-HOST FINAL AUTHORITY (DECISION RESOLUTION): Transcripts are ordered chronologically and tagged with [HOST], [CO-HOST], or [PARTICIPANT]. Treat [HOST] and [CO-HOST] as the PRIMARY SOURCE OF TRUTH for all concepts, formulas, final decisions, deadlines, and action items.',
      '   - If a [PARTICIPANT] makes a wrong guess, incorrect answer, or rejected proposal and [HOST]/[CO-HOST] corrects, rejects, or overrides it, STRICTLY EXCLUDE the rejected/wrong idea and record ONLY the [HOST]/[CO-HOST] final decision.',
      '   - If a [PARTICIPANT] raises a valid doubt or proposes an idea that [HOST]/[CO-HOST] clearly approves, confirms, or builds upon (e.g. "yes/haan sahi hai", "good idea, let us do that", "agreed", "correct"), CLEANLY SYNTHESIZE that approved idea or Q&A into the notes as a finalized point.',
      '   - Drop unconfirmed, ignored, or off-topic [PARTICIPANT] side-comments.',
      '2. RUTHLESS NOISE & CASUAL CHAT FILTER: Include ONLY genuinely important subject matter — concepts taught, formulas/equations, derivations, worked examples, code/architecture, project decisions, deadlines, or action items. STRICTLY IGNORE and NEVER include: casual friend banter, Hinglish/Hindi small talk ("pata nahi", "light band kar le", "kuch nahi karna", "hello hello"), app/UI/button testing ("full screen pe click karo", "check the code", "meeting not found"), attendance/roll call ("present sir", "roll no."), greetings, mic/screen checks, or participant counts.',
      '3. EMPTY-SESSION GATEKEEPER: If the transcripts/chat contain ONLY casual talk, greetings, jokes, UI/app testing, or non-substantive chatter with NO real educational, technical, or work topic discussed, you MUST set "has_important_content": false, "environment_type": "no_important_content", "environment_label": "Casual Session · No Study Notes", "overview": "No important educational, technical, or business content was detected in this session. Casual conversation was automatically filtered out.", "visual_flow": [], "key_points": [], "action_items": [], and "detailed_notes_markdown": "No important notes detected." NEVER fabricate study notes or formulas out of casual chatter!',
      '4. DEEP & COMPLETE WHEN SUBSTANTIVE (MULTI-PAGE READY): When real teaching or work discussion occurred, create clear sections in `visual_flow` (4 to 14 sections) covering every important topic, formula, and explanation thoroughly.',
      '5. FORMULAS + EXPLANATIONS + EXAMPLES: Only use `kind: "formula"` when an actual mathematical/scientific formula, theorem, rule, or code snippet was taught. Never put casual sentences under "Formula & Explanation". Always write equations in clean, human-readable Unicode math (e.g. `T = (2u sin θ) / g`, `u²`, `√`, `θ`, `°`) — NEVER raw LaTeX commands like `\\frac`, `\\quad`, or `\\text`.',
      '6. SELECTIVE ARROWS ONLY: Set `"show_arrow": true` ONLY when a block directly flows into or derives the very next block.',
      '7. Only include `action_items` if actual homework, practice problems, or concrete next steps were confirmed by [HOST]/[CO-HOST] (otherwise return []).',
      '',
      'Return ONLY a valid JSON object matching this exact schema:',
      '{',
      '  "has_important_content": true,',
      '  "environment_type": "math_class | class_lecture | coding_session | team_meeting | interview | general | no_important_content",',
      '  "environment_label": "Short topic label e.g. Math Class · Quadratic Equations or System Design · Caching",',
      '  "overview": "2-4 clear sentences summarizing the core subject matter and main finalized conclusions",',
      '  "visual_flow": [',
      '    {',
      '      "title": "Clear section heading (3-8 words)",',
      '      "kind": "concept | formula | step | example | takeaway",',
      '      "body": "Thorough, easy-to-understand explanation of what was taught or finalized (2-4 sentences)",',
      '      "formula": "Optional equation, theorem, or code snippet in clean Unicode math (omit if none)",',
      '      "bullets": ["Optional array of 2-6 clear sub-points, variable meanings, or worked solution steps"],',
      '      "show_arrow": true,',
      '      "arrow_label": "Only include when show_arrow is true (e.g. Worked Example, Apply Formula, Leads to)"',
      '    }',
      '  ],',
      '  "key_points": ["4 to 8 crisp quick-revision takeaways, formulas, or finalized decisions"],',
      '  "action_items": ["Homework, practice problems, or concrete action items approved by Host/Co-Host (empty array if none)"],',
      '  "detailed_notes_markdown": "Complete content-only Markdown notes"',
      '}',
      '',
      `Session Topic: ${meeting.title}`,
      '',
      '--- CHRONOLOGICAL SPOKEN VOICE CONTENT (WITH SPEAKER AUTHORITY ROLES) ---',
      formattedTranscripts.length > 0 ? formattedTranscripts.join('\n') : '(None)',
      '',
      '--- SHARED SCREEN / BOARD CONTENT (WHAT WAS SHOWN) ---',
      usableScreenTexts.length > 0
        ? usableScreenTexts.map((s) => `- ${s}`).join('\n')
        : '(None)',
      '',
      '--- CHAT NOTES (WITH SPEAKER AUTHORITY ROLES) ---',
      formattedChats.length > 0 ? formattedChats.join('\n') : '(None)',
    ].join('\n');

    const geminiSummaryRes = await callGeminiApi([{ text: prompt }], true);
    const rawJson = geminiSummaryRes?.text ?? null;
    if (rawJson) {
      try {
        const cleaned = rawJson.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(cleaned) as Partial<{
          has_important_content: boolean;
          environment_type: string;
          environment_label: string;
          overview: string;
          detailed_notes_markdown: string;
          key_points: string[];
          action_items: string[];
          visual_flow: unknown;
        }>;

        if (
          parsed.has_important_content === false ||
          parsed.environment_type === 'no_important_content'
        ) {
          generated = {
            environment_type: 'no_important_content',
            environment_label: 'Casual Session · No Study Notes',
            overview:
              parsed.overview ||
              'No important educational, technical, or business content was detected in this session. Casual conversation was automatically filtered out.',
            detailed_notes_markdown: `# ${meeting.title}\n\nNo important study or meeting notes were detected in this session.`,
            key_points: [],
            action_items: [],
            visual_flow: [],
          };
          modelUsed = geminiSummaryRes?.model || env.geminiModel;
        } else if (parsed.overview) {
          const parsedFlow = sanitizeVisualFlow(parsed.visual_flow);
          const keyPoints = Array.isArray(parsed.key_points)
            ? parsed.key_points.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            : [];
          const actionItems = Array.isArray(parsed.action_items)
            ? parsed.action_items.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            : [];

          const visualFlow =
            parsedFlow.length > 0
              ? parsedFlow
              : keyPoints.slice(0, 8).map((pt, idx, arr) => ({
                  title: idx === 0 ? 'Core Concept' : `Key Point ${idx + 1}`,
                  kind: detectStepKind(pt, idx, arr.length),
                  body: pt,
                  ...(extractInlineFormula(pt) ? { formula: extractInlineFormula(pt) } : {}),
                  show_arrow: false,
                }));

          generated = {
            environment_type: parsed.environment_type || 'general',
            environment_label: parsed.environment_label || 'Visual Study Notes',
            overview: parsed.overview,
            detailed_notes_markdown:
              parsed.detailed_notes_markdown ||
              [`# ${meeting.title}`, '', parsed.overview, '', ...keyPoints.map((k) => `- ${k}`)].join(
                '\n',
              ),
            key_points: keyPoints,
            action_items: actionItems,
            visual_flow: visualFlow,
          };
          modelUsed = geminiSummaryRes?.model || env.geminiModel;
        }
      } catch (err) {
        console.warn('[ai-agent] Failed to parse Gemini JSON summary:', err);
      }
    }
  }

  if (!generated) {
    generated = buildFallbackSummary({
      title: meeting.title,
      hostId: meeting.host_id,
      roleMap,
      transcripts,
      screenNotes,
      chatContents,
    });
  }

  const sourcesSummary = {
    transcript_segments: transcripts.length,
    screen_captures: screenNotes.length,
    chat_messages: chatContents.length,
    visual_flow: generated.visual_flow,
    regenerate_count: regenerateCount,
  };

  const { data: saved, error: upsertErr } = await supabase
    .from('meeting_ai_summaries')
    .upsert(
      {
        meeting_id: meeting.id,
        environment_type: generated.environment_type,
        environment_label: generated.environment_label,
        overview: generated.overview,
        detailed_notes_markdown: generated.detailed_notes_markdown,
        key_points: generated.key_points,
        action_items: generated.action_items,
        sources_summary: sourcesSummary,
        model_used: modelUsed,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'meeting_id' },
    )
    .select('*')
    .single<MeetingAiSummaryRecord>();

  if (upsertErr || !saved) {
    console.warn('[ai-agent] Could not persist AI summary:', upsertErr?.message);
    return null;
  }

  return saved;
}

export async function generateMeetingAiSummaryForUser(
  rawCode: string,
  userId: string,
): Promise<MeetingAiSummaryRecord> {
  const code = normalizeMeetingCode(rawCode);
  const supabase = requireSupabase();

  const { data: meeting, error } = await supabase
    .from('meetings')
    .select('id, host_id')
    .eq('code', code)
    .maybeSingle<{ id: string; host_id: string }>();

  if (error) {
    throw new HttpError(500, `Failed to look up meeting: ${error.message}`);
  }
  if (!meeting) {
    throw new HttpError(404, 'Meeting not found.');
  }

  if (meeting.host_id !== userId) {
    const { data: part } = await supabase
      .from('meeting_participants')
      .select('id')
      .eq('meeting_id', meeting.id)
      .eq('user_id', userId)
      .maybeSingle<{ id: string }>();

    if (!part) {
      throw new HttpError(403, 'You do not have permission to generate notes for this meeting.');
    }
  }

  // Enforce max 2 free regenerations unless user has Unlimited Monthly (₹349) or Yearly (₹899) plan
  const { data: existingSummary } = await supabase
    .from('meeting_ai_summaries')
    .select('id, sources_summary')
    .eq('meeting_id', meeting.id)
    .maybeSingle<{ id: string; sources_summary?: { regenerate_count?: number } | null }>();

  let nextRegenCount = 0;
  if (existingSummary) {
    const prevCount = Number(existingSummary.sources_summary?.regenerate_count ?? 0);
    const subscription = await getUserSubscriptionStatus(userId);
    if (!subscription.is_unlimited && prevCount >= 2) {
      throw new HttpError(
        402,
        'Free regenerate limit (2/2) reached. Upgrade to Pro Monthly (₹349/mo) or Pro Yearly (₹899/yr) for unlimited regenerations.',
      );
    }
    nextRegenCount = prevCount + 1;
  }

  const summary = await generateMeetingAiSummaryById(meeting.id, nextRegenCount);
  if (!summary) {
    throw new HttpError(
      500,
      'Could not save AI summary. Make sure you ran the latest AI Agent SQL migration in Supabase.',
    );
  }

  return summary;
}

async function assertMeetingAccessAndLoadContext(rawCode: string, userId: string) {
  const code = normalizeMeetingCode(rawCode);
  const supabase = requireSupabase();

  const { data: meeting, error } = await supabase
    .from('meetings')
    .select('id, code, title, host_id')
    .eq('code', code)
    .maybeSingle<{ id: string; code: string; title: string; host_id: string }>();

  if (error) {
    throw new HttpError(500, `Failed to look up meeting: ${error.message}`);
  }
  if (!meeting) {
    throw new HttpError(404, 'Meeting not found.');
  }

  if (meeting.host_id !== userId) {
    const { data: part } = await supabase
      .from('meeting_participants')
      .select('id')
      .eq('meeting_id', meeting.id)
      .eq('user_id', userId)
      .maybeSingle<{ id: string }>();

    if (!part) {
      throw new HttpError(403, 'You do not have permission to access notes for this meeting.');
    }
  }

  const [transcriptsRes, screenRes, msgsRes, participantsRes, summaryRes] = await Promise.all([
    supabase
      .from('meeting_transcripts')
      .select('id, speaker_id, speaker_name, content, created_at')
      .eq('meeting_id', meeting.id)
      .order('created_at', { ascending: true })
      .limit(500),
    supabase
      .from('meeting_screen_notes')
      .select('id, sharer_name, extracted_text, created_at')
      .eq('meeting_id', meeting.id)
      .order('created_at', { ascending: true })
      .limit(80),
    supabase
      .from('meeting_messages')
      .select('sender_id, content, created_at')
      .eq('meeting_id', meeting.id)
      .order('created_at', { ascending: true })
      .limit(200),
    supabase
      .from('meeting_participants')
      .select('user_id, role')
      .eq('meeting_id', meeting.id),
    supabase
      .from('meeting_ai_summaries')
      .select('*')
      .eq('meeting_id', meeting.id)
      .maybeSingle<MeetingAiSummaryRecord>(),
  ]);

  const transcripts = (transcriptsRes.data ?? []) as TranscriptRow[];
  const screenNotes = (screenRes.data ?? []) as ScreenNoteRow[];
  const msgRows = (msgsRes.data ?? []) as MessageRow[];
  const participantRoles = (participantsRes.data ?? []) as ParticipantRoleRow[];
  const baseSummary = summaryRes.data ?? null;

  const roleMap = new Map<string, SpeakerAuthority>();
  roleMap.set(meeting.host_id, 'HOST');
  for (const row of participantRoles) {
    if (row.user_id === meeting.host_id || row.role === 'host') {
      roleMap.set(row.user_id, 'HOST');
    } else if (row.role === 'co_host') {
      roleMap.set(row.user_id, 'CO-HOST');
    } else if (!roleMap.has(row.user_id)) {
      roleMap.set(row.user_id, 'PARTICIPANT');
    }
  }

  const formattedTranscripts = transcripts.map((t) => {
    const auth = resolveSpeakerAuthority(t.speaker_id, meeting.host_id, roleMap);
    const label = t.speaker_name ? `${auth} · ${t.speaker_name}` : auth;
    return `- [${label}]: ${t.content}`;
  });

  const usableScreenTexts = screenNotes
    .map((s) => s.extracted_text.trim())
    .filter(
      (txt) =>
        txt.length > 0 &&
        !txt.startsWith('Shared screen frame captured') &&
        !txt.startsWith('Visual screen frame captured'),
    );

  const formattedChats = msgRows
    .map((m) => {
      const content = m.content.trim();
      if (!content || content.startsWith('[Recording')) return null;
      const auth = resolveSpeakerAuthority(m.sender_id, meeting.host_id, roleMap);
      return `- [${auth}]: ${content}`;
    })
    .filter((line): line is string => Boolean(line));

  return {
    meeting,
    formattedTranscripts,
    usableScreenTexts,
    formattedChats,
    baseSummary,
  };
}

export async function getMeetingProNotesForUser(
  meetingId: string,
  userId: string,
): Promise<MeetingProNotesRecord | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('meeting_pro_notes')
    .select('*')
    .eq('meeting_id', meetingId)
    .eq('user_id', userId)
    .maybeSingle<MeetingProNotesRecord>();
  if (error || !data) return null;
  return data;
}

export async function upgradeMeetingToProNotesForUser(
  rawCode: string,
  userId: string,
): Promise<{ pro_notes: MeetingProNotesRecord; subscription: UserSubscriptionStatus }> {
  const ctx = await assertMeetingAccessAndLoadContext(rawCode, userId);
  const supabase = requireSupabase();

  // Already unlocked for this meeting? Return immediately without spending another credit!
  const existing = await getMeetingProNotesForUser(ctx.meeting.id, userId);
  if (existing) {
    const subscription = await getUserSubscriptionStatus(userId);
    return { pro_notes: existing, subscription };
  }

  const hasContent =
    ctx.formattedTranscripts.length > 0 ||
    ctx.usableScreenTexts.length > 0 ||
    ctx.formattedChats.length > 0 ||
    Boolean(
      ctx.baseSummary &&
        ctx.baseSummary.environment_type !== 'no_important_content' &&
        ctx.baseSummary.overview,
    );

  if (!hasContent) {
    throw new HttpError(
      400,
      'This session has no substantive study or meeting content to upgrade into Pro Notes.',
    );
  }

  // Verify entitlement BEFORE calling Gemini Pro (credit is only deducted once Pro Notes succeed!)
  const preStatus = await getUserSubscriptionStatus(userId);
  if (!preStatus.is_pro || (!preStatus.is_unlimited && preStatus.credits_remaining <= 0)) {
    throw new HttpError(
      402,
      'You need a Pro Note credit (₹9 for 1 credit, ₹49 for 15 credits) or Unlimited Pro plan to unlock Pro Master Notes.',
    );
  }

  const proPrompt = [
    'You are the MYMEET PRO Master Study & Executive Notes Architect.',
    'The user PAID to upgrade from basic summary notes to DEEP, EXAM-READY & PRODUCTION-GRADE PRO MASTER NOTES.',
    'Make these notes unmistakably richer, clearer, and more actionable than a basic overview:',
    '',
    'REQUIREMENTS:',
    '1. SPEAKER AUTHORITY: Treat [HOST] and [CO-HOST] as final source of truth. Drop wrong/rejected participant guesses; cleanly include Host-approved participant ideas & doubts.',
    '2. DEEP SECTIONS (3 to 7 sections): Provide thorough explanations PLUS concrete copy-paste code snippets (for coding/web/tech sessions) OR full step-by-step derivations & formulas in clean Unicode math (for math/physics/science) OR structured decisions & execution plan (for office/team). NEVER use raw LaTeX backslashes like \\frac or \\quad.',
    '3. COMPARISON TABLE: Whenever 2 or more concepts, attributes, methods, algorithms, or options were compared (e.g. Normal vs Defer vs Async, SQL vs NoSQL, etc.), include a crisp `comparison_table` with `title`, `headers`, and `rows`. Otherwise set `comparison_table` to null.',
    '4. EXAM & INTERVIEW TRAPS (3 to 5 items): List common mistakes, tricky edge cases, or viva/interview questions directly tied to this session, each with a sharp `trap` and clear `fix`.',
    '5. 1-MINUTE CHEAT SHEET (5 to 8 ultra-dense bullets): Rapid-revision formulas, syntax rules, or key takeaways designed to review 5 minutes before an exam or meeting.',
    '',
    'Return ONLY valid JSON matching this exact schema:',
    '{',
    '  "environment_label": "PRO MASTER NOTES · <Specific Topic>",',
    '  "pro_overview": "3-4 crisp sentences summarizing the entire session deeply",',
    '  "deep_sections": [',
    '    {',
    '      "title": "Clear section heading",',
    '      "kind": "concept | code | derivation | example | decision",',
    '      "explanation": "Deep, crystal-clear explanation (3-5 sentences)",',
    '      "code_or_formula": "Optional clean code snippet or Unicode math derivation (omit if none)",',
    '      "bullets": ["2 to 5 concrete key points"],',
    '      "worked_example": "Optional short worked example or real-world scenario"',
    '    }',
    '  ],',
    '  "comparison_table": {',
    '    "title": "Comparison title",',
    '    "headers": ["Feature", "Option A", "Option B"],',
    '    "rows": [["Row 1", "...", "..."]]',
    '  },',
    '  "exam_traps": [',
    '    { "trap": "Common mistake or tricky question", "fix": "Exact right approach / answer" }',
    '  ],',
    '  "cheat_sheet": ["Ultra-crisp 1-line revision rule or formula"],',
    '  "pro_markdown": "Clean complete Markdown version for export"',
    '}',
    '',
    `Session Topic: ${ctx.meeting.title}`,
    '',
    '--- BASE SESSION OVERVIEW ---',
    ctx.baseSummary?.overview || '(None)',
    ctx.baseSummary?.detailed_notes_markdown
      ? `\n--- BASE NOTES ---\n${ctx.baseSummary.detailed_notes_markdown.slice(0, 3500)}`
      : '',
    '',
    '--- CHRONOLOGICAL SPOKEN VOICE CONTENT (ROLE-TAGGED) ---',
    ctx.formattedTranscripts.length > 0 ? ctx.formattedTranscripts.join('\n') : '(None)',
    '',
    '--- SHARED SCREEN CONTENT ---',
    ctx.usableScreenTexts.length > 0 ? ctx.usableScreenTexts.join('\n') : '(None)',
    '',
    '--- CHAT CONTENT ---',
    ctx.formattedChats.length > 0 ? ctx.formattedChats.join('\n') : '(None)',
  ].join('\n');

  const geminiRes = await callGeminiApi([{ text: proPrompt }], true, true);
  if (!geminiRes?.text) {
    throw new HttpError(503, 'AI Pro engine is temporarily busy. Please try again in a few seconds (no credit was deducted).');
  }

  let parsed: Record<string, unknown>;
  try {
    const cleaned = geminiRes.text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new HttpError(502, 'Could not parse AI Pro notes response. Please retry (no credit was deducted).');
  }

  const validKinds = ['concept', 'code', 'derivation', 'example', 'decision'] as const;
  const rawSections = Array.isArray(parsed.deep_sections) ? parsed.deep_sections : [];
  const deepSections: ProNoteDeepSection[] = rawSections
    .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
    .map((s) => {
      const k = typeof s.kind === 'string' ? s.kind.toLowerCase() : 'concept';
      const kind = (validKinds as readonly string[]).includes(k)
        ? (k as ProNoteDeepSection['kind'])
        : 'concept';
      return {
        title: typeof s.title === 'string' && s.title.trim() ? s.title.trim().slice(0, 120) : 'Deep Concept',
        kind,
        explanation: typeof s.explanation === 'string' ? s.explanation.trim().slice(0, 1200) : '',
        ...(typeof s.code_or_formula === 'string' && s.code_or_formula.trim()
          ? { code_or_formula: s.code_or_formula.trim().slice(0, 1600) }
          : {}),
        ...(Array.isArray(s.bullets)
          ? {
              bullets: s.bullets
                .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
                .map((b) => b.trim().slice(0, 260))
                .slice(0, 6),
            }
          : {}),
        ...(typeof s.worked_example === 'string' && s.worked_example.trim()
          ? { worked_example: s.worked_example.trim().slice(0, 700) }
          : {}),
      };
    })
    .filter((s) => s.explanation.length > 0)
    .slice(0, 8);

  let comparisonTable: ProComparisonTable | null = null;
  if (parsed.comparison_table && typeof parsed.comparison_table === 'object') {
    const ct = parsed.comparison_table as Record<string, unknown>;
    const headers = Array.isArray(ct.headers)
      ? ct.headers.filter((h): h is string => typeof h === 'string' && h.trim().length > 0).slice(0, 6)
      : [];
    const rows = Array.isArray(ct.rows)
      ? ct.rows
          .filter((r): r is unknown[] => Array.isArray(r))
          .map((r) => r.map((cell) => String(cell ?? '').trim()).slice(0, headers.length))
          .filter((r) => r.length > 0)
          .slice(0, 10)
      : [];
    if (headers.length >= 2 && rows.length >= 1) {
      comparisonTable = {
        ...(typeof ct.title === 'string' && ct.title.trim() ? { title: ct.title.trim() } : {}),
        headers,
        rows,
      };
    }
  }

  const rawTraps = Array.isArray(parsed.exam_traps) ? parsed.exam_traps : [];
  const examTraps: ProExamTrap[] = rawTraps
    .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === 'object'))
    .map((t) => ({
      trap: typeof t.trap === 'string' ? t.trap.trim().slice(0, 300) : '',
      fix: typeof t.fix === 'string' ? t.fix.trim().slice(0, 360) : '',
    }))
    .filter((t) => t.trap && t.fix)
    .slice(0, 6);

  const cheatSheet = Array.isArray(parsed.cheat_sheet)
    ? parsed.cheat_sheet
        .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
        .map((c) => c.trim().slice(0, 260))
        .slice(0, 10)
    : [];

  const envLabel =
    typeof parsed.environment_label === 'string' && parsed.environment_label.trim()
      ? parsed.environment_label.trim().slice(0, 120)
      : `PRO MASTER NOTES · ${ctx.meeting.title}`;
  const proOverview =
    typeof parsed.pro_overview === 'string' && parsed.pro_overview.trim()
      ? parsed.pro_overview.trim().slice(0, 900)
      : ctx.baseSummary?.overview || `Deep Pro Notes for ${ctx.meeting.title}`;
  const proMarkdown =
    typeof parsed.pro_markdown === 'string' && parsed.pro_markdown.trim()
      ? parsed.pro_markdown.trim()
      : `# ${ctx.meeting.title} — Pro Master Notes\n\n${proOverview}`;

  // Deduct 1 credit (or pass through for Unlimited plans) right before persisting
  const { unlockSource, updatedStatus } = await consumeOneProCreditIfNeeded(userId);

  const { data: saved, error: saveErr } = await supabase
    .from('meeting_pro_notes')
    .upsert(
      {
        meeting_id: ctx.meeting.id,
        user_id: userId,
        unlock_source: unlockSource,
        environment_label: envLabel,
        pro_overview: proOverview,
        deep_sections: deepSections,
        comparison_table: comparisonTable,
        exam_traps: examTraps,
        cheat_sheet: cheatSheet,
        pro_markdown: proMarkdown,
        model_used: geminiRes.model,
      },
      { onConflict: 'meeting_id,user_id' },
    )
    .select('*')
    .single<MeetingProNotesRecord>();

  if (saveErr || !saved) {
    throw new HttpError(
      500,
      `Could not save Pro Notes (ensure SQL migration 20261127000001_pro_plans_and_mcqs.sql is run): ${saveErr?.message ?? 'Unknown'}`,
    );
  }

  return { pro_notes: saved, subscription: updatedStatus };
}

export async function getOrGenerateMeetingMcqsForUser(
  rawCode: string,
  userId: string,
): Promise<MeetingMcqQuizRecord> {
  const subscription = await getUserSubscriptionStatus(userId);
  if (!subscription.mcq_enabled) {
    throw new HttpError(
      402,
      'Session MCQ Practice Tests are included in Pro Monthly (₹349/mo) and Pro Yearly (₹899/yr). Upgrade to unlock!',
    );
  }

  const ctx = await assertMeetingAccessAndLoadContext(rawCode, userId);
  const supabase = requireSupabase();

  // Reuse cached quiz for this meeting so retaking is instant & free!
  const { data: existing } = await supabase
    .from('meeting_mcqs')
    .select('*')
    .eq('meeting_id', ctx.meeting.id)
    .maybeSingle<MeetingMcqQuizRecord>();

  if (existing && Array.isArray(existing.questions) && existing.questions.length > 0) {
    return existing;
  }

  const hasContent =
    ctx.formattedTranscripts.length > 0 ||
    ctx.usableScreenTexts.length > 0 ||
    ctx.formattedChats.length > 0 ||
    Boolean(
      ctx.baseSummary &&
        ctx.baseSummary.environment_type !== 'no_important_content' &&
        ctx.baseSummary.overview,
    );

  if (!hasContent) {
    throw new HttpError(
      400,
      'This session has no study or technical content to generate practice MCQs from.',
    );
  }

  const mcqPrompt = [
    'You are an expert Exam & Concept Mastery Quiz Designer for MyMeet Pro.',
    'Generate 8 to 10 high-quality Multiple Choice Questions (MCQs) strictly based on what was taught, explained, or finalized by the [HOST]/[CO-HOST] in this exact session.',
    '',
    'RULES:',
    '1. Mix difficulties cleanly: ~3 easy (core recall), ~4 medium (application/code/formula), ~2-3 hard (tricky edge cases / exam traps).',
    '2. Every question MUST have exactly 4 distinct options (A, B, C, D) and 1 unambiguous `correct_index` (0, 1, 2, or 3).',
    '3. Include a crisp, helpful `explanation` (1-3 sentences) explaining WHY the right answer is correct so the student polishes the concept immediately.',
    '4. Use clean Unicode math (no raw LaTeX backslashes like \\frac).',
    '5. Ignore casual chatter and rejected participant mistakes.',
    '',
    'Return ONLY valid JSON matching this schema:',
    '{',
    '  "topic_label": "Short quiz topic title e.g. DOM & Script Loading Mastery Quiz",',
    '  "questions": [',
    '    {',
    '      "id": "q1",',
    '      "question": "Clear question text",',
    '      "options": ["Option A", "Option B", "Option C", "Option D"],',
    '      "correct_index": 1,',
    '      "explanation": "Why Option B is correct and what concept to remember",',
    '      "difficulty": "easy | medium | hard",',
    '      "concept": "Short 2-4 word concept tag"',
    '    }',
    '  ]',
    '}',
    '',
    `Session Topic: ${ctx.meeting.title}`,
    '',
    '--- BASE SUMMARY ---',
    ctx.baseSummary?.overview || '(None)',
    ctx.baseSummary?.detailed_notes_markdown
      ? `\n${ctx.baseSummary.detailed_notes_markdown.slice(0, 3500)}`
      : '',
    '',
    '--- CHRONOLOGICAL SPOKEN VOICE CONTENT (ROLE-TAGGED) ---',
    ctx.formattedTranscripts.length > 0 ? ctx.formattedTranscripts.join('\n') : '(None)',
    '',
    '--- SHARED SCREEN CONTENT ---',
    ctx.usableScreenTexts.length > 0 ? ctx.usableScreenTexts.join('\n') : '(None)',
  ].join('\n');

  const geminiRes = await callGeminiApi([{ text: mcqPrompt }], true, true);
  if (!geminiRes?.text) {
    throw new HttpError(503, 'AI Quiz generator is temporarily busy. Please try again shortly.');
  }

  let parsed: Record<string, unknown>;
  try {
    const cleaned = geminiRes.text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new HttpError(502, 'Could not parse generated MCQ quiz. Please try again.');
  }

  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
  const questions: SessionMcqQuestion[] = rawQuestions
    .filter((q): q is Record<string, unknown> => Boolean(q && typeof q === 'object'))
    .map((q, idx): SessionMcqQuestion | null => {
      const text = typeof q.question === 'string' ? q.question.trim() : '';
      const opts = Array.isArray(q.options)
        ? q.options.map((o) => String(o ?? '').trim()).filter(Boolean)
        : [];
      const correctIdx =
        typeof q.correct_index === 'number' &&
        Number.isInteger(q.correct_index) &&
        q.correct_index >= 0 &&
        q.correct_index <= 3
          ? q.correct_index
          : 0;
      if (!text || opts.length < 4) return null;
      const diffRaw = typeof q.difficulty === 'string' ? q.difficulty.toLowerCase() : 'medium';
      const difficulty: 'easy' | 'medium' | 'hard' =
        diffRaw === 'easy' || diffRaw === 'hard' ? diffRaw : 'medium';
      return {
        id: typeof q.id === 'string' && q.id.trim() ? q.id.trim() : `q${idx + 1}`,
        question: text.slice(0, 420),
        options: [opts[0], opts[1], opts[2], opts[3]],
        correct_index: correctIdx,
        explanation:
          typeof q.explanation === 'string' && q.explanation.trim()
            ? q.explanation.trim().slice(0, 500)
            : 'Review the session notes for this concept.',
        difficulty,
        concept:
          typeof q.concept === 'string' && q.concept.trim()
            ? q.concept.trim().slice(0, 60)
            : 'Core Concept',
      };
    })
    .filter((q): q is SessionMcqQuestion => q !== null)
    .slice(0, 10);

  if (questions.length === 0) {
    throw new HttpError(502, 'Could not build valid practice MCQs for this session.');
  }

  const topicLabel =
    typeof parsed.topic_label === 'string' && parsed.topic_label.trim()
      ? parsed.topic_label.trim().slice(0, 120)
      : `${ctx.meeting.title} · Mastery Quiz`;

  const { data: saved, error: saveErr } = await supabase
    .from('meeting_mcqs')
    .upsert(
      {
        meeting_id: ctx.meeting.id,
        topic_label: topicLabel,
        questions,
        model_used: geminiRes.model,
      },
      { onConflict: 'meeting_id' },
    )
    .select('*')
    .single<MeetingMcqQuizRecord>();

  if (saveErr || !saved) {
    throw new HttpError(
      500,
      `Could not save session MCQs (ensure SQL migration 20261127000001_pro_plans_and_mcqs.sql is run): ${saveErr?.message ?? 'Unknown'}`,
    );
  }

  return saved;
}
