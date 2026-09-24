/**
 * Copy text with formatting. Word, Google Docs and email clients read the HTML flavour (so
 * italics survive the paste); plain-text editors read the text flavour. Falls back to text only.
 */
export async function copyRichText({ html, text }: { html: string; text: string }): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })
      ])
      return
    } catch {
      // Some environments refuse rich clipboard writes; plain text is still worth having.
    }
  }
  await navigator.clipboard.writeText(text)
}
