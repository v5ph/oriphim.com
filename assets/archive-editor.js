import {fields,tags,bucket,element,renderBody,coverUrl,coverMedia,inspectCover} from './archive-common.js';
const sb=window.sb;
const control=document.querySelector('[data-edit-entry]');
if(sb&&control){
  let user=null,allowed=false,current=null,busy=false,dirty=false,previewUrl='',pendingPath='',pendingFile=null;
  let entryId=crypto.randomUUID();
  const dialog=element('dialog','','archive-editor');
  dialog.setAttribute('aria-labelledby','archive-editor-title');
  dialog.innerHTML=`<form><header><h2 id="archive-editor-title">New entry</h2><button type="button" data-close aria-label="Close editor">×</button></header><label>Title<input name="title" required maxlength="160"></label><label>Tag<select name="tag"></select></label><label>Post<textarea name="body" rows="12" required maxlength="100000" placeholder="Write your entry. Blank lines start new paragraphs."></textarea></label><label>Cover image or animation <small>Optional · JPG, PNG, WebP, or self-contained HTML · up to 5 MB. Include all animation code and assets in the HTML file. Covers are public once uploaded.</small><input name="cover" type="file" accept="image/jpeg,image/png,image/webp,text/html,.html,.htm"></label><div class="archive-cover-selection" hidden></div><label class="archive-remove-cover" hidden><input type="checkbox" name="remove_cover"> Remove current cover</label><label>Cover description<input name="cover_alt" maxlength="300" placeholder="Describe the image or animation for readers using a screen reader"></label><div class="archive-editor-actions"><button type="button" data-preview>Preview</button><button type="submit" data-publish>Publish entry</button></div><p role="status" data-editor-status aria-live="polite"></p><section class="archive-preview" hidden aria-label="Entry preview"></section></form>`;
  document.body.append(dialog);
  const form=dialog.querySelector('form');
  const input=name=>form.elements.namedItem(name);
  tags.forEach(tag=>input('tag').append(new Option(tag,tag)));
  const status=dialog.querySelector('[data-editor-status]');
  const preview=dialog.querySelector('.archive-preview');
  const image=dialog.querySelector('.archive-cover-selection');
  let selectedUrl='',selectedSource;
  function clearPreviewUrl(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';}
  function setImage(url,source){selectedUrl=url;selectedSource=source;image.hidden=!url;image.replaceChildren();if(url)image.append(coverMedia(url,input('cover_alt').value||'Selected cover','archive-cover-preview',source));}
  function open(){
    if(!allowed||!user)return;
    form.reset();clearPreviewUrl();pendingPath='';pendingFile=null;dirty=false;entryId=current?.id||crypto.randomUUID();preview.hidden=true;status.textContent='';
    dialog.querySelector('h2').textContent=current?'Edit entry':'New entry';
    dialog.querySelector('[data-publish]').textContent=current?'Save changes':'Publish entry';
    for(const name of ['title','body','tag','cover_alt'])input(name).value=current?.[name]||(name==='tag'?tags[0]:'');
    dialog.querySelector('.archive-remove-cover').hidden=!current?.cover_path;
    setImage(coverUrl(current?.cover_path));dialog.showModal();input('title').focus();
  }
  function close(){if(busy)return;if(dirty&&!confirm('Discard your unsaved changes?'))return;dialog.close();setImage('');preview.replaceChildren();clearPreviewUrl();}
  control.addEventListener('click',open);
  dialog.querySelector('[data-close]').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  form.addEventListener('input',()=>{dirty=true;});
  input('cover').addEventListener('change',async()=>{
    clearPreviewUrl();const file=input('cover').files[0];status.textContent='';
    if(!file){setImage(input('remove_cover').checked?'':coverUrl(current?.cover_path));return;}
    try{const media=await inspectCover(file);if(input('cover').files[0]!==file)return;previewUrl=URL.createObjectURL(file);setImage(previewUrl,media.source);input('remove_cover').checked=false;}
    catch(error){if(input('cover').files[0]!==file)return;input('cover').value='';setImage(coverUrl(current?.cover_path));status.textContent=error.message||'That file could not be opened.';}
  });
  input('remove_cover').addEventListener('change',()=>{if(input('remove_cover').checked){input('cover').value='';clearPreviewUrl();setImage('');}else setImage(coverUrl(current?.cover_path));});
  dialog.querySelector('[data-preview]').addEventListener('click',()=>{
    preview.replaceChildren(element('p',input('tag').value,'eyebrow'),element('h2',input('title').value||'Untitled entry'));
    if(!image.hidden)preview.append(coverMedia(selectedUrl,input('cover_alt').value,'',selectedSource));
    const body=element('div','','archive-prose');renderBody(body,input('body').value);preview.append(body);preview.hidden=false;preview.scrollIntoView({block:'start',behavior:'smooth'});
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!allowed||!form.reportValidity())return;
    if(!input('title').value.trim()||!input('body').value.trim()){status.textContent='Add a title and post before publishing.';return;}
    busy=true;form.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=true);status.textContent='Saving entry…';
    try{
      let path=input('remove_cover').checked?null:(current?.cover_path||null);
      const file=input('cover').files[0];
      if(file){
        const media=await inspectCover(file);
        if(pendingFile!==file){
          const ext=media.ext;
          const uploadPath=`${user.id}/${crypto.randomUUID()}.${ext}`;
          const {error}=await sb.storage.from(bucket).upload(uploadPath,file,{contentType:media.type,cacheControl:'3600',upsert:false});
          if(error)throw Error('Cover upload failed. Your entry has not been published. Please try again.');
          pendingPath=uploadPath;pendingFile=file;
        }
        path=pendingPath;
      }
      const values={title:input('title').value.trim(),body:input('body').value.trim(),tag:input('tag').value,cover_path:path,cover_alt:input('cover_alt').value.trim()};
      let data,error;
      if(current){({data,error}=await sb.from('archive_entries').update(values).eq('id',entryId).eq('updated_at',current.updated_at).select(fields).maybeSingle());}
      else{
        ({data,error}=await sb.from('archive_entries').insert({id:entryId,...values}).select(fields).single());
        // Resolve a lost response before retrying, without publishing duplicates.
        if(error){const found=await sb.from('archive_entries').select(fields).eq('id',entryId).maybeSingle();if(found.data&&Object.entries(values).every(([key,value])=>found.data[key]===value)){data=found.data;error=null;}}
      }
      if(error)throw Error('Couldn’t save the entry. Your text is still here; please try again.');
      if(!data)throw Error('This entry changed in another window. Copy your text, then reload before editing again.');
      const oldPath=current?.cover_path;
      dirty=false;dialog.close();setImage('');preview.replaceChildren();clearPreviewUrl();
      window.dispatchEvent(new CustomEvent('archive-published',{detail:data}));
      if(oldPath&&oldPath!==path)sb.storage.from(bucket).remove([oldPath]).catch(()=>{});
    }catch(error){status.textContent=error.message||'Couldn’t save. Please try again.';}
    finally{busy=false;form.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=false);}
  });
  async function permission(){
    const result=await sb.auth.getUser();user=result.error?null:result.data.user;allowed=false;
    if(user){const {data,error}=await sb.from('archive_editors').select('user_id').eq('user_id',user.id).maybeSingle();allowed=!error&&!!data;}
    control.hidden=!allowed||(control.dataset.editEntry==='existing'&&!current);
    if(!allowed&&dialog.open){dirty=false;dialog.close();setImage('');preview.replaceChildren();clearPreviewUrl();}
  }
  window.addEventListener('archive-entry-loaded',event=>{current=event.detail;control.hidden=!allowed;});
  sb.auth.onAuthStateChange(()=>setTimeout(()=>permission().catch(()=>{control.hidden=true;}),0));
  permission().catch(()=>{control.hidden=true;});
  window.addEventListener('beforeunload',event=>{if(dialog.open&&dirty){event.preventDefault();event.returnValue='';}});
}
