import { scoreCampTextSegment } from './campFieldExtractors.js';
import { splitCampMessageBlocks } from './campMessageParser.js';

const FORWARD_SPLIT_PATTERNS = [
  /(?:^|\n)-{3,}\s*Forwarded message\s*-{3,}/gi,
  /(?:^|\n)-{3,}\s*Original Message\s*-{3,}/gi,
  /(?:^|\n)Begin forwarded message:?/gi,
  /(?:^|\n)_{5,}/g,
  /(?:^|\n)On .{10,120} wrote:\s*\n/gi,
];

const NOISE_LINE_PATTERNS = [
  /^from:\s*.+$/i,
  /^to:\s*.+$/i,
  /^cc:\s*.+$/i,
  /^sent:\s*.+$/i,
  /^subject:\s*.+$/i,
  /^date:\s*.+$/i,
  /^reply-to:\s*.+$/i,
  /^>{1,}\s*.+$/,
  /^confidential/i,
  /^disclaimer/i,
  /^this email/i,
  /^please consider the environment/i,
  /^google form uploaded/i,
];

function stripNoiseLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return !NOISE_LINE_PATTERNS.some((pattern) => pattern.test(trimmed));
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitForwardChain(text) {
  let segments = [String(text || '')];

  FORWARD_SPLIT_PATTERNS.forEach((pattern) => {
    const next = [];
    segments.forEach((segment) => {
      segment.split(pattern).forEach((part) => {
        const cleaned = part.trim();
        if (cleaned) next.push(cleaned);
      });
    });
    segments = next;
  });

  return segments.length ? segments : [String(text || '')];
}

export function extractCampContentFromEmailBody(bodyText, subject = '') {
  const raw = String(bodyText || '').trim();
  if (!raw) {
    return { content: '', segmentCount: 0, usedForwardExtraction: false };
  }

  const forwardSegments = splitForwardChain(raw).map(stripNoiseLines).filter(Boolean);
  const candidateSegments = forwardSegments.length > 1 ? forwardSegments : [stripNoiseLines(raw)];

  const scored = candidateSegments
    .map((segment, index) => ({
      segment,
      index,
      score: scoreCampTextSegment(segment) + (/\bcamp\b/i.test(subject) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.index - a.index);

  const best = scored[0];
  if (best?.score > 0) {
    return {
      content: best.segment,
      segmentCount: candidateSegments.length,
      usedForwardExtraction: candidateSegments.length > 1,
    };
  }

  const blocks = splitCampMessageBlocks(raw);
  return {
    content: blocks[0] || raw,
    segmentCount: blocks.length,
    usedForwardExtraction: false,
  };
}
