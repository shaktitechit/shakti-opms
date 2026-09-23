#!/usr/bin/env node
/** Generate docs/pdf/08-security.pdf from security markdown (+ related auth docs). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.resolve(__dirname, '..');
const PDF_DIR = path.join(DOCS_ROOT, 'pdf');
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const FILES = [
  '08-security/01-security-overview.md',
  '08-security/02-threat-model.md',
  '08-security/03-data-protection-and-ops.md',
  '08-security/04-authorization-model.md',
  '02-architecture/07-authentication-authorization.md',
  '04-api/02-authentication.md',
  '03-functional/authentication.md',
  '06-developer-deployment/19-security.md',
  '06-developer-deployment/05-environment-variables.md',
];

marked.setOptions({ gfm: true });

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mdToHtml(md, sourcePath) {
  const parts = [];
  const fenceRe = /```(\w*)\n([\s\S]*?)```/g;
  let last = 0;
  let m;
  while ((m = fenceRe.exec(md)) !== null) {
    const before = md.slice(last, m.index);
    if (before.trim()) parts.push({ type: 'md', text: before });
    const lang = (m[1] || '').toLowerCase();
    const body = m[2].replace(/\n$/, '');
    if (lang === 'mermaid') parts.push({ type: 'mermaid', text: body });
    else parts.push({ type: 'md', text: '```' + (m[1] || '') + '\n' + body + '\n```' });
    last = m.index + m[0].length;
  }
  const rest = md.slice(last);
  if (rest.trim()) parts.push({ type: 'md', text: rest });

  let html = '';
  for (const part of parts) {
    if (part.type === 'mermaid') {
      html += `<div class="mermaid-wrap"><div class="mermaid">${escapeHtml(part.text)}</div></div>\n`;
    } else {
      html += marked.parse(part.text);
    }
  }
  return `<section class="doc-section" data-source="${escapeHtml(sourcePath)}">
  <p class="source-path">Source: ${escapeHtml(sourcePath)}</p>
  ${html}
</section>`;
}

function buildHtml(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    :root { --text:#1a1a1a; --muted:#555; --border:#d0d7de; --code-bg:#f6f8fa; --accent:#7a1f1f; }
    body { font-family: "IBM Plex Sans","Segoe UI",Helvetica,Arial,sans-serif; font-size:10.5pt; line-height:1.45; color:var(--text); margin:0; }
    .cover { page-break-after: always; padding: 40mm 10mm 20mm; }
    .cover h1 { font-size:28pt; color:var(--accent); margin:0 0 8pt; }
    .cover .subtitle { font-size:14pt; color:var(--muted); }
    .cover .meta { font-size:10pt; color:var(--muted); }
    h1,h2,h3,h4 { color:var(--accent); page-break-after:avoid; }
    h1 { font-size:18pt; border-bottom:2px solid var(--accent); padding-bottom:4pt; margin-top:22pt; }
    h2 { font-size:14pt; margin-top:16pt; }
    table { border-collapse:collapse; width:100%; margin:10pt 0; font-size:9pt; }
    th,td { border:1px solid var(--border); padding:4pt 6pt; vertical-align:top; text-align:left; }
    th { background:#f8ecec; }
    tr { page-break-inside:avoid; }
    pre,code { font-family:"IBM Plex Mono",Menlo,Consolas,monospace; font-size:8.5pt; }
    pre { background:var(--code-bg); border:1px solid var(--border); border-radius:4px; padding:8pt; white-space:pre-wrap; word-break:break-word; page-break-inside:avoid; }
    code { background:var(--code-bg); padding:1pt 3pt; border-radius:3px; }
    pre code { background:transparent; padding:0; }
    .doc-section { page-break-before: always; }
    .doc-section:first-of-type { page-break-before: auto; }
    .source-path { font-size:8pt; color:#888; margin:0 0 8pt; border-bottom:1px dashed #ccc; padding-bottom:4pt; }
    .mermaid-wrap { margin:12pt 0; padding:10pt; border:1px solid var(--border); border-radius:6px; background:#fff; page-break-inside:avoid; text-align:center; }
    .mermaid svg { max-width:100% !important; height:auto !important; }
    .toc { page-break-after: always; }
    .toc ul { list-style:none; padding-left:0; }
    .toc li { margin:4pt 0; font-size:10pt; }
  </style>
</head>
<body>
${bodyHtml}
<script>
  mermaid.initialize({ startOnLoad:false, theme:'neutral', securityLevel:'loose',
    flowchart:{ useMaxWidth:true, htmlLabels:true }, sequence:{ useMaxWidth:true } });
  (async () => {
    try {
      await mermaid.run({ querySelector: '.mermaid' });
      document.documentElement.setAttribute('data-mermaid-ready', 'true');
    } catch (e) {
      document.documentElement.setAttribute('data-mermaid-ready', 'error');
    }
  })();
</script>
</body>
</html>`;
}

async function main() {
  fs.mkdirSync(PDF_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const sections = [];
  const toc = [];
  for (const rel of FILES) {
    const full = path.join(DOCS_ROOT, rel);
    if (!fs.existsSync(full)) {
      console.warn('Missing', rel);
      continue;
    }
    toc.push(rel);
    sections.push(mdToHtml(fs.readFileSync(full, 'utf8'), rel));
  }
  const body = `
<div class="cover">
  <h1>OPMS Security Documentation</h1>
  <p class="subtitle">Authentication, authorization, rate limits / 15-min IP block, secrets, edge TLS, and hardening plan</p>
  <p class="meta">Generated: ${date}</p>
  <p class="meta">Diagrams rendered with Mermaid 11 · Secrets redacted</p>
</div>
<nav class="toc">
  <h1>Contents</h1>
  <ul>${toc.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
</nav>
${sections.join('\n')}`;

  const html = buildHtml('OPMS Security Documentation', body);
  const htmlPath = path.join(PDF_DIR, '08-security.html');
  const pdfPath = path.join(PDF_DIR, '08-security.pdf');
  fs.writeFileSync(htmlPath, html, 'utf8');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 120000 });
    await page.waitForFunction(
      () => ['true', 'error'].includes(document.documentElement.getAttribute('data-mermaid-ready')),
      { timeout: 120000 },
    );
    const status = await page.evaluate(() => ({
      ready: document.documentElement.getAttribute('data-mermaid-ready'),
      count: document.querySelectorAll('.mermaid').length,
      svgs: document.querySelectorAll('.mermaid svg').length,
    }));
    console.log('mermaid:', status);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="font-size:8px;width:100%;padding:0 12mm;color:#666;display:flex;justify-content:space-between;">
        <span>OPMS Security Documentation</span>
        <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
    });
  } finally {
    await browser.close();
  }
  console.log('Wrote', pdfPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
