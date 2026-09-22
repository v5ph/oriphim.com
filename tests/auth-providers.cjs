const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
  for(const width of [1272,390]) {
   const page=await browser.newPage({viewport:{width,height:850}});
   await page.goto('http://127.0.0.1:52934/archive');
   await page.locator('.signin-btn').click();
   await page.evaluate(()=>{
    const original=window.sb.auth.signInWithOAuth.bind(window.sb.auth);
    window.oauthCalls=[];
    window.sb.auth.signInWithOAuth=async args=>{
     window.oauthCalls.push(args);
     const result=await original({...args,options:{...args.options,skipBrowserRedirect:true}});
     window.oauthURL=result.data.url;
     return {error:new Error('Test: provider redirect intercepted')};
    };
   });
   for(const mode of ['sign-in','sign-up']){
    if(mode==='sign-up')await page.locator('[data-auth-switch]').click();
    for(const provider of ['github','google']){
     await page.locator(`[data-auth-provider=${provider}]`).click();
     await page.getByText('Test: provider redirect intercepted').waitFor();
     const {calls,url}=await page.evaluate(()=>({calls:window.oauthCalls,url:window.oauthURL}));
     assert.equal(calls.at(-1).provider,provider);
     assert.equal(calls.at(-1).options.redirectTo,'http://127.0.0.1:52934/archive');
     const authURL=new URL(url);
     assert.equal(authURL.searchParams.get('provider'),provider);
     assert.ok(authURL.searchParams.get('code_challenge'),'PKCE challenge required');
     assert.equal(await page.locator(`[data-auth-provider=${provider}]`).isEnabled(),true);
    }
   }
   await page.screenshot({path:`/tmp/auth-providers-${width}.png`});
   await page.goto('http://127.0.0.1:52934/company#error=access_denied&error_description=Cancelled');
   await page.getByText('Sign-in wasn’t completed. Please try again.').waitFor();
   assert.equal(new URL(page.url()).hash,'');
   await page.close();
  }
  console.log('PASS: GitHub/Google in both popup modes, desktop/mobile, PKCE, return page, retry and cancellation.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
