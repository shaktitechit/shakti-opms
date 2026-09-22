#!/usr/bin/env node
/**
 * Generate OPMS documentation PDFs from Markdown (with Mermaid diagrams).
 */
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

const ORDERED_FILES = [
  'README.md',
  'DOCUMENTATION-AUDIT.md',
  // 01 product
  '01-product/01-product-overview.md',
  '01-product/02-prd.md',
  '01-product/03-scope.md',
  '01-product/04-personas-and-roles.md',
  '01-product/05-features.md',
  '01-product/06-business-requirements.md',
  '01-product/07-non-functional-requirements.md',
  '01-product/08-business-rules.md',
  '01-product/09-integrations.md',
  '01-product/10-product-glossary.md',
  // 02 architecture
  '02-architecture/01-system-architecture.md',
  '02-architecture/02-component-architecture.md',
  '02-architecture/03-frontend-architecture.md',
  '02-architecture/04-backend-architecture.md',
  '02-architecture/05-service-architecture.md',
  '02-architecture/06-data-flow.md',
  '02-architecture/07-authentication-authorization.md',
  '02-architecture/08-integration-architecture.md',
  '02-architecture/09-infrastructure-architecture.md',
  '02-architecture/10-deployment-architecture.md',
  '02-architecture/11-architecture-decisions.md',
  '02-architecture/12-adr/ADR-001-microservice-split.md',
  '02-architecture/12-adr/ADR-002-opms-backend-bff.md',
  '02-architecture/12-adr/ADR-003-shared-mongodb.md',
  '02-architecture/12-adr/ADR-004-jwt-portal-rbac.md',
  '02-architecture/12-adr/ADR-005-bullmq-redis.md',
  '02-architecture/12-adr/ADR-006-micro-frontends-sso.md',
  '02-architecture/12-adr/ADR-007-external-file-api.md',
  '02-architecture/12-adr/ADR-008-unified-order-approval.md',
  // 03 functional
  '03-functional/README.md',
  '03-functional/authentication.md',
  '03-functional/users-and-identity.md',
  '03-functional/orders-and-workflow.md',
  '03-functional/approvals-and-finance.md',
  '03-functional/dispatch-and-transport.md',
  '03-functional/parties-and-products.md',
  '03-functional/leads-and-quotations.md',
  '03-functional/work-planner.md',
  '03-functional/notifications-and-messages.md',
  '03-functional/attachments-and-files.md',
  '03-functional/dashboards-and-activity.md',
  // 04 api
  '04-api/01-api-overview.md',
  '04-api/02-authentication.md',
  '04-api/03-api-conventions.md',
  '04-api/04-error-handling.md',
  '04-api/05-endpoints.md',
  // 05 database
  '05-database/01-database-overview.md',
  '05-database/02-schema.md',
  '05-database/03-collections-or-tables.md',
  '05-database/04-relationships.md',
  '05-database/05-indexes.md',
  '05-database/06-constraints.md',
  '05-database/07-data-lifecycle.md',
  '05-database/08-data-dictionary.md',
  '05-database/09-erd.md',
  // 06 devops
  '06-developer-deployment/01-development-overview.md',
  '06-developer-deployment/02-prerequisites.md',
  '06-developer-deployment/03-local-development.md',
  '06-developer-deployment/04-project-structure.md',
  '06-developer-deployment/05-environment-variables.md',
  '06-developer-deployment/06-configuration.md',
  '06-developer-deployment/07-running-the-application.md',
  '06-developer-deployment/08-testing.md',
  '06-developer-deployment/09-code-quality.md',
  '06-developer-deployment/10-git-workflow.md',
  '06-developer-deployment/11-docker.md',
  '06-developer-deployment/12-deployment.md',
  '06-developer-deployment/13-production-runbook.md',
  '06-developer-deployment/14-monitoring.md',
  '06-developer-deployment/15-logging.md',
  '06-developer-deployment/16-backup-and-restore.md',
  '06-developer-deployment/17-disaster-recovery.md',
  '06-developer-deployment/18-troubleshooting.md',
  '06-developer-deployment/19-security.md',
  '06-developer-deployment/20-performance.md',
  // 07 user
  '07-user/01-user-guide.md',
  '07-user/02-getting-started.md',
  '07-user/03-login.md',
  '07-user/04-navigation.md',
  '07-user/05-feature-guides.md',
  '07-user/06-role-guides.md',
  '07-user/07-common-tasks.md',
  '07-user/08-troubleshooting.md',
  '07-user/09-faq.md',
];

