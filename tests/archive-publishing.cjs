const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:52934';
const root = path.resolve(__dirname, '..');
const owner = 'b1363f93-72fa-440c-897b-22e0fedb442f';
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {
    for (const width of [1272,390]) {
      const context = await browser.newContext({viewport:{width,height:850}});
      const page = await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
      let entries=[],isOwner=true,failSave=false,lostResponse=false,uploads=0;
      await page.route('**/assets/oriphim-supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'assets/oriphim-supabase.js'),'utf8')+`\nwindow.sb.auth.getUser=async()=>({data:{user:{id:'${owner}',email:'editor@example.invalid',user_metadata:{oriphim_waitlist:{joined:true}}}},error:null});`}));
      await page.route('**/rest/v1/archive_editors*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(isOwner?{user_id:owner}:null)}));
      await page.route('**/rest/v1/archive_entries*',async route=>{
        const request=route.request(),url=new URL(request.url());const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
        if(request.method()==='POST'){
          if(failSave)return json({message:'Unavailable'},503);
          const row={...request.postDataJSON(),entry_number:2,created_at:'2026-09-22T12:00:00Z',updated_at:'2026-09-22T12:00:00Z'};entries.push(row);
          return lostResponse?json({message:'Lost response'},503):json(row,201);
        }
        if(request.method()==='PATCH') {const row=entries.find(e=>'eq.'+e.id===url.searchParams.get('id'));Object.assign(row,request.postDataJSON(),{updated_at:'2026-09-22T13:00:00Z'});return json(row);}
        let rows=entries.filter(e=>(!url.searchParams.has('tag')||url.searchParams.get('tag')==='eq.'+e.tag)&&(!url.searchParams.has('id')||url.searchParams.get('id')==='eq.'+e.id));
        if(url.searchParams.has('search_document')){const query=url.searchParams.get('search_document').split('.').slice(1).join('.').toLowerCase();rows=rows.filter(e=>(e.title+' '+e.body).toLowerCase().includes(query));}
        return json(url.searchParams.has('id')?rows[0]||null:rows);
      });
      await page.route('**/storage/v1/object/archive-covers/**',route=>{uploads++;return route.fulfill({contentType:'application/json',body:'{"Key":"archive-covers/test"}'});});
      await page.route('**/storage/v1/object/public/archive-covers/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64')}));
      await page.goto(base+'/archive');await page.locator('[data-edit-entry]').waitFor({state:'visible'});await page.locator('[data-edit-entry]').click();
      await page.locator('.archive-editor [name=title]').fill('A new research entry');
      await page.locator('.archive-editor [name=body]').fill('Plasma convergence.\n\n<img src=x onerror=alert(1)> stays text.');
      await page.locator('.archive-editor [name=tag]').selectOption('Research');
      await page.locator('.archive-editor [data-preview]').click();
      assert.equal(await page.locator('.archive-preview img').count(),0,'Body must not execute HTML');
      failSave=true;await page.locator('[data-publish]').click();await page.getByText('Couldn’t save the entry. Your text is still here; please try again.').waitFor();
      assert.equal(await page.locator('[name=title]').inputValue(),'A new research entry');
      await page.locator('[name=cover]').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
      await page.getByText('Choose a JPG, PNG, WebP, or HTML animation no larger than 5 MB.').waitFor();
      const image=await page.locator('.nav-home').screenshot();
      await page.locator('[name=cover]').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:image});
      await page.locator('.archive-cover-preview').waitFor({state:'visible'});
      await page.locator('[name=cover_alt]').fill('Test cover');
      await page.screenshot({path:`/tmp/archive-editor-${width}.png`});
      failSave=false;lostResponse=true;await page.locator('[data-publish]').click();await page.locator('.archive-editor').waitFor({state:'hidden'});
      assert.equal(entries.length,1,'Lost response must not duplicate publication');assert.equal(uploads,1);
      await page.locator('[data-dynamic-entries] .feed-title').waitFor();assert.equal(await page.locator('[data-recent-entries] a').first().textContent(),'A new research entrySep 22, 2026');
      await page.locator('[data-filter=build]').click();await page.locator('[data-dynamic-entries] .feed-card').waitFor({state:'detached'});
      await page.locator('[data-filter=research]').click();await page.locator('[data-dynamic-entries] .feed-card').waitFor();
      await page.locator('#archiveSearchInput').fill('plasma');await page.waitForTimeout(400);assert.equal(await page.locator('[data-dynamic-entries] .feed-card').count(),1);
      await page.locator('#archiveSearchInput').fill('nomatch');await page.getByText('No entries match your search.').waitFor();
      await page.goto(base+'/archive/entry?id='+entries[0].id);await page.getByRole('heading',{name:'A new research entry',exact:true}).waitFor();await page.locator('[data-edit-entry]').click();await page.locator('[name=title]').fill('Updated title');await page.locator('[data-publish]').click();await page.getByRole('heading',{name:'Updated title',exact:true}).waitFor();
      isOwner=false;await page.reload();await page.locator('.archive-article').waitFor();assert.equal(await page.locator('[data-edit-entry]').isVisible(),false);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
      console.log(width,'create, preview, image, retry, search, tags, recent, reader, edit, owner-only controls passed');await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
