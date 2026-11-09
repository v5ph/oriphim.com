const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
// A current page paired with an out-of-date shared script must recover on its own, and if it cannot, say so.
const stale='export const outdated = true;';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
 const pages=[['/archive',page=>page.locator('[data-dynamic-entries] .feed-title a').first().waitFor()],
  ['/archive/entry?id=4dd49d8b-8ae9-48b0-a7e1-4ad0397504b9',page=>page.locator('.archive-article h1').waitFor()]];
 for(const [path,loaded] of pages){
  // 1. Only the first copy is stale (as with a cache that is refreshed once): the page fetches fresh scripts and reloads.
  {const page=await browser.newPage();let served=0,navigations=0;
   page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
   await page.route('**/assets/archive-common.js*',route=>{if(served++===0)return route.fulfill({contentType:'application/javascript',body:stale});return route.continue();});
   await page.goto('http://127.0.0.1:52934'+path);await loaded(page);
   assert.equal(navigations,2,path+': one automatic reload');await page.close();}
  // 2. Every copy is stale: one reload at most, then a message instead of an empty archive.
  {const page=await browser.newPage();let navigations=0;
   page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
   await page.route('**/assets/archive-common.js*',route=>route.fulfill({contentType:'application/javascript',body:stale}));
   await page.goto('http://127.0.0.1:52934'+path);
   await page.getByText('The archive didn’t load').waitFor();
   await page.waitForTimeout(1500);
   assert.equal(navigations,2,path+': no reload loop');
   assert.equal(await page.locator('[data-feed-empty]:visible').count(),0,path+': the "nothing here" line must not show');await page.close();}
 }
 console.log('PASS: a stale shared script is refreshed once automatically; if that fails the page says so, with no reload loop.');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
