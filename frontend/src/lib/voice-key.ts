/**
 * What the speaker button says for a check, and the name of its recording.
 * Shared by the page and by scripts/voice-lines.tsx, so a reworded
 * instruction gets a new name — and, until it is recorded, the browser's
 * own voice — rather than the old recording.
 */
export function spokenInstruction(title: string, description: string): string {
  return `${title}. ${description}`;
}

/** FNV-1a over the UTF-8 bytes: short, stable, and the same in Python. */
export function voiceKey(lang: string, text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(`${lang}\n${text}`)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
