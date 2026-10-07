import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

// UI-only checks: the existing gameplay/security tests retain their assertions.
const sizes = [[390,844],[430,932],[768,1024],[1366,768],[1440,900],[1920,1080]] as const;
const mobileSizes = [[320,740],[390,844],[430,932]] as const;
const evidence = process.env.CAPTURE_QA_DIR;
const origin = "http://127.0.0.1:3000";

async function capture(page: Page, name: string, info: TestInfo) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { window.scrollTo(0,0); });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const geometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight,
    documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth,
    direction: getComputedStyle(document.documentElement).direction,
    buttons: Array.from(document.querySelectorAll<HTMLElement>(".btn, button, summary, .social-option")).filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden").map(el => {
      const box = el.getBoundingClientRect(); return { text: el.textContent?.trim(), width: box.width, height: box.height };
    }),
  }));
  expect(geometry.direction).toBe("rtl");
  expect(geometry.documentWidth, `${name}: document overflow`).toBeLessThanOrEqual(geometry.width);
  expect(geometry.bodyWidth, `${name}: body overflow`).toBeLessThanOrEqual(geometry.width);
  if (geometry.width <= 430) {
    for (const button of geometry.buttons) {
      expect(button.height, `${name}: ${button.text} height`).toBeGreaterThanOrEqual(44);
      expect(button.width, `${name}: ${button.text} width`).toBeGreaterThanOrEqual(44);
    }
  }
  if (evidence) {
    fs.mkdirSync(evidence, { recursive: true });
    const stem = `${name}-${geometry.width}x${geometry.height}`;
    const png = path.join(evidence, `${stem}.png`);
    await page.screenshot({ path: png, fullPage: true, animations: "disabled" });
    fs.writeFileSync(path.join(evidence, `${stem}.json`), JSON.stringify(geometry, null, 2));
    await info.attach(stem, { path: png, contentType: "image/png" });
  }
}
async function matrix(page: Page, name: string, info: TestInfo, viewports: ReadonlyArray<readonly [number,number]> = sizes) {
  for (const [width,height] of viewports) { await page.setViewportSize({width,height}); await capture(page,name,info); }
}
async function register(page: Page) {
  await page.goto("/register");
  await page.getByLabel("الاسم").fill("مضيف قدّام");
  await page.getByLabel("البريد الإلكتروني").fill(`quddam-${Date.now()}-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("كلمة المرور").fill("quddam-ui-password-123");
  await page.getByRole("button", {name:"إنشاء الحساب"}).click();
  await expect(page).toHaveURL(/\/games$/);
}
async function a11y(page: Page) {
  await page.addScriptTag({path:path.join(process.cwd(), "node_modules/axe-core/axe.min.js")});
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as {axe:{run:(options:unknown)=>Promise<{violations:Array<{id:string;nodes:Array<{target:string[]}>}>}>}}).axe;
    const result = await axe.run({runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}});
    return result.violations.map(v => ({id:v.id,targets:v.nodes.map(n=>n.target)}));
  });
  expect(violations).toEqual([]);
}

test("Quddam identity, metadata, icons and public navigation across six viewports", async ({page}, info) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await expect(page).toHaveTitle(/قدّام/);
  await expect(page.locator("html")).toHaveAttribute("lang","ar");
  await expect(page.locator('meta[name="application-name"]')).toHaveAttribute("content","قدّام");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content","قدّام");
  await expect(page.locator("#games .game-card")).toHaveCount(10);
  expect(await page.locator("body").innerText()).not.toMatch(/Qalba|قَلْبَة|قلبة/i);
  for (const asset of ["/favicon.ico","/icon.svg","/apple-icon.png","/brand/quddam-logo-dark.svg","/brand/quddam-logo-light.svg","/brand/quddam-logo-mono.svg","/brand/quddam-mark.svg","/brand/quddam-mark-mono.svg","/brand/quddam-icon-16.png","/brand/quddam-icon-32.png","/brand/quddam-icon-48.png","/brand/quddam-icon-192.png","/brand/quddam-icon-512.png"]) {
    expect((await page.request.get(asset)).status(), asset).toBe(200);
  }
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(ogImage).toBeTruthy();
  expect((await page.request.get(new URL(ogImage!,origin).href)).status()).toBe(200);
  await matrix(page,"home",info);
  await matrix(page,"home-small",info,[[320,740]]);
  await a11y(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link",{name:"انتقل إلى المحتوى"})).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.locator("#games .game-card").first().hover();
  expect(await page.locator("#games .game-card").first().evaluate(el=>getComputedStyle(el).transform)).toBe("none");
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/login"); await matrix(page,"login",info); await a11y(page);
  await page.goto("/register"); await matrix(page,"register",info); await a11y(page);
  await page.goto("/join"); await matrix(page,"join",info,mobileSizes); await a11y(page);
  await page.goto("/"); await page.getByRole("link",{name:"يلا قدّام",exact:true}).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("Quddam library preserves all ten game routes and create room presentation", async ({page}, info) => {
  test.setTimeout(180_000);
  await register(page);
  await expect(page.getByRole("link",{name:/رصيدك: 3 ألعاب/})).toBeVisible();
  await expect(page.getByRole("button",{name:"خروج",exact:true})).toBeVisible();
  await matrix(page,"library",info); await matrix(page,"library-small",info,[[320,740]]); await a11y(page);
  const games = [
    ["لوحة التحدي","/games/category-board/new"],["خارج الجو","/games/out-of-the-loop/new"],
    ["شبكة الحروف","/games/letter-network/new"],["قالوا الناس","/games/survey-show/new"],
    ["الكلمة الممنوعة","/games/secret-word/new"],["صدّقني","/bluff/new"],
    ["توب 100","/ranked/new"],["البرق","/lightning/new"],["رتّبها","/ordering/new"],["المحكمة","/court/new"],
  ];
  for (const [name,route] of games) {
    await page.goto("/games");
    const card = page.locator("article.game-card").filter({has:page.getByRole("heading",{name,exact:true})});
    await expect(card).toHaveCount(1);
    await expect(card.locator(".game-facts")).toContainText("حوالي");
    await expect(card.locator("a.btn")).toHaveAttribute("href",route);
    await card.locator("a.btn").click(); await expect(page).toHaveURL(new RegExp(route+"$"));
    const create = page.getByRole("button",{name:/يلا قدّام/});
    await expect(create).toHaveCount(1);
    await page.setViewportSize({width:390,height:844});
    await capture(page,`setup-${route.split("/").at(-2)}`,info);
  }
  await page.goto("/games/category-board/new");
  const categories = page.getByRole("checkbox");
  for (let i=0;i<6;i++) await categories.nth(i).check();
  await expect(page.getByRole("button",{name:/يلا قدّام/})).toBeEnabled();
  await matrix(page,"create-room",info); await a11y(page);
});

test("Quddam shared lobby, live host and anonymous TV retain controls and privacy", async ({page,browser},info) => {
  test.setTimeout(180_000);
  await register(page); await page.goto("/games/category-board/new");
  const categories = page.getByRole("checkbox"); for(let i=0;i<6;i++) await categories.nth(i).check();
  await page.getByRole("button",{name:/يلا قدّام/}).click(); await expect(page).toHaveURL(/\/play\/[^/]+$/);
  const id = page.url().split("/").at(-1)!;
  await page.getByRole("button",{name:"أنشئ غرفة برمز"}).click();
  const code = await page.locator(".room-code").innerText();
  const lobby = await page.context().newPage(); await lobby.goto(`/rooms/${code}`);
  await expect(lobby.getByRole("img",{name:"رمز QR لانضمام اللاعبين"})).toBeVisible();
  const guestContext = await browser.newContext({viewport:{width:390,height:844}}), guest = await guestContext.newPage();
  const tvContext = await browser.newContext({viewport:{width:1920,height:1080}}), tv = await tvContext.newPage();
  try {
    await guest.goto(`/join?code=${code}`); await guest.getByLabel("اسمك في اللعب").fill("ضيفة الموج");
    await guest.getByRole("button",{name:"انضم إلى الغرفة"}).click(); await expect(guest).toHaveURL(new RegExp(`/rooms/${code}$`));
    await guest.getByRole("button",{name:"أنا جاهز"}).click();
    await expect(lobby.getByText("ضيفة الموج")).toBeVisible();
    await matrix(lobby,"lobby",info); await a11y(lobby);
    await page.getByRole("button",{name:"ابدأ المباراة",exact:true}).click();
    await page.getByRole("button",{name:"معلومات عامة 200",exact:true}).click();
    await page.getByRole("button",{name:"إيقاف المباراة مؤقتًا"}).click();
    await expect(page.getByRole("button",{name:"استئناف المباراة"})).toBeVisible();
    await matrix(page,"host-board",info); await a11y(page);
    const access = await page.request.post(`/api/games/category-board/${id}/display-access`,{headers:{Origin:origin}});
    expect(access.status()).toBe(200); const link = await access.json(); await tv.goto(link.url);
    await expect(tv.locator(".display-question h1")).toBeVisible();
    await matrix(tv,"tv-board",info); await a11y(tv);
    await tv.setViewportSize({width:1920,height:1080});
    expect(await tv.locator(".display-grid").evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1080);
    await expect(tv.locator("header.header")).toBeHidden();
    await expect(tv.getByRole("button",{name:/اكشف الإجابة|صحيح|خاطئ/})).toHaveCount(0);
    await expect(tv.locator(".display-answer")).toHaveCount(0);
    await matrix(guest,"participant-board",info,mobileSizes);
  } finally {await guestContext.close(); await tvContext.close(); await lobby.close();}
});

test("Quddam phone role and voting presentation keeps Out of the Loop secret private", async ({page,browser},info) => {
  test.setTimeout(180_000);
  await register(page); await page.goto("/games/out-of-the-loop/new");
  await page.getByRole("button",{name:/يلا قدّام/}).click(); await expect(page).toHaveURL(/\/social\/host\/[^/]+$/);
  const id = page.url().split("/").at(-1)!;
  const initial = await (await page.request.get(`/api/social/${id}`)).json();
  const contexts = [], phones:Page[] = [];
  const tvContext = await browser.newContext({viewport:{width:1920,height:1080}}), tv = await tvContext.newPage();
  try {
    for (let i=0;i<3;i++) {
      const context = await browser.newContext({viewport:{width:390,height:844}}); contexts.push(context);
      const phone = await context.newPage(); phones.push(phone); await phone.goto(`/social/join?code=${initial.code}`);
      await phone.getByLabel("اسمك في اللعبة").fill(`لاعب قدّام ${i+1}`);
      await phone.getByRole("button",{name:"ادخل اللعبة"}).click(); await expect(phone).toHaveURL(new RegExp(`/social/play/${id}$`));
    }
    await expect(page.getByText("انضم 3 من ١٢")).toBeVisible(); await matrix(page,"lobby-social",info);
    await page.getByRole("button",{name:"ابدأ اللعبة",exact:true}).click();
    await expect(page.getByRole("heading",{name:"وزّعت الأدوار الخاصة"})).toBeVisible();
    const views = await Promise.all(phones.map(async p=>(await p.request.get(`/api/social/${id}/player`)).json()));
    const normal = views.findIndex(v=>v.self.role==="PLAYER"), outsider = views.findIndex(v=>v.self.role==="OUTSIDER");
    expect(normal).toBeGreaterThanOrEqual(0); expect(outsider).toBeGreaterThanOrEqual(0);
    const secret = views[normal].self.secretWord; expect(secret).toBeTruthy(); expect(views[outsider].self.secretWord).toBeNull();
    await expect(phones[normal].getByRole("heading",{name:"أنت تعرف الكلمة"})).toBeVisible();
    await matrix(phones[normal],"participant-role",info,mobileSizes); await a11y(phones[normal]);
    expect(await phones[outsider].locator("body").innerText()).not.toContain(secret);
    await matrix(phones[outsider],"participant-outsider",info,mobileSizes);
    const access = await page.request.post(`/api/social/${id}/display-access`,{headers:{Origin:origin}});
    expect(access.status()).toBe(200); const link = await access.json(); await tv.goto(link.url);
    await expect(tv.getByRole("heading",{name:"اطّلعوا على بطاقاتكم"})).toBeVisible();
    expect(await page.locator("body").innerText()).not.toContain(secret); expect(await tv.locator("body").innerText()).not.toContain(secret);
    await matrix(tv,"tv-social",info); await a11y(tv);
    await page.getByRole("button",{name:"ابدأ النقاش",exact:true}).click();
    await page.getByRole("button",{name:"ابدأ التصويت",exact:true}).click();
    await expect(phones[normal].getByRole("heading",{name:"مين خارج الجو؟"})).toBeVisible();
    await phones[normal].getByRole("radio").first().check();
    await expect(phones[normal].getByRole("button",{name:"أرسل صوتك",exact:true})).toBeEnabled();
    await matrix(phones[normal],"participant-vote",info,mobileSizes); await a11y(phones[normal]);
    for (const [width,height] of [[390,844],[430,932]]) {
      await phones[normal].setViewportSize({width,height}); await phones[normal].evaluate(()=>window.scrollTo(0,0));
      const submit = await phones[normal].getByRole("button",{name:"أرسل صوتك",exact:true}).boundingBox();
      expect(submit!.y + submit!.height, `${width}: voting action above fold`).toBeLessThanOrEqual(height);
    }
    expect(await tv.locator("body").innerText()).not.toContain(secret);
  } finally {for(const context of contexts) await context.close(); await tvContext.close();}
});

for (const game of ["court","lightning","ordering","ranked","bluff"]) test(`Quddam ${game} Host and TV presentation fits mobile and 1080p`, async ({page,browser},info) => {
  test.setTimeout(120_000);
  await register(page);
    await page.goto(`/${game}/new`);
    const created = page.waitForResponse(r => new URL(r.url()).pathname === `/api/${game}` && r.request().method() === "POST",{timeout:30_000});
    await page.getByRole("button",{name:/يلا قدّام/}).click();
    expect((await created).status()).toBe(201);
    await expect(page).toHaveURL(new RegExp(`/${game}/host/[^/]+$`));
    const id = page.url().split("/").at(-1)!;
    if (["ranked","lightning","ordering"].includes(game)) {
      await page.getByRole("button",{name:"ابدأ المباراة",exact:true}).click();
      await expect(page.locator(`.${game}-host`)).toHaveAttribute("data-phase","READY");
    }
    if (game === "ranked") {
      await page.getByRole("button",{name:"ابدأ الجولة",exact:true}).click();
      await expect(page.locator(".ranked-host")).toHaveAttribute("data-phase","GUESS_ACTIVE");
      await expect(page.getByText("إعداد تحريري أصلي لقدّام",{exact:false})).toBeVisible();
      expect(await page.locator("body").innerText()).not.toContain("إعداد تحريري أصلي لقلبة");
      await expect(page.locator('.ranked-board [data-revealed="false"]')).toHaveCount(10);
      await page.getByRole("button",{name:"إيقاف مؤقت",exact:true}).click();
      await expect(page.locator(".ranked-host")).toHaveAttribute("data-phase","PAUSED");
    }
    if (["lightning","ordering"].includes(game)) {
      const host = await (await page.request.get(`/api/${game}/${id}`)).json();
      const type = game === "lightning" ? "buzzer" : "controller";
      const issued = await page.request.post(`/api/${game}/${id}/${type}-access`,{headers:{Origin:origin},data:{teamId:host.teams[0].id}});
      expect(issued.status()).toBe(200); const link = await issued.json();
      const phoneContext = await browser.newContext({viewport:{width:390,height:844}}), phone = await phoneContext.newPage();
      try {
        await phone.goto(link.url);
        await page.getByRole("button",{name:game === "lightning" ? "جهّز السؤال" : "ابدأ الجولة",exact:true}).click();
        if (game === "lightning") {
          await page.getByRole("button",{name:"افتح البرق",exact:true}).click();
          await expect(phone.getByRole("button",{name:"اضغط الجرس",exact:true})).toBeEnabled();
        } else {
          await expect(phone.getByRole("button",{name:"سلّم الترتيب",exact:true})).toBeEnabled();
        }
        await matrix(phone,`participant-${type}`,info,mobileSizes); await a11y(phone);
        await phone.setViewportSize({width:390,height:844}); await phone.evaluate(()=>window.scrollTo(0,0));
        const action = await phone.getByRole("button",{name:game === "lightning" ? "اضغط الجرس" : "سلّم الترتيب",exact:true}).boundingBox();
        expect(action!.y + action!.height, `${game}: main mobile action above fold`).toBeLessThanOrEqual(844);
        await page.getByRole("button",{name:"إيقاف مؤقت",exact:true}).click();
        await expect(page.locator(`.${game}-host`)).toHaveAttribute("data-phase","PAUSED");
      } finally {await phoneContext.close();}
    }
    await matrix(page,`host-${game}`,info,[[390,844],[1366,768]]);
    const response = await page.request.post(`/api/${game}/${id}/display-access`,{headers:{Origin:origin}});
    expect(response.status()).toBe(200); const access = await response.json();
    const context = await browser.newContext({viewport:{width:1920,height:1080}}), tv = await context.newPage();
    try {
      await tv.goto(access.url); await expect(tv.locator(`.${game}-tv .quddam-brand`)).toHaveText("قدّام");
      await matrix(tv,`tv-${game}`,info,[[390,844],[1920,1080]]); await a11y(tv);
      await tv.setViewportSize({width:1920,height:1080});
      await expect(tv.locator("header.header")).toBeHidden();
      expect(await tv.locator(`.${game}-tv`).evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(1080);
    } finally {await context.close();}
});