const CATEGORIES = [
  {
    id: '01-product',
    title: '01 — Product Documentation',
    files: ORDERED_FILES.filter((f) => f.startsWith('01-product/')),
  },
  {
    id: '02-architecture',
    title: '02 — System Architecture',
    files: ORDERED_FILES.filter((f) => f.startsWith('02-architecture/')),
  },
  {
    id: '03-functional',
    title: '03 — Functional Documentation',
    files: ORDERED_FILES.filter((f) => f.startsWith('03-functional/')),
  },
  {
    id: '04-api',
    title: '04 — API Documentation',
    files: ORDERED_FILES.filter((f) => f.startsWith('04-api/')),
  },
  {
    id: '05-database',
    title: '05 — Database Documentation',
    files: ORDERED_FILES.filter((f) => f.startsWith('05-database/')),
  },
  {
    id: '06-developer-deployment',
    title: '06 — Developer & Deployment',
    files: ORDERED_FILES.filter((f) => f.startsWith('06-developer-deployment/')),
  },
  {
    id: '07-user',
    title: '07 — User Documentation',
    files: ORDERED_FILES.filter((f) => f.startsWith('07-user/')),
  },
];

marked.setOptions({ gfm: true, breaks: false });

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert markdown to HTML, turning ```mermaid fences into mermaid divs */
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
    if (lang === 'mermaid') {
      parts.push({ type: 'mermaid', text: body });
    } else {
      parts.push({
        type: 'md',
        text: '```' + (m[1] || '') + '\n' + body + '\n```',
      });
    }
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

function buildDocumentHtml(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    :root {
      --text: #1a1a1a;
      --muted: #555;
      --border: #d0d7de;
      --code-bg: #f6f8fa;
      --accent: #0b3d5c;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "IBM Plex Sans", "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.45;
      color: var(--text);
      margin: 0;
      padding: 0;
    }
    .cover {
      page-break-after: always;
      padding: 40mm 10mm 20mm;
      text-align: left;
    }
    .cover h1 {
      font-size: 28pt;
      color: var(--accent);
      margin: 0 0 8pt;
    }
    .cover .subtitle { font-size: 14pt; color: var(--muted); margin-bottom: 24pt; }
    .cover .meta { font-size: 10pt; color: var(--muted); }
    h1, h2, h3, h4 {
      color: var(--accent);
      page-break-after: avoid;
    }
    h1 { font-size: 18pt; border-bottom: 2px solid var(--accent); padding-bottom: 4pt; margin-top: 22pt; }
    h2 { font-size: 14pt; margin-top: 16pt; }
    h3 { font-size: 12pt; }
    h4 { font-size: 11pt; }
    p, li { orphans: 3; widows: 3; }
    a { color: var(--accent); text-decoration: none; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 10pt 0;
      font-size: 9pt;
      page-break-inside: auto;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 4pt 6pt;
      vertical-align: top;
      text-align: left;
    }
    th { background: #eef3f7; }
    tr { page-break-inside: avoid; }
    pre, code {
      font-family: "IBM Plex Mono", Menlo, Consolas, monospace;
      font-size: 8.5pt;
    }
    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 8pt;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
      page-break-inside: avoid;
    }
    code {
      background: var(--code-bg);
      padding: 1pt 3pt;
      border-radius: 3px;
    }
    pre code { background: transparent; padding: 0; }
    blockquote {
      border-left: 3px solid var(--accent);
      margin: 8pt 0;
      padding: 4pt 10pt;
      color: var(--muted);
      background: #f8fafc;
    }
    .doc-section {
      page-break-before: always;
    }
    .doc-section:first-of-type { page-break-before: auto; }
    .source-path {
      font-size: 8pt;
      color: #888;
      margin: 0 0 8pt;
      border-bottom: 1px dashed #ccc;
      padding-bottom: 4pt;
    }
    .mermaid-wrap {
      margin: 12pt 0;
      padding: 10pt;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: #fff;
      page-break-inside: avoid;
      text-align: center;
    }
    .mermaid svg { max-width: 100% !important; height: auto !important; }
    .toc { page-break-after: always; }
    .toc ul { list-style: none; padding-left: 0; }
    .toc li { margin: 4pt 0; font-size: 10pt; }
    .toc .cat { font-weight: 700; margin-top: 10pt; color: var(--accent); }
    hr { border: none; border-top: 1px solid var(--border); margin: 16pt 0; }
  </style>
</head>
<body>
${bodyHtml}
<script>
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
    flowchart: { useMaxWidth: true, htmlLabels: true },
    er: { useMaxWidth: true },
    sequence: { useMaxWidth: true },
  });
  (async () => {
    try {
      await mermaid.run({ querySelector: '.mermaid' });
      document.documentElement.setAttribute('data-mermaid-ready', 'true');
    } catch (e) {
      console.error('mermaid error', e);
      document.documentElement.setAttribute('data-mermaid-ready', 'error');
      document.documentElement.setAttribute('data-mermaid-error', String(e && e.message || e));
    }
  })();
</script>
</body>
</html>`;
}

