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
  if (!path || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|html)$/.test(path)) return '';
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
  if(imageUrl)article.append(expandableCover(imageUrl,entry.cover_alt||entry.title,'archive-cover'));else article.classList.add('archive-no-cover');
  return article;
}

/** Decode a supported cover before either previewing or uploading it. */
export async function inspectCover(file){
  if(file.size>5242880)throw Error('Choose a cover no larger than 5 MB.');
  if(/\.html?$/i.test(file.name)){
    const source=await file.text();
    if(!/<(?:!doctype\s+html|html|body|canvas|svg|div|style|script)\b/i.test(source))throw Error('Choose an HTML document containing your animation.');
    return {ext:'html',type:'text/html',source};
  }
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
  if(!ext)throw Error('Choose a JPG, PNG, WebP, or HTML animation no larger than 5 MB.');
  const bitmap=await createImageBitmap(file);bitmap.close();
  return {ext,type:file.type};
}

// Opaque-origin frames can execute animation code but cannot access the host,
// cookies, storage, forms, popups, or external resources. Never add allow-same-origin.
const animationPolicy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
class ArchiveAnimation extends HTMLElement{
  connectedCallback(){
    this.abort=new AbortController();
    this.playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.frame=element('iframe');this.frame.title=this.description||'Archive animation';
    this.frame.setAttribute('sandbox','allow-scripts');this.frame.referrerPolicy='no-referrer';
    this.frame.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
    this.toggle=element('button','Play animation');this.toggle.type='button';this.toggle.hidden=this.playing;
    this.message=element('span','', 'archive-animation-status');this.message.setAttribute('role','status');
    this.replaceChildren(this.frame,this.toggle,this.message);
    this.toggle.addEventListener('click',()=>{this.playing=true;this.toggle.hidden=true;this.update();});
    this.observer=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.update();});this.observer.observe(this);
    document.addEventListener('visibilitychange',()=>this.update(),{signal:this.abort.signal});
  }
  disconnectedCallback(){this.abort?.abort();this.observer?.disconnect();this.frame?.removeAttribute('srcdoc');}
  async update(){
    if(!this.isConnected)return;
    if(!this.playing||document.hidden){this.frame.removeAttribute('srcdoc');return;}
    if(!this.visible)return;
    if(this.frame.hasAttribute('srcdoc')||this.loading)return;
    this.loading=true;this.message.textContent='Loading animation…';
    try{
      if(this.htmlSource===undefined){
        const response=await fetch(this.sourceUrl,{credentials:'omit',signal:this.abort.signal});
        if(!response.ok)throw Error('Animation unavailable.');
        const blob=await response.blob();if(blob.size>5242880)throw Error('Animation is too large.');
        this.htmlSource=await blob.text();
      }
      if(this.isConnected&&this.playing&&this.visible&&!document.hidden){
        this.frame.srcdoc='<!doctype html><meta http-equiv="Content-Security-Policy" content="'+animationPolicy+'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}</style>'+this.htmlSource;
      }
      this.message.textContent='';
    }catch(error){if(error.name!=='AbortError'){this.message.textContent='Animation could not load. Try playing it again.';this.playing=false;this.toggle.textContent='Retry animation';this.toggle.hidden=false;}}
    finally{this.loading=false;}
  }
}
customElements.define('archive-animation',ArchiveAnimation);
/** Both local editor previews and published covers use the same renderer. */
export function coverMedia(url,description='',className='',source){
  if(source!==undefined||url.endsWith('.html')){
    const animation=element('archive-animation','',className);
    animation.sourceUrl=url;animation.htmlSource=source;animation.description=description;
    return animation;
  }
  const image=element('img','',className);image.src=url;image.alt=description;image.loading='lazy';return image;
}

export function expandableCover(url,description,className){
  const wrapper=element('div','','archive-expandable '+className);
  // Keep the live iframe in one dialog for its entire lifetime. showModal()
  // promotes it to the top layer without reparenting or reloading its document.
  const viewer=element('dialog','','archive-media-dialog');
  viewer.setAttribute('aria-label',description||'Cover preview');
  const close=element('button','×','archive-media-close');close.type='button';close.setAttribute('aria-label','Close cover preview');
  close.addEventListener('click',()=>viewer.close());
  viewer.addEventListener('click',event=>{if(event.target===viewer)viewer.close();});
  viewer.append(close,coverMedia(url,description,'archive-expanded-media'));
  const open=element('button','','archive-media-open');open.type='button';open.setAttribute('aria-label','Enlarge '+(description||'cover'));
  open.addEventListener('click',()=>{viewer.showModal();close.focus();});
  wrapper.append(viewer,open);return wrapper;
}
