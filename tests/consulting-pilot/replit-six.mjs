import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const site = new URL(process.env.PILOT_ORIGIN);
if (site.protocol !== 'https:' || !site.hostname.endsWith('.replit.dev')) throw Error('Development Replit URL required');
const origin = site.origin;
const base = '/api/consulting-pilot';
const evidence = process.env.PILOT_EVIDENCE;
const fixtureFile = process.env.PILOT_FIXTURE;
const roleNames = ['payant','non-payant'];
const ids = process.env.PILOT_YOUTUBE_IDS?.split(',') ?? [];
assert.equal(ids.length, 6, 'Provide the six expected video identifiers');
const browser = await chromium.launch({channel:'chrome', headless:true,args:['--disable-background-networking']});
let accounts;
try {
  if(evidence) await mkdir(evidence,{recursive:true});
  try {accounts=JSON.parse(await readFile(fixtureFile,'utf8'))} catch (e) {
    if(e.code!=='ENOENT') throw e;
    accounts = roleNames.map(role=>({role, email:'qa-course-'+randomUUID()+'@example.invalid',password:randomUUID()+'Aa!9',created:false}));
    await writeFile(fixtureFile,JSON.stringify(accounts),{flag:'wx',mode:0o600});
  }
  for (const account of accounts.filter(a=>!a.created)) {
    if(process.env.PILOT_ACCEPT_TEST_TERMS !== 'yes') throw Error('Test-account agreement required');
    const ctx=await browser.newContext({baseURL:origin});
    const res=await ctx.request.post('/api/auth/register',{data:{email:account.email,password:account.password,businessName:'Formation fictive '+account.role,firstName:'Test',lastName:'Formation',acceptedLegal:true}});
    assert.equal(res.status(),201,'registration '+account.role+' '+res.status());
    account.created=true;
    await writeFile(fixtureFile,JSON.stringify(accounts),{mode:0o600});
    await ctx.close();
  }
  async function open(account, mobile) {
    const context = await browser.newContext({baseURL:origin,locale:'fr-FR',viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
    await context.route('**/*',route=> new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page=await context.newPage();
    page.setDefaultTimeout(90000);
    console.log('Connexion '+account.role+' '+(mobile?'mobile':'PC'));
    await page.goto('/auth',{waitUntil:'commit'});
    await page.getByTestId('input-email').fill(account.email);
    await page.getByTestId('input-password').fill(account.password);
    const logged=page.waitForResponse(r=>r.url().endsWith('/api/auth/login') && r.request().method()==='POST');
    await page.getByTestId('button-auth-submit').click();
    assert.equal((await logged).status(),200,'login '+account.role);
    await page.waitForURL(u=>u.pathname!=='/auth');
    if(mobile) await page.getByTestId('bottom-nav-more').click();
    const menu = page.getByRole('link',{name:'Mes formations',exact:true}).filter({visible:true});
    await menu.click();
    await page.getByRole('heading',{name:'Lavage de robe de soirée et de veste'}).waitFor();
    assert.equal(await page.locator('main ol li').count(),6);
    return {page,context};
  }
  const initial=await open(accounts[0],false);
  const start=initial.page.getByRole('button',{name:'Simuler un paiement Mobile Money'});
  if(await start.isVisible()) {
    await start.click();
    const pay=initial.page.getByRole('button',{name:'Confirmer les 100 FCFA fictifs'});
    await pay.waitFor();
    assert.equal((await initial.context.request.get(base+'/modules/prelavage',{maxRedirects:0})).status(),403);
    const done=initial.page.waitForResponse(r=>r.url().endsWith('/simulate'));
    await pay.click();assert.equal((await done).status(),204);
    console.log('PASS simulation pawaPay de 100 FCFA et verrouillage pendant attente');
  }
  await initial.page.close();await initial.context.close();
  for(const mobile of [false,true]) for (const account of accounts) {
    const {page,context}=await open(account,mobile);
    const purchased=account.role==='payant';
    const state=await (await context.request.get(base)).json();
    assert.equal(state.amount,100);
    assert.equal(state.status,purchased?'COMPLETED':'UNPAID');
    assert.equal(await page.locator('ol a').count(),purchased?6:0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    for(const [i,m] of state.modules.entries()){
      const res=await context.request.get(base+'/modules/'+m.id,{maxRedirects:0});
      assert.equal(res.status(),purchased?303:403);
      if(purchased) assert.equal(res.headers().location,'https://www.youtube.com/watch?v='+ids[i]);
    }
    const screen=(mobile?'mobile':'pc')+'-'+account.role;
    if(evidence) await page.screenshot({path:evidence+'/'+screen+'.png',fullPage:true});
    console.log('PASS '+screen+' reconnexion, menu et six droits vérifiés');
    await context.close();
  }
} finally {await browser.close()}
