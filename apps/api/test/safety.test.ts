import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { Domain } from "../src/domain.js";
import { demoIds } from "../src/db/database.js";
import { registerSafety, filterMessageForViewer, isContactBlocked, recordUnmatchFeedback } from "../src/modules/safety/index.js";

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "gap-safety-"));
  let app: Awaited<ReturnType<typeof createApp>>, d: Domain;
  const open = async () => {
    app = await createApp({dataDir: dir});
    d = new Domain(app.db, app.config); d.io = app.io;
    if (!app.hasRoute({method: "GET", url: "/v1/me/safety-keywords"})) registerSafety(app, d);
  };
  await open();
  const call = (method: any, url: string, token?: string, payload?: any, extra: Record<string,string> = {}) => app.inject({method, url, headers: {...(token ? {authorization: `Bearer ${token}`} : {}), ...extra}, ...(payload === undefined ? {} : {payload})});
  const login = async (account: string) => (await call("POST", "/v1/demo/sessions", undefined, {account})).json().data.token as string;
  const match = async (a: string, b: string) => {
    await call("POST", "/v1/swipes", a, {targetUserId: demoIds.B, action: "like"});
    return (await call("POST", "/v1/swipes", b, {targetUserId: demoIds.A, action: "like"})).json().data.match.id as string;
  };
  const upload = async (token: string, matchId: string, clientId = randomUUID(), content?: Buffer) => {
    const image = content ?? await readFile(join(dir, "media", "seed-A.png"));
    const boundary = "safety-test-boundary";
    const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`), image, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    return call("POST", `/v1/matches/${matchId}/message-media`, token, payload, {"content-type": `multipart/form-data; boundary=${boundary}`, "x-client-message-id": clientId});
  };
  return { get app() {return app;}, get d() {return d;}, dir, call, login, match, upload,
    restart: async () => {await app.close(); await open();},
    close: async () => {await app.close(); await rm(dir, {recursive: true, force: true});} };
}

test("personal keywords normalize Vietnamese, reject duplicates and apply only to recipients without changing stored text", async () => {
  const f = await fixture();
  try {
    const a = await f.login("A"), b = await f.login("B");
    assert.equal((await f.call("GET", "/v1/me/safety-keywords")).statusCode,401);
    const put = await f.call("PUT", "/v1/me/safety-keywords", b, {keywords: ["  CA\u0300   PHÊ ", ".*"]});
    assert.equal(put.statusCode,200);
    assert.deepEqual(put.json().data.keywords,["cà phê", ".*"]);
    assert.equal((await f.call("PUT", "/v1/me/safety-keywords", b, {keywords: ["CÀ PHÊ", "ca\u0300 phê"]})).json().error.code,"KEYWORD_DUPLICATE");
    assert.equal((await f.call("PUT", "/v1/me/safety-keywords", b, {keywords: [" "]})).statusCode,400);
    assert.equal((await f.call("PUT", "/v1/me/safety-keywords", b, {keywords: Array(51).fill("x")})).statusCode,400);
    assert.equal((await f.call("PUT", "/v1/me/safety-keywords", b, {keywords: ["x".repeat(41)]})).statusCode,400);
    assert.deepEqual((await f.call("GET", "/v1/me/safety-keywords", a)).json().data.keywords,[]);
    const id = await f.match(a,b);
    const original = "Bạn muốn đi CÀ  PHÊ không?";
    const message = (await f.call("POST", `/v1/matches/${id}/messages`, a, {kind:"text", text:original, clientMessageId:randomUUID()})).json().data;
    assert.equal(filterMessageForViewer(f.d,demoIds.B,message).text,"[Nội dung được ẩn theo từ khóa cá nhân]");
    assert.equal(filterMessageForViewer(f.d,demoIds.A,message).text,original);
    assert.equal(filterMessageForViewer(f.d,demoIds.B,{...message,text:"ca phe"}).text,"ca phe");
    assert.equal(filterMessageForViewer(f.d,demoIds.B,{...message,text:"abc"}).text,"abc");
    assert.equal(f.d.one("SELECT content_json FROM messages WHERE id=?",message.id).content_json.includes(original),true);
    await f.restart();
    assert.deepEqual((await f.call("GET", "/v1/me/safety-keywords", b)).json().data.keywords,["cà phê", ".*"]);
    assert.equal((await f.call("PUT", "/v1/me/safety-keywords", b, {keywords:[]})).statusCode,200);
    assert.equal(filterMessageForViewer(f.d,demoIds.B,message).text,original);
    f.d.db.exec("DROP TABLE safety_keywords");
    assert.equal(filterMessageForViewer(f.d,demoIds.B,message).text,original);
  } finally { await f.close(); }
});

test("chat images quarantine originals, explicit authenticated demo reviewer controls state, appeals remain private", async () => {
  const previous = process.env.DEMO_MODERATOR_TOKEN;
  delete process.env.DEMO_MODERATOR_TOKEN;
  const f = await fixture();
  try {
    const a = await f.login("A"), b = await f.login("B"), c = await f.login("C"), matchId = await f.match(a,b);
    assert.equal((await f.call("GET","/v1/moderation/reports",a)).statusCode,403);
    process.env.DEMO_MODERATOR_TOKEN = "test-only-explicit-review-key";
    const auth = {"x-demo-moderator-token":process.env.DEMO_MODERATOR_TOKEN};
    assert.equal((await f.call("GET","/v1/moderation/reports",undefined,undefined,auth)).statusCode,401);
    assert.equal((await f.call("GET","/v1/moderation/reports",a,undefined,{"x-demo-moderator-token":"wrong"})).statusCode,403);
    assert.equal((await f.upload(c,matchId)).statusCode,404);
    assert.equal((await f.upload(a,matchId,randomUUID(),Buffer.from("bad image"))).statusCode,422);
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    Buffer.from([137,80,78,71,13,10,26,10]).copy(oversized);
    assert.equal((await f.upload(a,matchId,randomUUID(),oversized)).statusCode,413);
    const clientId = randomUUID(), uploaded = await f.upload(a,matchId,clientId);
    assert.equal(uploaded.statusCode,200);
    const message = uploaded.json().data, media = message.payload;
    assert.equal(message.kind,"image"); assert.equal(media.status,"pending"); assert.equal(media.mode,"demo");
    assert.equal(media.url.endsWith("/preview"),true);
    assert.equal(uploaded.body.includes("storage_key"),false);
    assert.equal((await f.upload(a,matchId,clientId)).json().data.id,message.id);
    assert.equal((await f.upload(a,matchId,clientId,await readFile(join(f.dir,"media","seed-B.png")))).statusCode,409);
    assert.equal(f.d.one("SELECT count(*) n FROM moderation_cases").n,1);
    const originalUrl = `/v1/moderation/media/${media.mediaId}/content`;
    assert.equal((await f.call("GET",originalUrl,b)).statusCode,403);
    assert.equal((await f.call("GET",originalUrl,c)).statusCode,404);
    const preview = await f.call("GET",media.url,b);
    assert.equal(preview.statusCode,200); assert.equal(preview.headers["content-type"],"image/svg+xml");
    assert.equal((await f.call("GET",`/v1/media/${media.mediaId}/content`,b)).statusCode,404);
    assert.equal((await f.call("GET",media.url,c)).statusCode,404);
    assert.equal((await f.call("GET","/v1/me/moderation-cases",b)).json().data.length,0);
    const decision = (status:string,token=a,headers=auth) => f.call("POST",`/v1/moderation/reports/${media.mediaId}/decision`,token,{decision:status,reason:"Fixture manual review"},headers);
    assert.equal((await decision("blurred",b,{} as any)).statusCode,403);
    assert.equal((await decision("blurred")).statusCode,200);
    assert.equal((await f.call("GET",originalUrl,a)).statusCode,403);
    assert.equal((await f.call("POST","/v1/moderation/appeals",c,{caseId:media.mediaId,reason:"Không phải ảnh của C"})).statusCode,404);
    assert.equal((await f.call("POST","/v1/moderation/appeals",a,{caseId:media.mediaId,reason:"Đề nghị xem lại"})).statusCode,200);
    assert.equal((await f.call("POST","/v1/moderation/appeals",a,{caseId:media.mediaId,reason:"Lặp"})).statusCode,409);
    assert.equal((await f.call("GET","/v1/moderation/appeals",b)).json().data.length,0);
    await decision("rejected");
    assert.equal((await f.call("GET",originalUrl,b)).statusCode,403);
    await decision("allowed");
    const original = await f.call("GET",originalUrl,b);
    assert.equal(original.statusCode,200); assert.deepEqual(original.rawPayload,await readFile(join(f.dir,"media","seed-A.png")));
    assert.equal((await f.call("GET",originalUrl,c)).statusCode,404);
    const latest = filterMessageForViewer(f.d,demoIds.B,message);
    assert.equal(latest.payload.status,"allowed"); assert.equal(latest.payload.url,originalUrl);
    assert.equal(f.d.one("SELECT count(*) n FROM moderation_decisions").n,3);
    await f.restart();
    assert.equal((await f.call("GET",originalUrl,b)).statusCode,200);
    f.app.config.demoMode = false;
    assert.equal((await f.call("GET","/v1/moderation/reports",a,undefined,auth)).statusCode,403);
    assert.equal((await f.upload(a,matchId)).statusCode,503);
    f.app.config.demoMode = true;
    await f.call("DELETE",`/v1/matches/${matchId}`,a);
    assert.equal((await f.call("GET",originalUrl,b)).statusCode,403);
    assert.equal((await f.call("GET",media.url,a)).statusCode,403);
    assert.equal((await f.upload(a,matchId)).statusCode,403);
    assert.equal(f.d.one("SELECT account_status FROM users WHERE id=?",demoIds.A).account_status,"active");
  } finally {
    await f.close();
    if (previous === undefined) delete process.env.DEMO_MODERATOR_TOKEN; else process.env.DEMO_MODERATOR_TOKEN = previous;
  }
});

test("report lifecycle and appeal ownership never grant a normal user moderation privileges", async () => {
  const f = await fixture(), previous = process.env.DEMO_MODERATOR_TOKEN;
  try {
    process.env.DEMO_MODERATOR_TOKEN = "report-test-key";
    const a = await f.login("A"), b = await f.login("B"), c = await f.login("C");
    const receipt = (await f.call("POST","/v1/reports",a,{targetUserId:demoIds.B,reasonCode:"inappropriate",detail:"Private detail"})).json().data;
    assert.equal((await f.call("GET","/v1/moderation/reports",b)).statusCode,403);
    assert.equal((await f.call("GET","/v1/me/reports",b)).json().data.length,0);
    assert.equal((await f.call("POST","/v1/moderation/appeals",b,{reportId:receipt.id,reason:"Target must not learn reporter"})).statusCode,404);
    assert.equal((await f.call("POST","/v1/moderation/appeals",c,{reportId:receipt.id,reason:"Outsider"})).statusCode,404);
    const result = await f.call("POST",`/v1/moderation/reports/${receipt.id}/decision`,c,{decision:"resolved",reason:"Manual demo review"},{"x-demo-moderator-token":process.env.DEMO_MODERATOR_TOKEN});
    assert.equal(result.statusCode,200);
    assert.equal((await f.call("GET","/v1/me/reports",a)).json().data[0].status,"resolved");
    assert.equal((await f.call("POST","/v1/moderation/appeals",a,{reportId:receipt.id,reason:"Please review again"})).statusCode,200);
    assert.equal((await f.call("GET","/v1/moderation/appeals",a)).json().data.length,1);
    assert.equal((await f.call("GET","/v1/moderation/appeals",b)).json().data.length,0);
  } finally {
    await f.close();
    if (previous === undefined) delete process.env.DEMO_MODERATOR_TOKEN; else process.env.DEMO_MODERATOR_TOKEN = previous;
  }
});

test("consented contact hashes minimize storage, match both directions and clear without restoring match; unmatch reason stays private", async () => {
  const f = await fixture();
  try {
    const a = await f.login("A"), b = await f.login("B"), c = await f.login("C"), matchId = await f.match(a,b);
    f.d.run("UPDATE users SET phone=? WHERE id=?","+84912345678",demoIds.B);
    assert.equal((await f.call("POST","/v1/me/contact-blocks",a,{phones:["+84 912 345 678"]})).statusCode,400);
    assert.equal((await f.call("POST","/v1/me/contact-blocks",a,{phones:["0912345678"],consent:true})).statusCode,400);
    assert.equal((await f.call("POST","/v1/me/contact-blocks",a,{phones:["+84912345678","+84 912 345 678"],consent:true})).statusCode,422);
    recordUnmatchFeedback(f.d,demoIds.A,matchId,"not_a_fit");
    assert.throws(() => recordUnmatchFeedback(f.d,demoIds.C,matchId,"not_a_fit"));
    const response = await f.call("POST","/v1/me/contact-blocks",a,{phones:["+84 912 345 678"],consent:true});
    assert.equal(response.statusCode,200); assert.equal(response.body.includes("912"),false);
    const stored = f.d.one("SELECT * FROM contact_blocks WHERE user_id=?",demoIds.A);
    assert.equal(stored.phone_hmac.length,64); assert.equal(JSON.stringify(stored).includes("912345678"),false);
    assert.equal(isContactBlocked(f.d,demoIds.A,demoIds.B),true);
    assert.equal(isContactBlocked(f.d,demoIds.B,demoIds.A),true);
    assert.equal(isContactBlocked(f.d,demoIds.C,demoIds.B),false);
    assert.equal((await f.call("GET","/v1/me/contact-blocks",c)).json().data.count,0);
    assert.equal(f.d.one("SELECT status FROM matches WHERE id=?",matchId).status,"ended");
    assert.equal((await f.call("GET",`/v1/matches/${matchId}/messages`,b)).statusCode,403);
    assert.equal((await f.call("GET",`/v1/matches/${matchId}/messages`,b)).body.includes("not_a_fit"),false);
    await f.restart(); assert.equal(isContactBlocked(f.d,demoIds.A,demoIds.B),true);
    assert.equal((await f.call("DELETE","/v1/me/contact-blocks",a)).statusCode,200);
    assert.equal(isContactBlocked(f.d,demoIds.A,demoIds.B),false);
    assert.equal(f.d.one("SELECT status FROM matches WHERE id=?",matchId).status,"ended");
  } finally { await f.close(); }
});
