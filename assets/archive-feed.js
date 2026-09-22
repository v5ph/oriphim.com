import {fields,element,card,entryUrl,dateLabel} from './archive-common.js';
const sb=window.sb;
const feed=document.querySelector('[data-dynamic-entries]');
const recent=document.querySelector('[data-recent-entries]');
const search=document.getElementById('archiveSearchInput');
const placeholder=document.getElementById('searchPlaceholder');
const tabs=[...document.querySelectorAll('[data-filter]')];
const legacy=document.querySelector('[data-entry]');
const empty=document.querySelector('[data-feed-empty]');
const status=document.querySelector('[data-archive-status]');
const more=document.querySelector('[data-load-more]');
const tagMap={announcement:'Announcement',research:'Research',build:'Build Log'};
let active='all',generation=0,offset=0,timer;
function recentList(entries){
  recent.replaceChildren();
  for(const entry of entries){const link=element('a',entry.title,'archive-recent-link');link.href=entryUrl(entry);link.append(element('small',dateLabel(entry.created_at)));recent.append(link);}
  const legacyLink=element('a','The Archive is live.','archive-recent-link');legacyLink.href='/archive/catalogue-01';recent.append(legacyLink);
}
async function load(append=false){
  const token=++generation;
  if(!append){offset=0;feed.replaceChildren();}
  more.hidden=true;status.textContent='Loading entries…';
  const query=search.value.trim();
  legacy.hidden=!(active==='all'||active==='announcement') || !!(query&&!legacy.textContent.toLowerCase().includes(query.toLowerCase()));
  empty.hidden=true;
  if(!sb){status.textContent='New entries are unavailable right now. Please reload to try again.';return;}
  try{
    let request=sb.from('archive_entries').select(fields).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+19);
    if(active!=='all')request=request.eq('tag',tagMap[active]);
    if(query)request=request.textSearch('search_document',query,{type:'websearch',config:'english'});
    const {data,error}=await request;
    if(token!==generation)return;
    if(error)throw error;
    data.forEach(entry=>feed.append(card(entry)));
    offset+=data.length;more.hidden=data.length<20;
    status.textContent='';empty.hidden=feed.children.length>0||!legacy.hidden;
    empty.querySelector('p').textContent=query?'No entries match your search.':'No entries with this tag yet.';
  }catch{if(token===generation)status.textContent='Couldn’t load new entries. Please try again.';}
}
async function refreshRecent(){
  if(!sb){recentList([]);return;}
  const {data,error}=await sb.from('archive_entries').select('id,title,created_at').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(5);
  recentList(error?[]:data);
}
search.addEventListener('input',()=>{placeholder.hidden=!!search.value;generation++;clearTimeout(timer);timer=setTimeout(()=>load(),200);});
search.addEventListener('focus',()=>placeholder.hidden=true);
search.addEventListener('blur',()=>placeholder.hidden=!!search.value);
tabs.forEach(tab=>tab.addEventListener('click',()=>{active=tab.dataset.filter;tabs.forEach(other=>{other.classList.toggle('active',other===tab);other.setAttribute('aria-selected',String(other===tab));});clearTimeout(timer);load();}));
more.addEventListener('click',()=>load(true));
document.querySelector('[data-archive-retry]').addEventListener('click',()=>{load();refreshRecent();});
window.addEventListener('archive-published',()=>{search.value='';placeholder.hidden=false;active='all';tabs.forEach(t=>{t.classList.toggle('active',t.dataset.filter==='all');t.setAttribute('aria-selected',String(t.dataset.filter==='all'));});load();refreshRecent();});
load();refreshRecent();
