import { expect,test,type Browser,type Page } from "@playwright/test";
import type { LetterView,LetterAction } from "../../src/lib/games/letter-network/service";
const origin="http://127.0.0.1:3000";
const read=async(page:Page,id:string):Promise<LetterView>=>{
  const response=await page.request.get("/api/letter-network/"+id);
  expect(response.status(),await response.text()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  return response.json();
};
async function command(page:Page,id:string,action:LetterAction){
  const view=await read(page,id);
  const response=await page.request.post("/api/letter-network/"+id+"/commands",{headers:{Origin:origin},data:{key:crypto.randomUUID(),expectedVersion:view.version,action}});
  expect(response.status(),await response.text()).toBe(200);return (await response.json()).session as LetterView;
}
async function setup(page:Page,start=true){
  await page.goto("/register");await page.getByLabel("الاسم").fill("مضيف الحروف");
  await page.getByLabel("البريد الإلكتروني").fill("letters-"+Date.now()+"-"+Math.random().toString(36).slice(2)+"@example.test");
  await page.getByLabel("كلمة المرور").fill("letters-password-123456");await page.getByRole("button",{name:"إنشاء الحساب"}).click();
  await expect(page).toHaveURL(/\/games$/);await page.goto("/games/letter-network/new");
  await page.getByLabel("اسم الفريق أ · البرتقالي").fill("فريق ياقوت");await page.getByLabel("اسم الفريق ب · السماوي").fill("فريق ألف");
  await page.getByRole("button",{name:"أنشئ المباراة"}).click();await expect(page).toHaveURL(/\/letter-network\/host\/[^/]+$/);
  const id=new URL(page.url()).pathname.split("/").at(-1)!;
  await expect(page.locator(".letter-page")).toHaveAttribute("data-live-ready","true");
  if(start){await page.getByRole("button",{name:"ابدأ اللعبة"}).click();await expect(page.locator(".letter-board button")).toHaveCount(25);}
  return id;
}
async function display(page:Page,browser:Browser,id:string){
  const response=await page.request.post("/api/letter-network/"+id+"/display-access",{headers:{Origin:origin}});
  expect(response.status()).toBe(200);const access=await response.json();
  const context=await browser.newContext(),tv=await context.newPage();await tv.goto(access.url);
  await expect(tv.locator(".letter-board [data-cell]")).toHaveCount(25);
  const token=new URL(access.url,origin).searchParams.get("token")!;
  return {tv,context,token,url:access.url as string};
}
async function open(page:Page,id:string,cellId:string){
  await command(page,id,{type:"SELECT_CELL",cellId});return command(page,id,{type:"OPEN_QUESTION"});
}
test("Letter Network: setup and correct capture synchronize Host and read-only TV",async({page,browser})=>{
  test.skip(!process.env.E2E_DATABASE_URL);const id=await setup(page),{tv,context}=await display(page,browser,id);
  try{
    const view=await read(page,id);expect(view.teams.map(t=>[t.name,t.position])).toEqual([["فريق ياقوت",0],["فريق ألف",1]]);
    await page.reload();await expect(page.locator(".letter-page")).toHaveAttribute("data-live-ready","true");
    await page.locator('[data-cell="r0c0"]').click();await expect(page.getByRole("button",{name:"افتح السؤال"})).toBeVisible();
    await page.getByRole("button",{name:"افتح السؤال"}).click();await expect(page.getByRole("button",{name:"إجابة صحيحة"})).toBeVisible();
    await expect(tv.locator(".letter-tv-stage h1")).toContainText((await read(page,id)).question!.text);
    await page.getByRole("button",{name:"إجابة صحيحة"}).click();
    await expect(page.locator('[data-cell="r0c0"]')).toHaveAttribute("data-owner","0");
    await expect(tv.locator('[data-cell="r0c0"]')).toHaveAttribute("data-owner","0");
    expect(await tv.locator(".letter-board button").count()).toBe(0);
  }finally{await context.close();}
});
test("Letter Network: wrong answer gives opposing steal and opponent captures",async({page,browser})=>{
  test.skip(!process.env.E2E_DATABASE_URL);const id=await setup(page),{tv,context}=await display(page,browser,id);
  try{await open(page,id,"r1c1");await command(page,id,{type:"WRONG"});
    await expect(page.getByRole("button",{name:"اقتناص صحيح"})).toBeVisible();
    await expect(tv.locator(".letter-tv-stage")).toContainText("فرصة الاقتناص · فريق ألف");
    const next=await command(page,id,{type:"STEAL_CORRECT"});expect(next.board.find(c=>c.cellId==="r1c1")?.ownerTeamId).toBe(next.teams[1].id);
    await expect(tv.locator('[data-cell="r1c1"]')).toHaveAttribute("data-owner","1");
  }finally{await context.close();}
});
test("Letter Network: actual Team A path wins, Undo reopens winning move, rematch is clean",async({page,browser})=>{
  test.skip(!process.env.E2E_DATABASE_URL);const id=await setup(page),{tv,context}=await display(page,browser,id);
  try{
    const before=await read(page,id);
    for(let col=0;col<5;col++){
      await open(page,id,"r2c"+col);await command(page,id,{type:"CORRECT"});
      if(col<4){await open(page,id,"r4c"+col);await command(page,id,{type:"CORRECT"});}
    }
    const won=await read(page,id);expect(won.phase).toBe("RESULTS");expect(won.winningPath).toEqual(["r2c0","r2c1","r2c2","r2c3","r2c4"]);
    await expect(tv.getByRole("heading",{name:"فاز فريق ياقوت!"})).toBeVisible();
    await expect(tv.locator('[data-winning="true"]')).toHaveCount(5);
    await page.reload();await expect(page.locator(".letter-page")).toHaveAttribute("data-live-ready","true");
    await expect(page.getByRole("heading",{name:"فاز فريق ياقوت!"})).toBeVisible();
    await page.getByRole("button",{name:"تراجع عن آخر حكم"}).click();
    await expect(page.getByRole("button",{name:"إجابة صحيحة"})).toBeVisible();
    const undone=await read(page,id);expect(undone).toMatchObject({phase:"QUESTION_ACTIVE",winnerTeamId:null,winningPath:[]});
    await expect(tv.locator('[data-winning="true"]')).toHaveCount(0);
    await command(page,id,{type:"CORRECT"});await command(page,id,{type:"COMPLETE"});const rematch=await command(page,id,{type:"REMATCH"});
    expect(rematch.matchNumber).toBe(2);expect(rematch.board.every(c=>c.ownerTeamId===null)).toBe(true);
    expect(rematch.board.map(c=>c.letter)).not.toEqual(before.board.map(c=>c.letter));
    expect(rematch.teams.map(t=>[t.id,t.name,t.position])).toEqual(before.teams.map(t=>[t.id,t.name,t.position]));
    expect(rematch).toMatchObject({phase:"READY",winnerTeamId:null,winningPath:[],lastAnswer:null,canUndo:false});
  }finally{await context.close();}
});
test("Letter Network: pause, refresh and resume preserve answer and steal timer",async({page})=>{
  test.skip(!process.env.E2E_DATABASE_URL);const id=await setup(page);await open(page,id,"r0c1");
  await page.waitForTimeout(1200);const stopped=await command(page,id,{type:"PAUSE"});expect(stopped.remainingMs).toBeGreaterThan(25_000);
  await page.waitForTimeout(2200);await page.reload();expect((await read(page,id)).remainingMs).toBe(stopped.remainingMs);
  const resumed=await command(page,id,{type:"RESUME"});
  expect(new Date(resumed.deadlineAt!).getTime()-new Date(resumed.serverNow).getTime()).toBeGreaterThan(stopped.remainingMs-500);
  const steal=await command(page,id,{type:"WRONG"});expect(steal.answeringTeamId).toBe(steal.teams[1].id);
  const pausedSteal=await command(page,id,{type:"PAUSE"});await page.waitForTimeout(1000);
  const restored=await command(page,id,{type:"RESUME"});expect(restored.phase).toBe("STEAL");expect(restored.question?.id).toBe(steal.question?.id);
  expect(new Date(restored.deadlineAt!).getTime()-new Date(restored.serverNow).getTime()).toBeGreaterThan(pausedSteal.remainingMs-500);
  await command(page,id,{type:"STEAL_WRONG"});const replacement=await open(page,id,"r0c1");expect(replacement.question?.id).not.toBe(restored.question?.id);
});
test("Letter Network: TV JSON, SSE and HTML omit answers even after host-only reveal",async({page,browser})=>{
  test.skip(!process.env.E2E_DATABASE_URL);const id=await setup(page),{tv,context,token,url}=await display(page,browser,id);
  try{
    await open(page,id,"r0c2");const revealed=await command(page,id,{type:"REVEAL_ANSWER"});const answer=revealed.question!.answer!;
    const endpoint="/api/letter-network/"+id+"/display?token="+token;
    const check=async()=>{const publicView=await (await context.request.get(endpoint)).json();expect(publicView.question).not.toHaveProperty("answer");expect(publicView.question).not.toHaveProperty("alternativeAnswers");expect(publicView).not.toHaveProperty("history");return publicView;};
    const publicView=await check();await tv.reload();expect(await tv.locator("body").innerText()).not.toContain("للمضيف فقط");
    const response=await context.request.get(url);expect(await response.text()).not.toContain('"answer":');
    const event=await tv.evaluate(async({id,token})=>new Promise<Record<string,unknown>>((resolve,reject)=>{
      const stream=new EventSource("/api/letter-network/"+id+"/events?audience=display&token="+token);
      const timeout=setTimeout(()=>{stream.close();reject(new Error("SSE timeout"));},8000);
      stream.addEventListener("state",event=>{clearTimeout(timeout);stream.close();resolve(JSON.parse((event as MessageEvent).data));});
      stream.onerror=()=>{clearTimeout(timeout);stream.close();reject(new Error("SSE unavailable"));};
    }),{id,token});
    expect(event.question).not.toHaveProperty("answer");expect(JSON.stringify(event)).not.toContain('"alternativeAnswers"');
    expect(publicView.question.text).toBe(revealed.question!.text);expect(answer.length).toBeGreaterThan(0);
    await command(page,id,{type:"WRONG"});await check();
    expect((await context.request.post("/api/letter-network/"+id+"/commands?token="+token,{headers:{Origin:origin},data:{key:crypto.randomUUID(),expectedVersion:0,action:{type:"CORRECT"}}})).status()).toBe(403);
    expect((await context.request.get("/api/letter-network/"+id)).status()).toBe(403);
  }finally{await context.close();}
});
test("Letter Network: concurrent selections, duplicate correct and correct/wrong race serialize",async({page})=>{
  test.skip(!process.env.E2E_DATABASE_URL);const id=await setup(page);
  const race=async(actions:LetterAction[],sameKey=false)=>{
    const version=(await read(page,id)).version,key=crypto.randomUUID();
    const results=await Promise.all(actions.map(action=>page.request.post("/api/letter-network/"+id+"/commands",{headers:{Origin:origin},data:{key:sameKey?key:crypto.randomUUID(),expectedVersion:version,action}}).then(async r=>({status:r.status(),body:await r.json()}))));
    return {results,version,after:await read(page,id)};
  };
  const selected=await race([{type:"SELECT_CELL",cellId:"r0c0"},{type:"SELECT_CELL",cellId:"r0c1"}]);
  expect(selected.results.map(r=>r.status).sort()).toEqual([200,409]);expect(selected.after.version).toBe(selected.version+1);expect(selected.after.board.filter(c=>c.state==="ACTIVE")).toHaveLength(1);
  await command(page,id,{type:"OPEN_QUESTION"});const capture=await race([{type:"CORRECT"},{type:"CORRECT"}],true);
  expect(capture.results.map(r=>r.status)).toEqual([200,200]);expect(capture.results.map(r=>r.body.duplicate).sort()).toEqual([false,true]);
  expect(capture.after.version).toBe(capture.version+1);expect(capture.after.board.filter(c=>c.ownerTeamId)).toHaveLength(1);
  const cell=capture.after.board.find(c=>c.state==="AVAILABLE")!;await open(page,id,cell.cellId);
  const mixed=await race([{type:"CORRECT"},{type:"WRONG"}]);expect(mixed.results.map(r=>r.status).sort()).toEqual([200,409]);expect(mixed.after.version).toBe(mixed.version+1);
});
test("Letter Network: duplicate Start and Complete execute once and changed key payload is denied",async({page})=>{
  test.skip(!process.env.E2E_DATABASE_URL);const id=await setup(page,false),before=await read(page,id),key=crypto.randomUUID();
  const start=()=>page.request.post("/api/letter-network/"+id+"/commands",{headers:{Origin:origin},data:{key,expectedVersion:before.version,action:{type:"START"}}});
  const responses=await Promise.all([start(),start()]);expect(responses.map(r=>r.status())).toEqual([200,200]);
  const after=await read(page,id);expect(after.version).toBe(before.version+1);expect(after.matchNumber).toBe(1);
  const changed=await page.request.post("/api/letter-network/"+id+"/commands",{headers:{Origin:origin},data:{key,expectedVersion:after.version,action:{type:"PAUSE"}}});
  expect((await changed.json()).code).toBe("COMMAND_KEY_REUSED");
  await command(page,id,{type:"END_GAME"});const result=await read(page,id),completeKey=crypto.randomUUID();
  const complete=()=>page.request.post("/api/letter-network/"+id+"/commands",{headers:{Origin:origin},data:{key:completeKey,expectedVersion:result.version,action:{type:"COMPLETE"}}});
  expect((await Promise.all([complete(),complete()])).map(r=>r.status())).toEqual([200,200]);
  expect((await read(page,id)).version).toBe(result.version+1);
});
test("Letter Network: disconnected host cannot accept late answer or freeze both deadlines",async({page})=>{
  test.setTimeout(90_000);test.skip(!process.env.E2E_DATABASE_URL);
  const id=await setup(page),opened=await open(page,id,"r0c3");
  const remaining=new Date(opened.deadlineAt!).getTime()-new Date(opened.serverNow).getTime();expect(remaining).toBeGreaterThan(29_000);expect(remaining).toBeLessThanOrEqual(30_000);
  await page.goto("about:blank");await page.waitForTimeout(46_000);
  const late=await page.request.post("/api/letter-network/"+id+"/commands",{headers:{Origin:origin},data:{key:crypto.randomUUID(),expectedVersion:opened.version,action:{type:"CORRECT"}}});
  expect(late.status()).toBe(409);
  const result=await read(page,id);expect(result.phase).toBe("READY");expect(result.board.find(c=>c.cellId==="r0c3")?.state).toBe("AVAILABLE");expect(result.version).toBe(opened.version+2);
  expect((await read(page,id)).version).toBe(result.version);
});
test("Letter Network: display scope, shared active limit, revocation and Host ownership are enforced",async({page,browser})=>{
  test.skip(!process.env.E2E_DATABASE_URL);const id=await setup(page),accesses:string[]=[];
  for(let i=0;i<3;i++){const r=await page.request.post("/api/letter-network/"+id+"/display-access",{headers:{Origin:origin}});expect(r.status()).toBe(200);accesses.push((await r.json()).url);}
  expect((await page.request.post("/api/letter-network/"+id+"/display-access",{headers:{Origin:origin}})).status()).toBe(429);
  const outsider=await browser.newContext();try{
    expect((await outsider.request.get("/api/letter-network/"+id+"/display?token=invalid")).status()).toBe(403);
    await setup(await outsider.newPage());const otherPage=outsider.pages()[0],otherId=new URL(otherPage.url()).pathname.split("/").at(-1)!;
    const token=new URL(accesses[0],origin).searchParams.get("token");
    expect((await outsider.request.get("/api/letter-network/"+otherId+"/display?token="+token)).status()).toBe(403);
    expect((await outsider.request.get("/api/letter-network/"+id)).status()).toBe(403);
    expect((await outsider.request.post("/api/letter-network/"+id+"/commands",{headers:{Origin:origin},data:{key:crypto.randomUUID(),expectedVersion:(await read(page,id)).version,action:{type:"PAUSE"}}})).status()).toBe(403);
    expect((await page.request.post("/api/letter-network/"+id+"/commands",{headers:{Origin:"https://invalid.example"},data:{key:crypto.randomUUID(),expectedVersion:0,action:{type:"START"}}})).status()).toBe(403);
    await page.request.delete("/api/letter-network/"+id+"/display-access",{headers:{Origin:origin}});
    expect((await outsider.request.get("/api/letter-network/"+id+"/display?token="+token)).status()).toBe(403);
  }finally{await outsider.close();}
});
test("Letter Network: admin validates starts, updates snapshots safely, filters and archives",async({page,browser})=>{
  test.skip(!process.env.E2E_DATABASE_URL);const id=await setup(page),opened=await open(page,id,"r0c4"),revealed=await command(page,id,{type:"REVEAL_ANSWER"});
  const context=await browser.newContext(),admin=await context.newPage();
  try{
    await admin.goto("/login");await admin.getByLabel("البريد الإلكتروني").fill("admin@example.test");await admin.getByLabel("كلمة المرور").fill("e2e-admin-password-123");await admin.getByRole("button",{name:"تسجيل الدخول"}).click();await expect(admin).toHaveURL(/\/games$/);
    await expect(admin.getByRole("link",{name:"لوحة الإدارة"})).toBeVisible();
    await admin.goto("/admin/letter-questions");await expect(admin.getByRole("heading",{name:"أسئلة شبكة الحروف",exact:true})).toBeVisible();
    const questions=await (await admin.request.get("/api/admin/letter-questions?letter="+encodeURIComponent(opened.question!.letter))).json();
    const original=questions.find((q:{id:string})=>q.id===opened.question!.id);const input={letter:original.letter,question:original.question,answer:original.answer,alternativeAnswers:original.alternativeAnswers,categoryId:original.categoryId,difficulty:original.difficulty,status:original.status};
    const invalid=await admin.request.post("/api/admin/letter-questions",{headers:{Origin:origin},data:{...input,letter:"ذ",answer:"باب"}});expect(invalid.status()).toBe(400);
    const edit=await admin.request.patch("/api/admin/letter-questions/"+original.id,{headers:{Origin:origin},data:{...input,question:original.question+" (نسخة إدارية جديدة)"}});
    expect(edit.status()).toBe(200);expect((await read(page,id)).question?.text).toBe(opened.question!.text);expect((await read(page,id)).question?.answer).toBe(revealed.question!.answer);
    expect((await page.request.post("/api/admin/letter-questions",{headers:{Origin:origin},data:input})).status()).toBe(403);
    const created=await admin.request.post("/api/admin/letter-questions",{headers:{Origin:origin},data:{...input,question:input.question+" اختبار إدارة"}});expect(created.status()).toBe(201);const newId=(await created.json()).id;
    expect((await admin.request.delete("/api/admin/letter-questions/"+newId,{headers:{Origin:origin}})).status()).toBe(200);
    expect((await (await admin.request.get("/api/admin/letter-questions?q="+encodeURIComponent("اختبار إدارة"))).json()).find((q:{id:string})=>q.id===newId).status).toBe("ARCHIVED");
    await admin.request.patch("/api/admin/letter-questions/"+original.id,{headers:{Origin:origin},data:input});
  }finally{await context.close();}
});
test("Letter Network: five requested viewports keep physical edges and accessible team markers",async({page,browser})=>{
  test.skip(!process.env.E2E_DATABASE_URL);const id=await setup(page),{tv,context}=await display(page,browser,id);
  try{
    await open(page,id,"r1c0");await command(page,id,{type:"CORRECT"});await page.reload();
    await expect(page.locator(".letter-page")).toHaveAttribute("data-live-ready","true");
    for(const [width,height] of [[390,844],[768,1024],[1440,900],[1920,1080],[3840,2160]]){
      for(const device of [page,tv]){
        await device.setViewportSize({width,height});
        expect(await device.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
        await expect(device.locator('[data-cell="r2c0"]')).toBeVisible();
        await expect(device.locator('[data-cell="r2c4"]')).toBeVisible();
        const left=await device.locator('[data-cell="r2c0"]').boundingBox(),right=await device.locator('[data-cell="r2c4"]').boundingBox();
        expect(left).not.toBeNull();expect(right).not.toBeNull();
        expect(left!.x).toBeLessThan(right!.x);
        await expect(device.locator('[data-cell="r1c0"]')).toHaveAttribute("aria-label",/ملك فريق ياقوت/);
        await expect(device.locator('[data-cell="r1c0"] small')).toHaveText("أ");
      }
    }
    await tv.screenshot({path:"test-results/letter-network-tv-4k.png"});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:"test-results/letter-network-host-mobile.png",fullPage:true});
  }finally{await context.close();}
});
