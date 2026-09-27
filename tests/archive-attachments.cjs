const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base='http://127.0.0.1:52934',owner='b1363f93-72fa-440c-897b-22e0fedb442f';
function pdfFixture(){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>','<< /Length 41 >>\nstream\nBT /F1 18 Tf 30 240 Td (Archive PDF) Tj ET\nendstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let out='%PDF-1.4\n',offsets=[0];objects.forEach((value,i)=>{offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${value}\nendobj\n`;});const xref=Buffer.byteLength(out);out+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(out);
}
const pdf=pdfFixture(),zip=Buffer.concat([Buffer.from('504b0506','hex'),Buffer.alloc(18)]);
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{for(const width of [1272,390]){
 const page=await browser.newPage({viewport:{width,height:850}});page.setDefaultTimeout(15000);
 let entry=null,uploads=[],failZip=true,isOwner=true;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const policy=fs.readFileSync('_headers','utf8').match(/Content-Security-Policy: (.*)/)[1];
 await page.route('**/archive*',async route=>{if(route.request().resourceType()!=='document'||!route.request().url().startsWith(base))return route.continue();const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'content-security-policy':policy}});});
 await page.route('**/assets/oriphim-supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync('assets/oriphim-supabase.js','utf8')+`\nwindow.sb.auth.getUser=async()=>({data:{user:{id:'${owner}',user_metadata:{oriphim_waitlist:{joined:true}}}},error:null});`}));
 await page.route('**/rest/v1/archive_editors*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(isOwner?{user_id:owner}:null)}));
 await page.route('**/rest/v1/archive_entries*',route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.method()==='POST')entry={...req.postDataJSON(),entry_number:3,created_at:'2026-09-26T12:00:00Z',updated_at:'2026-09-26T12:00:00Z'};
  if(req.method()==='PATCH')entry={...entry,...req.postDataJSON()};
  return route.fulfill({contentType:'application/json',body:JSON.stringify(req.method()!=='GET'||url.searchParams.has('id')?entry:entry?[entry]:[])});
 });
 await page.route('**/storage/v1/object/archive-attachments/**',route=>{
  const url=route.request().url();if(url.endsWith('.zip')&&failZip)return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Unavailable"}'});
  uploads.push(url);return route.fulfill({contentType:'application/json',body:'{"Key":"test"}'});
 });
 await page.route('**/storage/v1/object/public/archive-attachments/**',route=>route.fulfill({contentType:route.request().url().includes('.pdf')?'application/pdf':'application/zip',body:route.request().url().includes('.pdf')?pdf:zip}));
 await page.goto(base+'/archive');await page.locator('[data-edit-entry]').click();
 await page.locator('[name=title]').fill('Attached research');await page.locator('[name=body]').fill('Research with supporting files.');
 await page.locator('[name=attachments]').setInputFiles({name:'fake.pdf',mimeType:'application/pdf',buffer:Buffer.from('<html>Not a PDF</html>')});await page.getByText('That file does not appear to be a valid PDF.').waitFor();
 await page.locator('[name=attachments]').setInputFiles([{name:'paper.pdf',mimeType:'application/pdf',buffer:pdf},{name:'data.zip',mimeType:'application/zip',buffer:zip}]);
 await page.getByRole('button',{name:'Remove data.zip',exact:true}).waitFor();
 await page.locator('[data-preview]').click();await page.locator('.archive-preview').getByRole('link',{name:'Open PDF'}).waitFor();
 assert.ok((await page.locator('.archive-preview').getByRole('link',{name:'Open PDF'}).getAttribute('href')).startsWith('blob:'));
 assert.equal(await page.locator('.archive-preview iframe').count(),0);
 assert.equal(await page.locator('.archive-preview .archive-attachment').count(),2);
 await page.locator('[data-publish]').press('Enter');await page.getByText('Attachment upload failed. Your post and selected files are still here; please try again.').waitFor();assert.equal(entry,null);
 assert.equal(await page.locator('.archive-attachment-list li').count(),2);
 failZip=false;await page.locator('[data-publish]').press('Enter');await page.locator('.archive-editor').waitFor({state:'hidden'});
 assert.equal(uploads.filter(u=>u.endsWith('.pdf')).length,1,'Do not reupload a successful file when retrying another');assert.equal(entry.attachments.length,2);
 await page.goto(base+'/archive/entry?id='+entry.id);await page.getByRole('link',{name:'Open PDF'}).waitFor();
 assert.equal(await page.locator('.archive-attachment').count(),2);
 assert.ok((await page.getByRole('link',{name:'Download ZIP'}).getAttribute('href')).includes('download=data.zip'));
 assert.ok((await page.getByRole('link',{name:'Open PDF'}).getAttribute('href')).endsWith('.pdf'));
 assert.equal(await page.getByRole('link',{name:'Open PDF'}).getAttribute('target'),'_blank');
 assert.equal(await page.locator('.archive-attachments iframe').count(),0);
 await page.locator('.archive-attachments').scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/archive-attachments-${width}.png`});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('[data-edit-entry]').click();await page.getByRole('button',{name:'Remove data.zip',exact:true}).click();await page.locator('[data-publish]').press('Enter');await page.locator('.archive-editor').waitFor({state:'hidden'});assert.equal(entry.attachments.length,1);
 isOwner=false;await page.reload();await page.getByRole('link',{name:'Open PDF'}).waitFor();assert.equal(await page.locator('[data-edit-entry]').isVisible(),false);assert.deepEqual(errors,[]);await page.close();
}console.log('PASS: PDF/ZIP validation, local preview, partial-upload retry, publishing, direct PDF/download links, removal, permissions UI, desktop/mobile and production CSP.');}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
