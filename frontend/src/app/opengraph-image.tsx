import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'AED SmartX Inspector: is your AED ready to save a life? Free AI inspection in 3 minutes.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The card shown when a link is shared on WhatsApp, LinkedIn, X or Slack:
 *  the app's own question, its promise, and where to go. Built once, at
 *  build time. */
export default async function OpengraphImage() {
  const wordmark = await readFile(join(process.cwd(), 'public/brand/aedsmartx.png'));
  const src = `data:image/png;base64,${wordmark.toString('base64')}`;
  const RED = '#FF3131';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#ffffff',
          color: '#141418',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={262} height={40} alt="" />
          <div style={{ width: 2, height: 34, background: '#d4d4dc' }} />
          <div style={{ fontSize: 34, fontWeight: 600 }}>Inspector</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Two even lines, set by hand: left to wrap, "life?" sat alone. */}
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 84, lineHeight: 1.04, letterSpacing: -2.5 }}>
            <span>Is your AED ready</span>
            <span>to save a life?</span>
          </div>
          <div style={{ marginTop: 26, fontSize: 34, color: '#55555f', maxWidth: 960, lineHeight: 1.3 }}>
            Free AI inspection in 3 minutes: readiness light, pads, battery and serial, checked from your phone.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, fontWeight: 600 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: RED }} />
            inspector.aedsmartx.com
          </div>
          <div
            style={{
              display: 'flex',
              background: RED,
              color: '#ffffff',
              fontSize: 30,
              fontWeight: 600,
              padding: '16px 30px',
              borderRadius: 18,
            }}
          >
            Start free inspection
          </div>
        </div>
      </div>
    ),
    size,
  );
}