function readFile(rel) {
  const full = path.join(DOCS_ROOT, rel);
  if (!fs.existsSync(full)) {
    console.warn('Missing:', rel);
    return null;
  }
  return fs.readFileSync(full, 'utf8');
}

function buildCombinedBody(files, includeCoverToc = true) {
  const sections = [];
  const tocItems = [];

  for (const rel of files) {
    const md = readFile(rel);
    if (md == null) continue;
    tocItems.push(rel);
    sections.push(mdToHtml(md, rel));
  }

  let cover = '';
  if (includeCoverToc) {
    const date = new Date().toISOString().slice(0, 10);
    cover = `
<div class="cover">
  <h1>OPMS Software Documentation</h1>
  <p class="subtitle">Complete documentation suite (Markdown → PDF with Mermaid diagrams)</p>
  <p class="meta">Generated: ${date}</p>
  <p class="meta">Source: repository <code>docs/</code> directory</p>
  <p class="meta">Diagrams rendered with Mermaid 11</p>
</div>
<nav class="toc">
  <h1>Table of Contents</h1>
  <ul>
    ${tocItems.map((f) => `<li>${escapeHtml(f)}</li>`).join('\n')}
  </ul>
</nav>`;
  }

  return cover + sections.join('\n');
}

async function htmlToPdf(html, outPath) {
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
      () => document.documentElement.getAttribute('data-mermaid-ready') === 'true'
        || document.documentElement.getAttribute('data-mermaid-ready') === 'error',
      { timeout: 120000 },
    );
    const status = await page.evaluate(() => ({
      ready: document.documentElement.getAttribute('data-mermaid-ready'),
      err: document.documentElement.getAttribute('data-mermaid-error'),
      count: document.querySelectorAll('.mermaid').length,
      svgs: document.querySelectorAll('.mermaid svg').length,
    }));
    console.log('  mermaid:', status);
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size:8px; width:100%; padding:0 12mm; color:#666; display:flex; justify-content:space-between;">
          <span>OPMS Documentation</span>
          <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  fs.mkdirSync(PDF_DIR, { recursive: true });

  // 1) Full combined PDF
  console.log('Building full combined PDF…');
  const fullBody = buildCombinedBody(ORDERED_FILES, true);
  const fullHtml = buildDocumentHtml('OPMS Software Documentation — Complete', fullBody);
  const fullHtmlPath = path.join(PDF_DIR, 'OPMS-Documentation-Complete.html');
  fs.writeFileSync(fullHtmlPath, fullHtml, 'utf8');
  const fullPdfPath = path.join(PDF_DIR, 'OPMS-Documentation-Complete.pdf');
  await htmlToPdf(fullHtml, fullPdfPath);
  console.log('Wrote', fullPdfPath);

  // 2) Per-category PDFs
  for (const cat of CATEGORIES) {
    console.log(`Building ${cat.id}…`);
    const body = buildCombinedBody(cat.files, true);
    // Replace cover title
    const bodyTitled = body.replace(
      '<h1>OPMS Software Documentation</h1>',
      `<h1>${escapeHtml(cat.title)}</h1>`,
    );
    const html = buildDocumentHtml(cat.title, bodyTitled);
    fs.writeFileSync(path.join(PDF_DIR, `${cat.id}.html`), html, 'utf8');
    const pdfPath = path.join(PDF_DIR, `${cat.id}.pdf`);
    await htmlToPdf(html, pdfPath);
    console.log('Wrote', pdfPath);
  }

  // Index readme for pdf folder
  const index = `# OPMS Documentation — PDF copies

Generated from Markdown in \`docs/\` with Mermaid diagrams rendered.

## Files

| PDF | Contents |
|-----|----------|
| [OPMS-Documentation-Complete.pdf](./OPMS-Documentation-Complete.pdf) | Full suite (all categories) |
| [01-product.pdf](./01-product.pdf) | Product documentation |
| [02-architecture.pdf](./02-architecture.pdf) | Architecture + ADRs |
| [03-functional.pdf](./03-functional.pdf) | Functional modules |
| [04-api.pdf](./04-api.pdf) | API documentation |
| [05-database.pdf](./05-database.pdf) | Database documentation |
| [06-developer-deployment.pdf](./06-developer-deployment.pdf) | Developer & deployment |
| [07-user.pdf](./07-user.pdf) | User documentation |

HTML intermediates (same content, useful for debugging diagrams) are also in this folder.

## Regenerate

\`\`\`bash
cd docs/_pdf-build
node generate-pdf.mjs
\`\`\`

Requires Google Chrome and network access to load Mermaid from jsDelivr CDN (or cache).
`;
  fs.writeFileSync(path.join(PDF_DIR, 'README.md'), index, 'utf8');
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
