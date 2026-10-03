/**
 * Every instruction the speaker button can read, in each language. The AI
 * service will speak these lines and no others, so after rewording a check,
 * run (from frontend/) and commit the result:
 *   npx tsx scripts/voice-lines.tsx > ../python-cv/app/data/voice_lines.json
 */
import { en } from '../src/i18n/en';
import { hi } from '../src/i18n/hi';
import { spokenInstruction, voiceKey } from '../src/lib/voice-key';

const lines = new Map<string, { key: string; lang: string; text: string }>();
for (const m of [en, hi]) {
  for (const [, entry] of Object.entries(m.items)) {
    const variants = [entry.description, ...Object.values(entry.byModel ?? {})];
    for (const description of variants) {
      const text = spokenInstruction(entry.title, description);
      const key = voiceKey(m.lang, text);
      lines.set(key, { key, lang: m.lang, text });
    }
  }
}
process.stdout.write(JSON.stringify([...lines.values()], null, 2));
