/** @typedef {{id:string,entry_number:number,title:string,body:string,tag:string,cover_path:string|null,cover_alt:string,attachments:ArchiveAttachment[],created_at:string,updated_at:string}} ArchiveEntry */
export const fields = 'id,entry_number,title,body,tag,cover_path,cover_alt,attachments,created_at,updated_at';
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

/** @typedef {{path:string,name:string,kind:'pdf'|'zip',size:number}} ArchiveAttachment */
export const attachmentBucket='archive-attachments';
export const attachmentLimit=10;
export const attachmentSizeLimit=25*1024*1024;
export const fileSize=size=>size>=1048576?(size/1048576).toFixed(1)+' MB':Math.max(1,Math.ceil(size/1024))+' KB';
/** Check extension and file signature; never execute or extract uploaded files. */
export async function inspectAttachment(file){
  const kind=file.name.split('.').pop().toLowerCase();
  if(!['pdf','zip'].includes(kind))throw Error('Choose a PDF or ZIP file.');
  if(!file.size||file.size>attachmentSizeLimit)throw Error('Each attachment must be between 1 byte and 25 MB.');
  if(file.name.length>255)throw Error('Use a filename shorter than 256 characters.');
  const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
  const valid=kind==='pdf'?new TextDecoder().decode(bytes).startsWith('%PDF-'):
    bytes[0]===0x50&&bytes[1]===0x4b&&((bytes[2]===3&&bytes[3]===4)||(bytes[2]===5&&bytes[3]===6)||(bytes[2]===7&&bytes[3]===8));
  if(!valid)throw Error('That file does not appear to be a valid '+kind.toUpperCase()+'.');
  return {kind,type:kind==='pdf'?'application/pdf':'application/zip'};
}
export function attachmentUrl(file,download=false){
  if(!file||!['pdf','zip'].includes(file.kind)||typeof file.path!=='string'||!new RegExp('^[0-9a-f-]{36}/[0-9a-f-]{36}\\.'+file.kind+'$').test(file.path))return '';
  return window.sb.storage.from(attachmentBucket).getPublicUrl(file.path,download?{download:file.name}:{}).data.publicUrl;
}
/** Attachments appear after article text, with native PDF viewing and ZIP downloads. */
export function renderAttachments(target,files,localUrls=new Map()){
  if(!files?.length)return;
  const section=element('section','','archive-attachments');section.setAttribute('aria-label','Post attachments');
  section.append(element('h2','Attachments'));
  for(const file of files){
    const url=localUrls.get(file)||attachmentUrl(file);if(!url)continue;
    const card=element('section','','archive-attachment');
    const header=element('div','','archive-attachment-header');
    header.append(element('h3',file.name),element('span',file.kind.toUpperCase()+' · '+fileSize(file.size)));
    const actions=element('div','','archive-attachment-links');
    if(file.kind==='pdf'){
      const open=element('a','Open PDF');open.href=url;open.target='_blank';open.rel='noopener noreferrer';actions.append(open);
    }
    const download=element('a',file.kind==='zip'?'Download ZIP':'Download');download.href=localUrls.get(file)||attachmentUrl(file,true);download.download=file.name;actions.append(download);header.append(actions);card.append(header);
    if(file.kind==='pdf'){
      const frame=element('iframe','','archive-pdf');frame.title='PDF: '+file.name;frame.loading='lazy';frame.referrerPolicy='no-referrer';frame.src=url+'#view=FitH';card.append(frame);
      card.append(element('p','If the preview is unavailable, use Open PDF or Download.','archive-attachment-note'));
    }
    section.append(card);
  }
  target.append(section);
}
