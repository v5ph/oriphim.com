import {fields,element,renderBody,coverUrl,expandableCover,dateLabel,readTime} from './archive-common.js';
const root=document.querySelector('[data-entry-content]');
const id=new URLSearchParams(location.search).get('id');
async function load(){
  root.replaceChildren(element('p','Loading entry…'));
  if(!id||!/^[0-9a-f-]{36}$/.test(id)){root.replaceChildren(element('h1','Entry not found.'));return;}
  try{
    const {data,error}=await window.sb.from('archive_entries').select(fields).eq('id',id).maybeSingle();
    if(error)throw error;
    if(!data){root.replaceChildren(element('h1','Entry not found.'));return;}
    const article=element('article','','archive-article');
    article.append(element('p',`ENTRY No. ${String(data.entry_number).padStart(2,'0')} / ${data.tag} / ${dateLabel(data.created_at)} / ${readTime(data)}`,'eyebrow'),element('h1',data.title));
    const url=coverUrl(data.cover_path);if(url){article.append(expandableCover(url,data.cover_alt||data.title,'archive-article-cover'));}
    const body=element('div','','archive-prose');renderBody(body,data.body);article.append(body);root.replaceChildren(article);
    document.title=data.title+' | Oriphim Archive';
    for (const selector of ['meta[property="og:title"]','meta[name="twitter:title"]']) document.querySelector(selector)?.setAttribute('content',document.title);
    for (const selector of ['meta[name="description"]','meta[property="og:description"]','meta[name="twitter:description"]']) document.querySelector(selector)?.setAttribute('content',data.body.slice(0,160));
    document.querySelector('meta[property="og:url"]')?.setAttribute('content','https://oriphim.com/archive/entry?id='+encodeURIComponent(id));
    const canonical=document.querySelector('link[rel="canonical"]');canonical.href='https://oriphim.com/archive/entry?id='+encodeURIComponent(id);
    window.dispatchEvent(new CustomEvent('archive-entry-loaded',{detail:data}));
  }catch{root.replaceChildren(element('h1','Entry unavailable.'),element('p','Please reload to try again.'));}
}
window.addEventListener('archive-published',load);load();
