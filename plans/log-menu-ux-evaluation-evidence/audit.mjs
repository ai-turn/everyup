import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const tempTools = path.join(process.env.TEMP, 'everyup-ux-audit-tools/node_modules');
const { chromium } = await import(pathToFileURL(path.join(tempTools, 'playwright/index.mjs')));
const axePath = path.join(tempTools, 'axe-core/axe.min.js');
const phase = process.argv.find(x => x.startsWith('--phase='))?.split('=')[1] ?? 'matrix';
const demo = 'http://127.0.0.1:5197/everyup/demo/';
const http = 'http://127.0.0.1:5198/';
const service = 'observed_mock_checkout';
const detail = `logs/${service}?range=24h`;
const records = [], checks = [], errors = [];
const browser = await chromium.launch({ headless: true });
await fs.mkdir(path.join(dir, 'captures'), { recursive: true });
const startedAt = new Date().toISOString();
function check(id, passed, detail = {}) { checks.push({ id, passed, ...detail }); }
async function stage(id, run) {
  if(phase==='boundary' && !id.startsWith('boundary-'))return;
  try { await run(); console.log(JSON.stringify({stage: id, result: 'completed'})); }
  catch (e) { errors.push({id, error: String(e), stack: e.stack}); console.log(JSON.stringify({stage: id, error: String(e)})); }
}
async function context(width = 1440, theme = 'light', scenario = 'attention') {
  const ctx = await browser.newContext({ viewport: {width, height: width < 600 ? 844 : 900}, colorScheme: theme,
    locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'reduce' });
  await ctx.addInitScript(({theme, scenario}) => { localStorage.setItem('theme', localStorage.getItem('audit_theme_override') || theme); sessionStorage.setItem('everyup_demo_scenario', scenario); }, {theme, scenario});
  ctx.setDefaultTimeout(7000);
  return ctx;
}
async function visit(page, route, base = demo) {
  await page.goto(base + route);
  await page.waitForTimeout(650);
  await page.evaluate(() => document.fonts.ready);
}
async function capture(page, id, note = '', axe = false) {
  const raw = await page.evaluate(() => {
    const visible = e => {const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';};
    const root = document.querySelector('dialog[open]') ?? document.querySelector('main');
    return { time: new Date().toISOString(), url: location.href, title: document.title, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      scenario: sessionStorage.getItem('everyup_demo_scenario'), viewport: {width: innerWidth, height: innerHeight}, documentWidth: document.documentElement.scrollWidth,
      mainWidth: document.querySelector('main')?.scrollWidth, text: root?.innerText,
      controls: [...(root?.querySelectorAll('button,input,select,[role="button"],summary,a') ?? [])].filter(visible).map(e => {
        const r = e.getBoundingClientRect(), s = getComputedStyle(e);
        return {tag: e.tagName, role: e.getAttribute('role'), label: e.getAttribute('aria-label') || e.innerText?.trim().slice(0,160) || e.getAttribute('title') || e.getAttribute('placeholder'),
          title: e.getAttribute('title'), pressed: e.getAttribute('aria-pressed'), expanded: e.getAttribute('aria-expanded'), disabled: e.disabled ?? false,
          rect: {x:r.x,y:r.y,width:r.width,height:r.height}, fontSize:s.fontSize, color:s.color, background:s.backgroundColor}; }),
      overflows: [...(root?.querySelectorAll('*') ?? [])].filter(visible).filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0,25).map(e => ({tag:e.tagName,text:e.innerText?.slice(0,80),right:e.getBoundingClientRect().right})),
      focus: {tag:document.activeElement?.tagName, label:document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim().slice(0,100)} };
  });
  const redact = text => text.replace(/evup_(?!\*+)[A-Za-z0-9_-]+/g, 'evup_[MASKED]');
  const masks = page.locator('dialog[open] code, dialog[open] pre').filter({hasText: /evup_/});
  await page.screenshot({path:path.join(dir,'captures',`${id}.png`),fullPage:true,mask: await masks.count() ? [masks] : []});
  raw.snapshot = await page.locator('body').ariaSnapshot();
  raw.note = note;
  await fs.writeFile(path.join(dir,'captures',`${id}.json`), redact(JSON.stringify(raw,null,2))+'\n');
  if (axe) {
    await page.addScriptTag({path:axePath});
    const result = await page.evaluate(async () => {
      const result = await window.axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
      return {violations:result.violations,incomplete:result.incomplete,passes:result.passes.map(x=>x.id),testEngine:result.testEngine,testEnvironment:result.testEnvironment};
    });
    await fs.writeFile(path.join(dir,'captures',`${id}-axe.json`),redact(JSON.stringify(result,null,2))+'\n');
  }
  records.push({id,url:raw.url,theme:raw.theme,viewport:raw.viewport,note});
}
async function mainBottom(page) { await page.locator('main > div.overflow-y-auto').evaluate(e => {e.scrollTop=e.scrollHeight;}); await page.waitForTimeout(80); }
async function mainTop(page) { await page.locator('main > div.overflow-y-auto').evaluate(e=>{e.scrollTop=0;}); }
async function closeDialog(page) { await page.keyboard.press('Escape'); await page.waitForTimeout(100); if(await page.getByRole('dialog').count()) {await page.keyboard.press('Escape'); await page.waitForTimeout(100);} }
async function runMatrix() {
 for (const width of [1440,390]) for (const theme of ['light','dark']) {
  const id = `${width===1440?'desktop':'mobile'}-${theme}`;
  await stage(id, async () => {
   const ctx=await context(width,theme); const page=await ctx.newPage();
   try {
    await visit(page,'logs?view=card'); await capture(page,`${id}-list-card`,'Default attention fixture; card view.',true);
    await mainBottom(page); await capture(page,`${id}-patterns`);
    const pattern=page.locator('main section').filter({has:page.getByRole('heading',{name:'자주 발생한 오류·경고'})}).getByRole('link').first();
    await pattern.click(); await page.waitForTimeout(250);
    check(`${id}-T2-pattern`,await page.getByRole('button',{name:'같은 패턴만',exact:true}).isVisible(),{url:page.url()});
    await capture(page,`${id}-pattern-detail`);
    await page.getByRole('button',{name:'같은 패턴만',exact:true}).click();
    check(`${id}-T2-clear`,!page.url().includes('pattern='));
    await visit(page,'logs?view=grid'); await capture(page,`${id}-list-grid`);
    await page.locator('main').getByRole('link',{name:'checkout-api',exact:true}).click(); await page.waitForTimeout(250);
    check(`${id}-T1-navigation`,page.url().includes(`/logs/${service}`),{url:page.url()});
    await capture(page,`${id}-detail`,'Default detail after list navigation.',true);
    await page.getByRole('group',{name:'로그 레벨',exact:true}).getByRole('button',{name:'error',exact:true}).click();
    const search=page.getByPlaceholder('메시지 검색…'); await search.fill('timeout'); await search.press('Enter'); await page.waitForTimeout(160);
    await capture(page,`${id}-search-error`);
    check(`${id}-T3-search`,(await page.locator('main').innerText()).includes('timeout'));
    await search.fill('not-present-ui-audit-zzzz'); await search.press('Enter'); await page.waitForTimeout(140);
    await capture(page,`${id}-search-empty`);
    check(`${id}-T3-empty`,await page.getByText('조건에 맞는 로그가 없습니다',{exact:true}).isVisible());
    await page.getByRole('button',{name:'검색어 지우기'}).click();
    await page.getByRole('group',{name:'로그 레벨',exact:true}).getByRole('button',{name:'전체',exact:true}).click();
    await page.waitForTimeout(150);
    const row=page.locator('main div[role="button"][aria-expanded]').first();
    await row.click(); await capture(page,`${id}-expanded`);
    await page.getByText('원본 JSON',{exact:true}).first().click(); await capture(page,`${id}-json`);
    const attrButton=page.locator('main div[role="button"][aria-expanded="true"] button').filter({hasText:/http\.route/}).first();
    if(await attrButton.count()) { await attrButton.click(); await page.waitForTimeout(130); const chip=page.locator('main button').filter({hasText:/http\.route.*=.*auth/}).first(); check(`${id}-T5-attribute`,await chip.isVisible()); await capture(page,`${id}-attribute`); await chip.click(); await page.waitForTimeout(150); }
    const trace=page.locator('main').getByRole('button',{name:'트레이스',exact:true}).first(); await trace.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(180);
    check(`${id}-T5-trace-keyboard`,await page.getByRole('dialog',{name:'트레이스 상세'}).count()>0);
    await capture(page,`${id}-trace`,'Trace opened with Enter.',true);
    await closeDialog(page);
    check(`${id}-T5-focus-return`,await trace.evaluate(e=>e===document.activeElement));
    await mainTop(page);
    const chart=page.locator('main .recharts-wrapper').first();
    const bar=chart.locator('.recharts-bar-rectangle path').last();
    if(await bar.count()) { await bar.hover({force:true}); await page.waitForTimeout(100); await capture(page,`${id}-chart-hover`); await bar.click({force:true}); await page.waitForTimeout(120); }
    const bucketChip=page.locator('main button').filter({hasText:/\d{2}:\d{2}.*~/});
    check(`${id}-T4-bucket`,await bucketChip.count()>0);
    await capture(page,`${id}-bucket`);
    if(await bucketChip.count()) await bucketChip.click();
    await page.getByRole('button',{name:'실시간',exact:true}).click();
    check(`${id}-T6-live-on`,await page.getByRole('button',{name:'실시간',exact:true}).getAttribute('aria-pressed')==='true');
    await mainBottom(page); await page.getByRole('button',{name:'다음',exact:true}).click(); await page.waitForTimeout(150);
    check(`${id}-T6-pagination-stops-live`,await page.getByRole('button',{name:'실시간',exact:true}).getAttribute('aria-pressed')==='false');
    await capture(page,`${id}-pagination`);
    await mainTop(page);
    if(await page.getByText('서비스 정보',{exact:true}).count()) await page.getByText('서비스 정보',{exact:true}).click();
    await page.getByRole('button',{name:'변경',exact:true}).click(); await capture(page,`${id}-ingest-editor`);
    await page.getByRole('group',{name:'수집할 로그 레벨'}).getByRole('button',{name:'debug',exact:true}).click();
    await page.getByRole('button',{name:'저장',exact:true}).click(); await page.waitForTimeout(120);
    check(`${id}-T8-save-ingest`,await page.getByText('수집 레벨을 저장했습니다.',{exact:true}).isVisible());
    for(const [title,label] of [['API Key를 재발급할까요?','키 재발급'],['직접 수집 연결을 중지할까요?','연결 중지'],['직접 로그 서비스를 삭제할까요?','삭제']]) {
      await page.getByRole('button',{name:label,exact:true}).click(); await capture(page,`${id}-confirm-${label==='삭제'?'delete':label==='연결 중지'?'revoke':'rotate'}`);
      check(`${id}-T8-confirm-${label}`,await page.getByRole('dialog',{name:title,exact:true}).isVisible());
      await closeDialog(page);
    }
    await page.getByRole('button',{name:'키 재발급',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'재발급',exact:true}).click(); await page.waitForTimeout(160);
    await capture(page,`${id}-rotated`,'Demo key only. API key/configuration masked in screenshot.',true); await closeDialog(page);
    await visit(page,'logs'); await page.getByRole('button',{name:'로그 연결',exact:true}).first().click();
    await capture(page,`${id}-setup`,'New service form.',true);
    if(await page.getByRole('button',{name:'기존 서비스',exact:true}).count()) {await page.getByRole('button',{name:'기존 서비스',exact:true}).click(); await capture(page,`${id}-setup-existing`); await page.getByRole('button',{name:'새 서비스',exact:true}).click();}
    await page.getByLabel('서비스 이름',{exact:true}).fill(`ux-audit-${id}`); await page.getByRole('dialog').getByRole('button',{name:'추가',exact:true}).click(); await page.waitForTimeout(180);
    await capture(page,`${id}-setup-result`,'Demo registration only. Keys masked.',true);
    check(`${id}-T7-receipt`,(await page.getByRole('dialog').innerText()).includes('수신'));
    await page.getByRole('button',{name:'로그 보기',exact:true}).click(); await page.waitForTimeout(150);
    check(`${id}-T7-open-created`,page.url().includes('/logs/')&&!page.url().includes(service));
    await capture(page,`${id}-new-service`);
   } finally {await ctx.close();}
  });
 }
}
async function runFaults() {
 const providerCtx=await context(); const provider=await providerCtx.newPage(); await visit(provider,'logs');
 const ctx=await context(); const page=await ctx.newPage(); let mode='ok'; const requests=[];
 const fail=(route, label)=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,data:null,error:{code:'AUDIT_INJECTED',message:`평가용 ${label} 요청 실패`}})});
 await page.route('**/api/v1/**',async route=>{
  const request=route.request(), u=new URL(request.url()), p=u.pathname.replace('/api/v1',''), method=request.method();
  requests.push({time:new Date().toISOString(),mode,endpoint:p+u.search,method});
  if(mode==='loading' && p==='/observed-services') await new Promise(r=>setTimeout(r,1800));
  const failure = (mode==='list-fail'&&p==='/observed-services') || (mode==='patterns-fail'&&p==='/logs/patterns') ||
    (mode==='detail-fail'&&p===`/observed-services/${service}`) || (mode==='logs-fail'&&p.endsWith(`/${service}/logs`)) ||
    (mode==='histogram-fail'&&p.endsWith('/log-histogram')) || (mode==='filter-get-fail'&&p.endsWith('/log-filter')&&method==='GET') ||
    (mode==='filter-put-fail'&&p.endsWith('/log-filter')&&method==='PUT') || (mode==='group-fail'&&p===`/observed-services/${service}`&&method==='PUT') ||
    (mode==='options-fail'&&p==='/projects') || (mode==='create-fail'&&p==='/observed-services'&&method==='POST') ||
    (mode==='rotate-fail'&&p.endsWith('/rotate-key'));
  if(failure) return fail(route,mode);
  try {
   let data=await provider.evaluate(async({endpoint,method,body})=>{const{mockRouter}=await import('/everyup/demo/src/services/mockRouter.ts');return mockRouter(endpoint,method,body);},
     {endpoint:p+u.search,method,body:request.postData()});
   if(mode==='long') {
    const longName='checkout-production-ap-northeast-2-'.repeat(6).slice(0,200);
    if(p===`/observed-services/${service}`)data={...data,name:longName};
    if(p===`/observed-services/${service}/logs`)data={...data,data:[{...data.data[0],message:'Error: upstream request failed\n    at handleRequest (/app/dist/server.js:417:18)\nRequest URL: https://upstream.example.com/'+ 'segment'.repeat(40),metadata:{attributes:{'http.route':'/api/v1/orders/'+ 'customer-reference-'.repeat(14)},resource:{'service.name':longName}}},...data.data.slice(1)]};
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:data??null})});
  } catch(e) {await fail(route,String(e));}
 });
 try {
  if(phase==='boundary')await visit(page,detail,http);
  await stage('list-loading',async()=>{mode='loading';await visit(page,'logs?view=card',http);await capture(page,'fault-list-loading','HTTP fixture bridge: observed-services delayed by 1800ms.');await page.waitForTimeout(1500);});
  await stage('list-failure-retry',async()=>{mode='list-fail';await visit(page,'logs',http);await capture(page,'fault-list-failure');mode='ok';await page.getByRole('button',{name:'다시 시도',exact:true}).click();await page.waitForTimeout(300);check('fault-list-retry',await page.getByRole('heading',{name:'로그 서비스'}).isVisible());});
  await stage('pattern-partial-failure',async()=>{mode='patterns-fail';await visit(page,'logs',http);await mainBottom(page);await capture(page,'fault-patterns-failure');check('fault-pattern-preserves-list',await page.getByText('반복 패턴을 불러오지 못했습니다.',{exact:true}).isVisible()&&await page.getByRole('heading',{name:'로그 서비스'}).count()>0);});
  await stage('detail-failure',async()=>{mode='detail-fail';await visit(page,detail,http);await capture(page,'fault-detail-failure');});
  await stage('logs-initial-failure',async()=>{mode='logs-fail';await visit(page,detail,http);await capture(page,'fault-logs-initial-toast');await page.waitForTimeout(4500);await capture(page,'fault-logs-after-toast','Initial logs request fails; waited 4.5 seconds after initial capture.');check('fault-logs-shows-empty-copy',await page.getByText('이 기간에 수집된 로그가 없습니다',{exact:true}).isVisible());});
  await stage('logs-refresh-failure',async()=>{mode='ok';await visit(page,detail,http);const before=await page.locator('main div[role="button"][aria-expanded]').count();mode='logs-fail';await page.getByRole('button',{name:'새로고침',exact:true}).click();await page.waitForTimeout(200);await capture(page,'fault-logs-refresh-toast');await page.waitForTimeout(4500);await capture(page,'fault-logs-refresh-stale','Old data retained after refresh failure; toast expired.');check('fault-refresh-retains-old-rows',before>0&&before===await page.locator('main div[role="button"][aria-expanded]').count(),{before});});
  await stage('histogram-failure',async()=>{mode='histogram-fail';await visit(page,detail,http);await capture(page,'fault-histogram-failure');check('fault-histogram-disappears',await page.getByText('로그 발생량',{exact:true}).count()===0);});
  await stage('filter-load-failure',async()=>{mode='filter-get-fail';await visit(page,detail,http);await capture(page,'fault-ingest-load-failure');check('fault-ingest-disabled-no-retry',await page.getByRole('button',{name:'변경',exact:true}).isDisabled());});
  await stage('filter-save-failure',async()=>{mode='ok';await visit(page,detail,http);await page.getByRole('button',{name:'변경',exact:true}).click();await page.getByRole('group',{name:'수집할 로그 레벨'}).getByRole('button',{name:'debug',exact:true}).click();mode='filter-put-fail';await page.getByRole('button',{name:'저장',exact:true}).click();await page.waitForTimeout(150);await capture(page,'fault-ingest-save-failure');check('fault-ingest-preserves-draft',await page.getByRole('group',{name:'수집할 로그 레벨'}).getByRole('button',{name:'debug',exact:true}).getAttribute('aria-pressed')==='true');});
  await stage('group-save-failure',async()=>{mode='ok';await visit(page,detail,http);await page.getByRole('combobox',{name:'그룹 배정'}).click();await page.getByRole('option',{name:'미분류',exact:true}).click();mode='group-fail';await page.getByRole('button',{name:'배정 저장',exact:true}).click();await page.waitForTimeout(150);await capture(page,'fault-group-save-failure');});
  await stage('setup-options-failure',async()=>{mode='ok';await visit(page,'logs',http);mode='options-fail';await page.getByRole('button',{name:'로그 연결',exact:true}).first().click();await page.waitForTimeout(180);await capture(page,'fault-setup-options-failure');mode='ok';await page.getByRole('dialog').getByRole('button',{name:'다시 시도',exact:true}).click();await page.waitForTimeout(250);check('fault-options-retry',await page.getByRole('alert').count()===0);await closeDialog(page);});
  await stage('setup-create-failure',async()=>{mode='ok';await visit(page,'logs',http);await page.getByRole('button',{name:'로그 연결',exact:true}).first().click();await page.getByLabel('서비스 이름',{exact:true}).fill('audit-failed-create');mode='create-fail';await page.getByRole('dialog').getByRole('button',{name:'추가',exact:true}).click();await page.waitForTimeout(150);await capture(page,'fault-setup-create-failure');check('fault-create-preserves-input',await page.getByLabel('서비스 이름',{exact:true}).inputValue()==='audit-failed-create');await closeDialog(page);});
  await stage('rotate-failure',async()=>{mode='ok';await visit(page,detail,http);await page.getByRole('button',{name:'키 재발급',exact:true}).click();mode='rotate-fail';await page.getByRole('dialog').getByRole('button',{name:'재발급',exact:true}).click();await page.waitForTimeout(150);await capture(page,'fault-rotate-failure');check('fault-rotate-confirm-remains',await page.getByRole('dialog',{name:'API Key를 재발급할까요?',exact:true}).isVisible());});
  for(const [width,theme] of [[1440,'dark'],[390,'light'],[390,'dark']]) await stage(`faults-${width}-${theme}`,async()=>{
    await page.setViewportSize({width,height:width===390?844:900});await page.evaluate(theme=>localStorage.setItem('audit_theme_override',theme),theme);
    for(const [nextMode,label] of [['logs-fail','logs'],['filter-get-fail','ingest'],['histogram-fail','histogram']]) {
      mode=nextMode;await visit(page,detail,http);
      if(nextMode==='logs-fail')await page.waitForTimeout(4500);
      await capture(page,`fault-${width}-${theme}-${label}`,'Injected HTTP failure. Theme set before page reload.');
    }
  });
  for(const [width,theme] of [[1440,'light'],[1440,'dark'],[390,'light'],[390,'dark']])await stage(`boundary-${width}-${theme}`,async()=>{
    mode='long';await page.setViewportSize({width,height:width===390?844:900});await page.evaluate(theme=>localStorage.setItem('audit_theme_override',theme),theme);
    await visit(page,detail,http);await capture(page,`boundary-${width}-${theme}-long-header`,'Injected 200-character service name and long log/attribute values.');
    const row=page.locator('main div[role="button"][aria-expanded]').first();await row.click();await page.getByText('Attributes',{exact:true}).first().scrollIntoViewIfNeeded();await capture(page,`boundary-${width}-${theme}-long-attribute`);
  });
 }finally{await fs.writeFile(path.join(dir,`${phase}-requests.json`),JSON.stringify(requests,null,2)+'\n');await ctx.close();await providerCtx.close();}
}
async function runSupplement() {
 for(const width of [1440,390]) for(const theme of ['light','dark']) await stage(`supplement-${width}-${theme}`,async()=>{
  const ctx=await context(width,theme);const page=await ctx.newPage();const id=`supp-${width}-${theme}`;
  try{
   await visit(page,'logs?view=card');await mainBottom(page);await capture(page,`${id}-patterns-bottom`,'Scrolled the actual content scroll container.');
   await visit(page,detail);
   const positions=await page.evaluate(()=>({firstLog:document.querySelector('main div[role="button"][aria-expanded]')?.getBoundingClientRect().top,chart:[...document.querySelectorAll('h3,h2')].find(e=>e.textContent==='로그 발생량')?.getBoundingClientRect().top,main:document.querySelector('main').getBoundingClientRect().toJSON()}));
   check(`${id}-initial-positions`,true,{positions});
   const search=page.getByPlaceholder('메시지 검색…');await search.fill('audit-nonexistent-zzzz');await page.waitForTimeout(600);
   const rowsBefore=await page.locator('main div[role="button"][aria-expanded]').count();await capture(page,`${id}-search-before-enter`,'Typed and waited 600ms without Enter.');
   await search.press('Enter');await page.waitForTimeout(150);check(`${id}-search-requires-enter`,rowsBefore>0&&await page.getByText('조건에 맞는 로그가 없습니다',{exact:true}).isVisible(),{rowsBefore});
   await page.getByRole('button',{name:'검색어 지우기'}).click();await page.getByRole('button',{name:'1H',exact:true}).click();await page.waitForTimeout(150);
   check(`${id}-time-range`,await page.getByRole('button',{name:'1H',exact:true}).getAttribute('aria-pressed')==='true',{url:page.url()});
   await capture(page,`${id}-range-1h`);
   await page.getByRole('button',{name:'24H',exact:true}).click();await page.waitForTimeout(120);
   const chart=page.locator('main .recharts-surface[role="application"]').first();
   await chart.focus();for(let i=0;i<5;i++){await page.keyboard.press('ArrowRight');await page.waitForTimeout(80);}await page.keyboard.press('Enter');await page.waitForTimeout(180);
   const bucket=page.locator('main button').filter({hasText:/\d{2}:\d{2}.*~/});check(`${id}-chart-keyboard`,await bucket.count()>0);await capture(page,`${id}-chart-keyboard`);
   if(await bucket.count())await bucket.click();
   const row=page.locator('main div[role="button"][aria-expanded]').first();await row.click();await page.getByText('원본 JSON',{exact:true}).first().click();
   await page.getByText('원본 JSON',{exact:true}).first().scrollIntoViewIfNeeded();await capture(page,`${id}-json-scrolled`);
   await mainBottom(page);await capture(page,`${id}-pagination-bottom`);
   await visit(page,'logs');await page.getByRole('button',{name:'로그 연결',exact:true}).first().click();await page.getByRole('button',{name:'기존 서비스',exact:true}).click();
   await page.getByRole('dialog').getByRole('combobox').first().click();const option=page.getByRole('option').filter({hasNotText:'서비스 선택'}).first();await option.click();
   await page.getByRole('dialog').getByRole('button',{name:'추가',exact:true}).click();await page.waitForTimeout(150);await capture(page,`${id}-existing-attached`);check(`${id}-existing-attach`,(await page.getByRole('dialog').innerText()).includes('기존 API Key'));
  }finally{await ctx.close();}
 });
 for(const width of [1440,390]) for(const scenario of ['normal','empty','partial-failure']) await stage(`scenario-${width}-${scenario}`,async()=>{
  const ctx=await context(width,'light',scenario);const page=await ctx.newPage();try{await visit(page,'logs?view=card');await capture(page,`scenario-${width}-${scenario}`,'Scenario fixture selected through session storage at startup.');}finally{await ctx.close();}
 });
 for(const width of [320,390]) await stage(`reflow-${width}`,async()=>{
  const ctx=await context(width);const page=await ctx.newPage();try{
   if(width===390)await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const style=document.createElement('style');style.textContent='html { font-size: 200% !important; }';document.head.append(style);}));
   const id=width===320?'narrow-320':'text-200';await visit(page,'logs?view=grid');await capture(page,`${id}-list`,'390px uses CSS root-font-size 200% simulation, not browser zoom.');
   await visit(page,detail);await capture(page,`${id}-detail`);const row=page.locator('main div[role="button"][aria-expanded]').first();await row.click();await page.getByText('원본 JSON',{exact:true}).first().click();await page.getByText('원본 JSON',{exact:true}).first().scrollIntoViewIfNeeded();await capture(page,`${id}-json`);
   await visit(page,'logs');await page.getByRole('button',{name:'로그 연결',exact:true}).first().click();await capture(page,`${id}-setup`);
  }finally{await ctx.close();}
 });
}
try {
 if(phase==='matrix') await runMatrix();
 if(phase==='faults') await runFaults();
 if(phase==='boundary') await runFaults();
 if(phase==='supplement') await runSupplement();
} finally {
 await fs.writeFile(path.join(dir,`${phase}.json`),JSON.stringify({phase,startedAt,finishedAt:new Date().toISOString(),browser:browser.version(),records,checks,errors},null,2)+'\n');
 await browser.close();
 console.log(JSON.stringify({phase,captures:records.length,checks:checks.length,failed:checks.filter(x=>!x.passed),errors:errors.map(x=>({id:x.id,error:x.error}))}));
}
