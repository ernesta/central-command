export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * The printable page every module's PDF export uses: a title, a quiet subtitle, a totals paragraph
 * and one table. Plain system fonts and no scripts or network resources, so it prints the same
 * anywhere. `totalsHtml`, `headHtml` and `bodyHtml` must already be escaped.
 */
export function reportPageHtml(page: {
  title: string
  subtitle: string
  totalsHtml: string
  headHtml: string
  bodyHtml: string
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(page.title)}</title>
<style>
@page { size: A4 landscape; margin: 14mm; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 9.5pt; color: #1b222b; }
h1 { margin: 0 0 4px; font-size: 18pt; }
.sub { margin: 0 0 10px; color: #5c6672; font-size: 9pt; }
.totals { margin: 0 0 12px; font-family: Helvetica, Arial, sans-serif; font-size: 9pt; }
table { width: 100%; border-collapse: collapse; font-family: Helvetica, Arial, sans-serif; font-size: 8.5pt; }
th { text-align: left; padding: 4px 6px; border-bottom: 1.5px solid #1b222b; font-size: 8pt; }
td { padding: 4px 6px; border-bottom: 0.5px solid #c3cad2; vertical-align: top; }
tr { break-inside: avoid; }
.nw { white-space: nowrap; }
.r { text-align: right; }
.q { color: #5c6672; }
</style>
</head>
<body>
<h1>${escapeHtml(page.title)}</h1>
<p class="sub">${escapeHtml(page.subtitle)}</p>
<p class="totals">${page.totalsHtml}</p>
<table>
<thead><tr>${page.headHtml}</tr></thead>
<tbody>
${page.bodyHtml}
</tbody>
</table>
</body>
</html>
`
}
