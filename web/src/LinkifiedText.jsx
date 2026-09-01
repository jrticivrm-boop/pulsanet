/**
 * Texto de chat con URLs / geo / mailto / tel clicables.
 */
const LINK_RE =
  /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|geo:[^\s<>"']+|mailto:[^\s<>"']+|tel:\+?[\d()\-\s.]{7,})/gi;

const TRAIL_PUNCT = /[),.;:!?…»"'”’]+$/;

export function normalizeHref(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  while (TRAIL_PUNCT.test(s)) s = s.replace(TRAIL_PUNCT, '');
  if (/^www\./i.test(s)) return `https://${s}`;
  return s;
}

export function splitLinkParts(text) {
  const src = String(text ?? '');
  if (!src) return [];
  const parts = [];
  let last = 0;
  LINK_RE.lastIndex = 0;
  let m;
  while ((m = LINK_RE.exec(src)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', value: src.slice(last, m.index) });
    }
    let matched = m[0];
    let trail = '';
    const trailMatch = matched.match(TRAIL_PUNCT);
    if (trailMatch) {
      trail = trailMatch[0];
      matched = matched.slice(0, -trail.length);
    }
    if (matched) {
      parts.push({ type: 'link', value: matched, href: normalizeHref(matched) });
    }
    if (trail) {
      parts.push({ type: 'text', value: trail });
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) {
    parts.push({ type: 'text', value: src.slice(last) });
  }
  return parts.length ? parts : [{ type: 'text', value: src }];
}

export default function LinkifiedText({ text, className = 'wa-text' }) {
  const parts = splitLinkParts(text);
  return (
    <p className={className}>
      {parts.map((p, i) =>
        p.type === 'link' ? (
          <a
            key={i}
            className="wa-link"
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {p.value}
          </a>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </p>
  );
}
