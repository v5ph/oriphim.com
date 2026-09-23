const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const owner='b1363f93-72fa-440c-897b-22e0fedb442f';
const entryId='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const base='http://127.0.0.1:52934';
const fixture=`<!doctype html><html><body><canvas width="100" height="100"></canvas><script>
const ctx=document.querySelector('canvas').getContext('2d');ctx.fillStyle='orange';ctx.fillRect(0,0,100,100);
try{parent.document.body.dataset.escaped='yes'}catch{document.body.dataset.parentBlocked='yes'}
try{localStorage.getItem('oriphim.auth')}catch{document.body.dataset.storageBlocked='yes'}
fetch('https://example.com/forbidden').catch(()=>document.body.dataset.networkBlocked='yes');
document.body.dataset.running='yes';
</script></body></html>`;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 for(const width of [1272,390]){
  const page=await browser.newPage({viewport:{width,height:850}});let entry=null,uploads=0;page.setDefaultTimeout(12000);
  const policy=fs.readFileSync('_headers','utf8').match(/Content-Security-Policy: (.*)/)[1];
  await page.route('**/archive*',async route=>{if(route.request().resourceType()!=='document')return route.continue();const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'content-security-policy':policy}});});
  await page.route('**/assets/oriphim-supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync('assets/oriphim-supabase.js','utf8')+`\nwindow.sb.auth.getUser=async()=>({data:{user:{id:'${owner}',user_metadata:{oriphim_waitlist:{joined:true}}}},error:null});`}));
  await page.route('**/rest/v1/archive_editors*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({user_id:owner})}));
  await page.route('**/rest/v1/archive_entries*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()==='POST')entry={...req.postDataJSON(),entry_number:3,created_at:'2026-09-23T12:00:00Z',updated_at:'2026-09-23T12:00:00Z'};
   if(req.method()==='PATCH')entry={...entry,...req.postDataJSON()};
   const body=req.method()!=='GET'||url.searchParams.has('id')?entry:entry?[entry]:[];
   return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.route('**/storage/v1/object/archive-covers/**',route=>{uploads++;assert.ok(route.request().url().endsWith('.html'));assert.ok(route.request().postDataBuffer().includes(Buffer.from('text/html')));return route.fulfill({contentType:'application/json',body:'{"Key":"test"}'});});
  await page.route('**/storage/v1/object/public/archive-covers/**',route=>route.fulfill({contentType:'text/plain',body:fixture}));
  await page.goto(base+'/archive');await page.locator('[data-edit-entry]').click();
  await page.locator('[name=title]').fill('Animation test');await page.locator('[name=body]').fill('Animation first paragraph.\n\nOrdinary second paragraph.');
  await page.locator('[name=cover]').setInputFiles({name:'animation.html',mimeType:'text/html',buffer:Buffer.from(fixture)});
  const selected=page.locator('.archive-cover-selection archive-animation');await selected.scrollIntoViewIfNeeded();
  await page.frameLocator('.archive-cover-selection iframe').locator('body[data-running=yes][data-parent-blocked=yes][data-storage-blocked=yes][data-network-blocked=yes]').waitFor();
  assert.equal(await page.locator('body').getAttribute('data-escaped'),null);
  await page.locator('[data-preview]').click();await page.frameLocator('.archive-preview iframe').locator('body[data-running=yes]').waitFor();
  await page.locator('[data-publish]').click();await page.locator('.archive-editor').waitFor({state:'hidden'});
  assert.equal(uploads,1);assert.ok(entry.cover_path.endsWith('.html'));
  await page.locator('.archive-cover archive-animation').scrollIntoViewIfNeeded();await page.frameLocator('.archive-cover iframe').locator('body[data-running=yes]').waitFor();
  await page.goto(base+'/archive/entry?id='+entry.id);
  await page.frameLocator('.archive-article iframe').locator('body[data-running=yes]').waitFor();
  await page.locator('archive-animation button').click();assert.equal(await page.locator('archive-animation iframe').getAttribute('srcdoc'),null);
  await page.locator('archive-animation button').click();await page.frameLocator('.archive-article iframe').locator('body[data-running=yes]').waitFor();
  await page.screenshot({path:`/tmp/archive-animation-${width}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.locator('archive-animation').waitFor();assert.equal(await page.locator('archive-animation iframe').getAttribute('srcdoc'),null);
  await page.locator('archive-animation button').click();await page.frameLocator('.archive-article iframe').locator('body[data-running=yes]').waitFor();
  await page.locator('[data-edit-entry]').click();assert.equal(await page.locator('[name=title]').inputValue(),'Animation test');
  await page.locator('[name=remove_cover]').check();await page.locator('[data-publish]').click();await page.locator('.archive-editor').waitFor({state:'hidden'});assert.equal(entry.cover_path,null);
  await page.close();
 }
 console.log('PASS: HTML upload, preview, publish, feed, reader, editing/removal, playback, reduced motion, mobile, and sandbox isolation under production CSP.');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
