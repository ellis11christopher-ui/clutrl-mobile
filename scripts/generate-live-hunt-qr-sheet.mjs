import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';

// QR content for the seeded Supabase hunt (supabase/seed_demo_hunt.sql).
// These are raw tokens, not deep links — submit_scan hashes whatever the
// camera reads and compares it to the stored hash directly.
const items = Array.from({ length: 10 }, (_, index) => {
  const order = index + 1;
  const token = `CLUTRL-NEON-${String(order).padStart(2, '0')}`;
  return { order, token };
});

const cards = await Promise.all(
  items.map(async (item) => {
    const svg = await QRCode.toString(item.token, {
      type: 'svg',
      width: 250,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#151612',
        light: '#FFFFFF',
      },
    });

    return `
      <article class="card">
        <div class="eyebrow">CLUTRL · NEON AFTER DARK · LIVE TEST HUNT</div>
        <div class="number">${String(item.order).padStart(2, '0')}</div>
        <div class="qr">${svg}</div>
        <h2>DISCOVERY ${item.order}</h2>
        <p>Join code NIGHT-OWL · scan only after the target is found.</p>
        <div class="token">${item.token}</div>
      </article>`;
  }),
);

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CLUTRL · Neon After Dark Live Test QR Pack</title>
    <style>
      :root { --ink: #151612; --lime: #c8ff00; --paper: #f4f0e7; --cyan: #00d7ff; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--paper); color: var(--ink); font-family: Arial, Helvetica, sans-serif; }
      header { max-width: 900px; margin: 0 auto; padding: 36px 24px 18px; display: flex; justify-content: space-between; align-items: end; }
      .brand { font-weight: 900; letter-spacing: 2px; font-size: 22px; }
      .meta { text-align: right; font-size: 11px; line-height: 1.5; color: #64665f; }
      main { max-width: 900px; margin: 0 auto; padding: 12px 24px 48px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
      .card { position: relative; min-height: 470px; padding: 22px; background: white; border: 2px solid var(--ink); border-radius: 24px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
      .card::after { content: ""; position: absolute; width: 180px; height: 180px; border-radius: 50%; background: var(--lime); right: -85px; top: -90px; }
      .eyebrow { font-size: 9px; letter-spacing: 1.2px; font-weight: 900; }
      .number { position: absolute; right: 18px; top: 5px; z-index: 2; font-size: 58px; line-height: 1; font-weight: 900; color: var(--cyan); }
      .qr { width: 260px; height: 260px; margin: 45px auto 8px; display: grid; place-items: center; }
      .qr svg { width: 100%; height: 100%; }
      h2 { margin: 12px 0 2px; font-size: 22px; }
      p { margin: 0; color: #64665f; font-size: 12px; }
      .token { position: absolute; left: 22px; bottom: 20px; display: inline-block; border-radius: 999px; background: var(--ink); color: white; padding: 8px 12px; font-size: 10px; font-weight: 900; letter-spacing: 1px; }
      @media print {
        @page { size: letter; margin: 0.35in; }
        body { background: white; }
        header { padding: 0 0 0.18in; }
        main { padding: 0; gap: 0.15in; }
        .card { min-height: 4.5in; border-radius: 0.18in; }
      }
      @media (max-width: 620px) {
        main { grid-template-columns: 1fr; }
        .card { min-height: 450px; }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="brand">CLUTRL</div>
      <div class="meta">NEON AFTER DARK · LIVE TEST<br />10 PRINT-READY TARGETS · JOIN CODE NIGHT-OWL</div>
    </header>
    <main>${cards.join('\n')}</main>
  </body>
</html>`;

const outputDirectory = path.resolve('artifacts');
await mkdir(outputDirectory, { recursive: true });
const outputPath = path.join(outputDirectory, 'clutrl-live-hunt-qr-sheet.html');
await writeFile(outputPath, html, 'utf8');
console.log(outputPath);
