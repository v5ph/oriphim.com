/** @typedef {{id:string,entry_number:number,title:string,body:string,tag:string,cover_path:string|null,cover_alt:string,created_at:string,updated_at:string}} ArchiveEntry */
export const fields = 'id,entry_number,title,body,tag,cover_path,cover_alt,created_at,updated_at';
export const tags = ['Announcement', 'Research', 'Build Log'];
export const bucket = 'archive-covers';
/** @param {string} tag @param {string} [text] @param {string} [className] */
export function element(tag, text = '', className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}
/** @param {ArchiveEntry} entry */
export const entryUrl = entry => '/archive/entry?id=' + encodeURIComponent(entry.id);
/** @param {ArchiveEntry} entry */
export const readTime = entry => Math.max(1, Math.ceil(entry.body.trim().split(/\s+/).length / 220)) + ' min read';
/** @param {string} value */
export const dateLabel = value => new Date(value).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
/** @param {string|null} path */
export function coverUrl(path) {
  if (!path || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path)) return '';
  return window.sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
/** Render text as paragraphs, never executable HTML. @param {HTMLElement} target @param {string} body */
export function renderBody(target, body) {
  target.replaceChildren(...body.trim().split(/\n\s*\n/).filter(text => text.trim()).map(text => element('p', text)));
}
/** @param {ArchiveEntry} entry */
export function card(entry) {
  const article = element('article', '', 'feed-card');
  const main = element('div', '', 'feed-main');
  const number = String(entry.entry_number).padStart(2, '0');
  main.append(element('div', `ORIPHIM RESEARCH — ENTRY No. ${number} / ${dateLabel(entry.created_at)}`, 'feed-catalog'));
  const heading = element('h2', '', 'feed-title');
  const link = element('a', entry.title); link.href = entryUrl(entry); heading.append(link);
  main.append(heading, element('p', entry.body.length > 260 ? entry.body.slice(0,260) + '…' : entry.body, 'feed-body'));
  const meta = element('div', '', 'feed-meta');meta.append(element('span', entry.tag),element('span', readTime(entry)));main.append(meta);
  const read = element('a', 'Read entry', 'feed-read');read.href=entryUrl(entry);main.append(read);article.append(main);
  const imageUrl=coverUrl(entry.cover_path);
  if(imageUrl){const anchor=element('a','','archive-cover');anchor.href=entryUrl(entry);anchor.setAttribute('aria-label','Read '+entry.title);const image=element('img');image.src=imageUrl;image.alt=entry.cover_alt;image.loading='lazy';anchor.append(image);article.append(anchor);}else article.classList.add('archive-no-cover');
  return article;
}
