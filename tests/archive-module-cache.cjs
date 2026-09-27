const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const shared=fs.readFileSync('dist/assets/archive-common.js');
const version=crypto.createHash('sha256').update(shared).digest('hex').slice(0,12);
for(const name of ['archive-feed','archive-entry','archive-editor']){
 assert.ok(fs.readFileSync(`dist/assets/${name}.js`,'utf8').includes(`./archive-common.js?v=${version}`),'All archive modules must use the same versioned dependency');
}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
 const page=await browser.newPage();const errors=[];let staleRequests=0;
 page.on('pageerror',e=>errors.push(e.message));
 // Simulate a browser retaining the shared module from before attachment support.
 await page.route('**/assets/archive-common.js',route=>{staleRequests++;return route.fulfill({contentType:'application/javascript',body:'export const outdated = true;'});});
 await page.goto('http://127.0.0.1:52934/archive');
 await page.locator('[data-dynamic-entries] .feed-title a').first().waitFor();
 const entries=await page.locator('[data-dynamic-entries] .feed-title a').evaluateAll(nodes=>nodes.map(a=>({url:a.href,title:a.textContent})));
 for(const entry of entries){await page.goto(entry.url);await page.locator('.archive-article h1').waitFor();assert.equal(await page.locator('.archive-article h1').textContent(),entry.title);}
 assert.equal(staleRequests,0,'Old unversioned modules must not be requested');assert.deepEqual(errors,[]);
 console.log(`PASS: ${entries.length} existing posts load and open despite a stale shared-module cache; no JavaScript errors.`);
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
