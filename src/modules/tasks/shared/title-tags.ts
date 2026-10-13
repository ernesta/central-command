/**
 * Tags typed into a new task's title: `Write intro #study #paper` is the task "Write intro" with the tags study and
 * paper. A tag starts at a `#` that begins the title or follows a space and must begin with a letter, so "issue #12"
 * and "C#" stay as written. Tags are lower case, like every tag.
 */
const TAG = /(^|\s)#(\p{L}[\p{L}\p{N}_-]*)(?=\s|$)/gu

export function splitTitleTags(text: string): { title: string; tags: string[] } {
  const tags: string[] = []
  const title = text
    .replace(TAG, (_, _space: string, tag: string) => {
      tags.push(tag.toLowerCase())
      return ' '
    })
    .replace(/\s+/g, ' ')
    .trim()
  return { title, tags: [...new Set(tags)] }
}
