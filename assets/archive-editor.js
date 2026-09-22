import {fields,tags,bucket,element,renderBody,coverUrl} from './archive-common.js';
const sb=window.sb;
const control=document.querySelector('[data-edit-entry]');
if(sb&&control){
  let user=null,allowed=false,current=null,busy=false,dirty=false,previewUrl='',pendingPath='',pendingFile=null;
  let entryId=crypto.randomUUID();
  const dialog=element('dialog','','archive-editor');
  dialog.setAttribute('aria-labelledby','archive-editor-title');
  dialog.innerHTML=`<form><header><h2 id="archive-editor-title">New entry</h2><button type="button" data-close aria-label="Close editor">×</button></header><label>Title<input name="title" required maxlength="160"></label><label>Tag<select name="tag"></select></label><label>Post<textarea name="body" rows="12" required maxlength="100000" placeholder="Write your entry. Blank lines start new paragraphs."></textarea></label><label>Cover image <small>Optional · JPG, PNG, or WebP · up to 5 MB. Covers are public once uploaded.</small><input name="cover" type="file" accept="image/jpeg,image/png,image/webp"></label><img class="archive-cover-preview" alt="Selected cover" hidden><label class="archive-remove-cover" hidden><input type="checkbox" name="remove_cover"> Remove current cover</label><label>Cover description<input name="cover_alt" maxlength="300" placeholder="Describe the image for readers using a screen reader"></label><div class="archive-editor-actions"><button type="button" data-preview>Preview</button><button type="submit" data-publish>Publish entry</button></div><p role="status" data-editor-status aria-live="polite"></p><section class="archive-preview" hidden aria-label="Entry preview"></section></form>`;
  document.body.append(dialog);
  const form=dialog.querySelector('form');
  const input=name=>form.elements.namedItem(name);
  tags.forEach(tag=>input('tag').append(new Option(tag,tag)));
  const status=dialog.querySelector('[data-editor-status]');
  const preview=dialog.querySelector('.archive-preview');
  const image=dialog.querySelector('.archive-cover-preview');
  function clearPreviewUrl(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';}
  function setImage(url){image.hidden=!url;if(url)image.src=url;else image.removeAttribute('src');}
  function open(){
    if(!allowed||!user)return;
    form.reset();clearPreviewUrl();pendingPath='';pendingFile=null;dirty=false;entryId=current?.id||crypto.randomUUID();preview.hidden=true;status.textContent='';
    dialog.querySelector('h2').textContent=current?'Edit entry':'New entry';
    dialog.querySelector('[data-publish]').textContent=current?'Save changes':'Publish entry';
    for(const name of ['title','body','tag','cover_alt'])input(name).value=current?.[name]||(name==='tag'?tags[0]:'');
    dialog.querySelector('.archive-remove-cover').hidden=!current?.cover_path;
    setImage(coverUrl(current?.cover_path));dialog.showModal();input('title').focus();
  }
  function close(){if(busy)return;if(dirty&&!confirm('Discard your unsaved changes?'))return;dialog.close();clearPreviewUrl();}
  control.addEventListener('click',open);
  dialog.querySelector('[data-close]').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  form.addEventListener('input',()=>{dirty=true;});
  input('cover').addEventListener('change',async()=>{
    clearPreviewUrl();const file=input('cover').files[0];status.textContent='';
    if(!file){setImage(input('remove_cover').checked?'':coverUrl(current?.cover_path));return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){input('cover').value='';setImage(coverUrl(current?.cover_path));status.textContent='Choose a JPG, PNG, or WebP image no larger than 5 MB.';return;}
    try{const bitmap=await createImageBitmap(file);bitmap.close();if(input('cover').files[0]!==file)return;previewUrl=URL.createObjectURL(file);setImage(previewUrl);input('remove_cover').checked=false;}
    catch{input('cover').value='';setImage(coverUrl(current?.cover_path));status.textContent='That file could not be opened as an image.';}
  });
  input('remove_cover').addEventListener('change',()=>{if(input('remove_cover').checked){input('cover').value='';clearPreviewUrl();setImage('');}else setImage(coverUrl(current?.cover_path));});
  dialog.querySelector('[data-preview]').addEventListener('click',()=>{
    preview.replaceChildren(element('p',input('tag').value,'eyebrow'),element('h2',input('title').value||'Untitled entry'));
    if(!image.hidden){const img=element('img');img.src=image.src;img.alt=input('cover_alt').value;preview.append(img);}
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
        if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5242880)throw Error('Choose a supported image up to 5 MB.');
        const decoded=await createImageBitmap(file);decoded.close();
        if(pendingFile!==file){
          const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
          const uploadPath=`${user.id}/${crypto.randomUUID()}.${ext}`;
          const {error}=await sb.storage.from(bucket).upload(uploadPath,file,{contentType:file.type,cacheControl:'3600',upsert:false});
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
      dirty=false;dialog.close();clearPreviewUrl();
      window.dispatchEvent(new CustomEvent('archive-published',{detail:data}));
      if(oldPath&&oldPath!==path)sb.storage.from(bucket).remove([oldPath]).catch(()=>{});
    }catch(error){status.textContent=error.message||'Couldn’t save. Please try again.';}
    finally{busy=false;form.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=false);}
  });
  async function permission(){
    const result=await sb.auth.getUser();user=result.error?null:result.data.user;allowed=false;
    if(user){const {data,error}=await sb.from('archive_editors').select('user_id').eq('user_id',user.id).maybeSingle();allowed=!error&&!!data;}
    control.hidden=!allowed||(control.dataset.editEntry==='existing'&&!current);
    if(!allowed&&dialog.open){dirty=false;dialog.close();clearPreviewUrl();}
  }
  window.addEventListener('archive-entry-loaded',event=>{current=event.detail;control.hidden=!allowed;});
  sb.auth.onAuthStateChange(()=>setTimeout(()=>permission().catch(()=>{control.hidden=true;}),0));
  permission().catch(()=>{control.hidden=true;});
  window.addEventListener('beforeunload',event=>{if(dialog.open&&dirty){event.preventDefault();event.returnValue='';}});
}
