import crypto from "node:crypto";
const out=(res,status,body)=>res.status(status).set("Cache-Control","no-store").json(body);
const read=(s,f=[])=>{try{return JSON.parse(s||"")}catch{return f}};
const iso=v=>{const n=Date.parse(String(v||""));return Number.isFinite(n)?new Date(n).toISOString():""};

export function ensureTopReelsGiveawayTables(db){
  db.exec([
    "CREATE TABLE IF NOT EXISTS topreels_giveaways (id TEXT PRIMARY KEY,status TEXT NOT NULL CHECK(status IN ('draft','open','winner_selected','claimed','fulfilled','closed_no_entries','claim_expired','cancelled')),title TEXT NOT NULL,sponsor TEXT NOT NULL,rules_url TEXT NOT NULL,rules_version TEXT NOT NULL,legal_review_ref TEXT NOT NULL,opens_at TEXT NOT NULL,closes_at TEXT NOT NULL,min_age INTEGER NOT NULL,eligible_regions_json TEXT NOT NULL,prize_skus_json TEXT NOT NULL,prize_value_cents INTEGER NOT NULL,claim_days INTEGER NOT NULL,unclaimed_policy TEXT NOT NULL,created_by TEXT NOT NULL,created_on TEXT NOT NULL DEFAULT(datetime('now')),updated_on TEXT NOT NULL DEFAULT(datetime('now')))",
    "CREATE INDEX IF NOT EXISTS idx_tr_giveaway_status ON topreels_giveaways(status,closes_at)",
    "CREATE TABLE IF NOT EXISTS topreels_giveaway_entries (entry_id TEXT PRIMARY KEY,giveaway_id TEXT NOT NULL REFERENCES topreels_giveaways(id),user_id INTEGER NOT NULL REFERENCES users(id),region_code TEXT NOT NULL,age_attested INTEGER NOT NULL CHECK(age_attested=1),rules_version TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'entered' CHECK(status IN ('entered','selected_winner','withdrawn')),entered_on TEXT NOT NULL DEFAULT(datetime('now')),UNIQUE(giveaway_id,user_id))",
    "CREATE INDEX IF NOT EXISTS idx_tr_giveaway_entries ON topreels_giveaway_entries(giveaway_id,status,entry_id)",
    "CREATE TABLE IF NOT EXISTS topreels_giveaway_draws (id TEXT PRIMARY KEY,giveaway_id TEXT NOT NULL REFERENCES topreels_giveaways(id),attempt INTEGER NOT NULL,entry_count INTEGER NOT NULL,entries_sha256 TEXT NOT NULL,selected_entry_id TEXT NOT NULL,random_index INTEGER NOT NULL,algorithm TEXT NOT NULL DEFAULT 'node-crypto.randomInt',drawn_on TEXT NOT NULL DEFAULT(datetime('now')),UNIQUE(giveaway_id,attempt),UNIQUE(giveaway_id,selected_entry_id))",
    "CREATE TABLE IF NOT EXISTS topreels_giveaway_claims (id TEXT PRIMARY KEY,giveaway_id TEXT NOT NULL REFERENCES topreels_giveaways(id),winner_entry_id TEXT NOT NULL REFERENCES topreels_giveaway_entries(entry_id),user_id INTEGER NOT NULL REFERENCES users(id),sku TEXT,status TEXT NOT NULL CHECK(status IN ('pending','chosen','fulfilled','expired')),claim_deadline TEXT NOT NULL,site_url TEXT,verified_at TEXT,created_on TEXT NOT NULL DEFAULT(datetime('now')),UNIQUE(giveaway_id,winner_entry_id))",
    "CREATE TABLE IF NOT EXISTS topreels_giveaway_audit (id INTEGER PRIMARY KEY AUTOINCREMENT,giveaway_id TEXT NOT NULL REFERENCES topreels_giveaways(id),action TEXT NOT NULL,actor TEXT NOT NULL,metadata_json TEXT NOT NULL DEFAULT '{}',created_on TEXT NOT NULL DEFAULT(datetime('now')))",
    "CREATE INDEX IF NOT EXISTS idx_tr_giveaway_audit ON topreels_giveaway_audit(giveaway_id,id DESC)"
  ].join(";"));
}

export function registerTopReelsGiveaway(d){
  const {app,db,isTopReelsOwner,getTopReelsOwnerEmail,getTopReelsCustomer,topReelsCustomerCors,sendMail,emailShell,probeIdentity}=d;
  ensureTopReelsGiveawayTables(db);
  const rates=new Map();
  const audit=(id,action,actor,meta={})=>db.prepare("INSERT INTO topreels_giveaway_audit(giveaway_id,action,actor,metadata_json) VALUES(?,?,?,?)").run(id,action,String(actor||"system").slice(0,254),JSON.stringify(meta));
  const byId=id=>db.prepare("SELECT * FROM topreels_giveaways WHERE id=?").get(id);
  const current=()=>db.prepare("SELECT * FROM topreels_giveaways ORDER BY CASE WHEN status IN ('open','winner_selected','claimed') THEN 0 ELSE 1 END,created_on DESC,id DESC LIMIT 1").get();
  const skus=c=>read(c?.prize_skus_json,[]);
  const prizes=c=>{if(!c)return[];const a=skus(c);if(!a.length)return[];const active=["open","winner_selected","claimed"].includes(c.status);return db.prepare("SELECT sku,name,slug,hostname FROM topreels_inventory WHERE status IN ("+(active?"'reserved_giveaway'":"'available'")+") AND server_locked=0 AND sku IN ("+a.map(()=>"?").join(",")+") ORDER BY sku").all(...a)};
  const publicInfo=c=>{
    if(!c||["draft","cancelled"].includes(c.status))return{status:"prelaunch",entriesOpen:false};
    const now=Date.now(),phase=c.status==="open"?(now<Date.parse(c.opens_at)?"scheduled":now<Date.parse(c.closes_at)?"open":"drawing"):c.status;
    const g={id:c.id,title:c.title,sponsor:c.sponsor,status:phase,entriesOpen:phase==="open",opensAt:c.opens_at,closesAt:c.closes_at,rulesUrl:c.rules_url,rulesVersion:c.rules_version,minAge:c.min_age,eligibleRegions:read(c.eligible_regions_json,[]),prizes:prizes(c),winnerSelection:"computerized_random",audit:"The locked entry snapshot, entry count, random selection index, and timestamp are recorded for review."};
    if(["winner_selected","claimed","fulfilled","closed_no_entries","claim_expired"].includes(c.status))g.finalEntryCount=Number(db.prepare("SELECT COUNT(*) n FROM topreels_giveaway_entries WHERE giveaway_id=?").get(c.id).n);
    return g;
  };
  const mailWinner=async claim=>{try{const u=db.prepare("SELECT email FROM users WHERE id=?").get(claim.user_id);if(u?.email&&sendMail){const html=emailShell("<p>You were selected in the TopReels website giveaway drawing.</p><p>Sign in to choose one available website build before <b>"+claim.claim_deadline+"</b>.</p><p><a href='https://topreels-3230f40cc3.haksterai.com/#giveaway'>Choose your prize</a></p><p>There is no charge to claim.</p>");await sendMail(u.email,"TopReels giveaway: selected winner",html)}}catch(e){console.warn("[topreels-giveaway] winner email failed:",String(e?.message||e).slice(0,100))}};
  const draw=(id,alternate=false)=>{
    let notice=null,result=null;
    try{
      db.exec("BEGIN IMMEDIATE");const c=byId(id);
      if(!c||!(c.status==="open"||alternate&&c.status==="winner_selected")||c.status==="open"&&Date.now()<Date.parse(c.closes_at)){db.exec("ROLLBACK");return null}
      const old=db.prepare("SELECT * FROM topreels_giveaway_claims WHERE giveaway_id=? AND status='pending' ORDER BY created_on DESC LIMIT 1").get(id);
      if(old&&Date.parse(old.claim_deadline)>Date.now()){db.exec("ROLLBACK");return null}
      if(old){db.prepare("UPDATE topreels_giveaway_claims SET status='expired' WHERE id=?").run(old.id);db.prepare("UPDATE topreels_giveaway_entries SET status='withdrawn' WHERE entry_id=?").run(old.winner_entry_id)}
      const entries=db.prepare("SELECT entry_id,user_id FROM topreels_giveaway_entries WHERE giveaway_id=? AND status='entered' ORDER BY entry_id").all(id);
      const attempt=Number(db.prepare("SELECT COUNT(*) n FROM topreels_giveaway_draws WHERE giveaway_id=?").get(id).n)+1;
      if(!entries.length){const status=old?"claim_expired":"closed_no_entries";db.prepare("UPDATE topreels_giveaways SET status=?,updated_on=datetime('now') WHERE id=?").run(status,id);db.prepare("UPDATE topreels_inventory SET status='available' WHERE sku IN ("+skus(c).map(()=>"?").join(",")+") AND status='reserved_giveaway'").run(...skus(c));audit(id,status,"system",{attempt});db.exec("COMMIT");return{status}}
      const n=crypto.randomInt(entries.length),e=entries[n],digest=crypto.createHash("sha256").update(entries.map(x=>x.entry_id).join("\\n")).digest("hex"),drawId=crypto.randomUUID(),claimId=crypto.randomUUID(),deadline=new Date(Date.now()+Number(c.claim_days)*86400000).toISOString();
      db.prepare("INSERT INTO topreels_giveaway_draws(id,giveaway_id,attempt,entry_count,entries_sha256,selected_entry_id,random_index) VALUES(?,?,?,?,?,?,?)").run(drawId,id,attempt,entries.length,digest,e.entry_id,n);
      db.prepare("UPDATE topreels_giveaway_entries SET status='selected_winner' WHERE entry_id=?").run(e.entry_id);
      db.prepare("INSERT INTO topreels_giveaway_claims(id,giveaway_id,winner_entry_id,user_id,status,claim_deadline) VALUES(?,?,?,?,'pending',?)").run(claimId,id,e.entry_id,e.user_id,deadline);
      db.prepare("UPDATE topreels_giveaways SET status='winner_selected',updated_on=datetime('now') WHERE id=?").run(id);
      audit(id,"winner_selected","system",{drawId,attempt,entryCount:entries.length,entriesSha256:digest,randomIndex:n,algorithm:"node:crypto.randomInt",drawnOn:new Date().toISOString()});
      db.exec("COMMIT");notice={user_id:e.user_id,claim_deadline:deadline};result={status:"winner_selected",attempt,entryCount:entries.length};
    }catch(e){try{db.exec("ROLLBACK")}catch{}console.error("[topreels-giveaway] draw failed:",String(e?.message||e).slice(0,120));return null}
    if(notice)mailWinner(notice);return result;
  };
  const schedule=()=>{
    try{
      for(const c of db.prepare("SELECT id FROM topreels_giveaways WHERE status='open' AND closes_at<=?").all(new Date().toISOString()))draw(c.id);
      for(const c of db.prepare("SELECT g.id,g.unclaimed_policy FROM topreels_giveaways g JOIN topreels_giveaway_claims x ON x.giveaway_id=g.id WHERE g.status='winner_selected' AND x.status='pending' AND x.claim_deadline<=?").all(new Date().toISOString())){
        if(c.unclaimed_policy==="alternate")draw(c.id,true);
        else{const campaign=byId(c.id),pool=skus(campaign);db.exec("BEGIN IMMEDIATE");db.prepare("UPDATE topreels_giveaway_claims SET status='expired' WHERE giveaway_id=? AND status='pending'").run(c.id);db.prepare("UPDATE topreels_giveaways SET status='claim_expired',updated_on=datetime('now') WHERE id=?").run(c.id);db.prepare("UPDATE topreels_inventory SET status='available' WHERE sku IN ("+pool.map(()=>"?").join(",")+") AND status='reserved_giveaway'").run(...pool);audit(c.id,"claim_expired","system",{policy:"no_award"});db.exec("COMMIT")}
      }
    }catch(e){console.warn("[topreels-giveaway] schedule failed:",String(e?.message||e).slice(0,100))}
  };
  const timer=setInterval(schedule,30000);timer.unref?.();setTimeout(schedule,1000).unref?.();

  app.options("/api/admin/topreels/giveaway",(req,res)=>topReelsCustomerCors(req,res)?res.status(204).end():out(res,403,{ok:false,error:"origin not allowed"}));
  app.options("/api/admin/topreels/giveaway/*",(req,res)=>topReelsCustomerCors(req,res)?res.status(204).end():out(res,403,{ok:false,error:"origin not allowed"}));
  /* The published page reads the public status cross-origin with a Content-Type
     header, so this route needs its own preflight answer like the admin ones. */
  app.options("/api/topreels/giveaway/status",(req,res)=>topReelsCustomerCors(req,res)?res.status(204).end():out(res,403,{ok:false,error:"origin not allowed"}));
  app.get("/api/topreels/giveaway/status",(req,res)=>topReelsCustomerCors(req,res)?out(res,200,{ok:true,giveaway:publicInfo(current())}):out(res,403,{ok:false,error:"origin not allowed"}));
  app.get("/api/topreels/customer/giveaway",(req,res)=>{
    if(!topReelsCustomerCors(req,res))return out(res,403,{ok:false,error:"origin not allowed"});
    const u=getTopReelsCustomer(req);if(!u)return out(res,401,{ok:false,error:"Sign in first."});
    const c=current();if(!c)return out(res,200,{ok:true,giveaway:{status:"prelaunch",entriesOpen:false},entry:null,claim:null,prizes:[]});
    const entry=db.prepare("SELECT entry_id AS entryId,entered_on AS enteredOn,status FROM topreels_giveaway_entries WHERE giveaway_id=? AND user_id=?").get(c.id,u.id)||null;
    const claim=db.prepare("SELECT id,status,sku,claim_deadline AS claimDeadline FROM topreels_giveaway_claims WHERE giveaway_id=? AND user_id=? ORDER BY created_on DESC LIMIT 1").get(c.id,u.id)||null;
    return out(res,200,{ok:true,profile:{email:u.email,name:u.display_name},giveaway:publicInfo(c),entry,claim,prizes:claim?.status==="pending"?prizes(c):[]});
  });
  app.post("/api/topreels/customer/giveaway/entry",(req,res)=>{
    if(!topReelsCustomerCors(req,res))return out(res,403,{ok:false,error:"origin not allowed"});
    const u=getTopReelsCustomer(req);if(!u)return out(res,401,{ok:false,error:"Sign in first."});
    const ip=String(req.ip||req.socket.remoteAddress||"unknown"),now=Date.now(),prev=rates.get(ip);if(prev&&now-prev.at<600000&&prev.n>=8)return out(res,429,{ok:false,error:"Too many entry attempts."});const r=prev&&now-prev.at<600000?prev:{at:now,n:0};r.n++;rates.set(ip,r);
    const c=current(),region=String(req.body?.regionCode||"").trim().toUpperCase();
    if(!c||c.status!=="open"||now<Date.parse(c.opens_at)||now>=Date.parse(c.closes_at))return out(res,409,{ok:false,error:"Entries are not open."});
    if(req.body?.ageConfirmed!==true||req.body?.rulesAccepted!==true||String(req.body?.rulesVersion||"")!==c.rules_version)return out(res,400,{ok:false,error:"Confirm the published age and eligibility rules."});
    if(!read(c.eligible_regions_json,[]).includes(region))return out(res,400,{ok:false,error:"Select an eligible location listed in the official rules."});
    const entryId=crypto.randomUUID();
    try{
      db.exec("BEGIN IMMEDIATE");const fresh=byId(c.id);if(!fresh||fresh.status!=="open"||Date.now()>=Date.parse(fresh.closes_at)){db.exec("ROLLBACK");return out(res,409,{ok:false,error:"Entries are not open."})}
      const old=db.prepare("SELECT entry_id AS entryId,entered_on AS enteredOn FROM topreels_giveaway_entries WHERE giveaway_id=? AND user_id=?").get(c.id,u.id);if(old){db.exec("ROLLBACK");return out(res,200,{ok:true,alreadyEntered:true,entry:old})}
      db.prepare("INSERT INTO topreels_giveaway_entries(entry_id,giveaway_id,user_id,region_code,age_attested,rules_version) VALUES(?,?,?,?,1,?)").run(entryId,c.id,u.id,region,c.rules_version);
      audit(c.id,"entry_created","user:"+u.id,{entryId,regionCode:region,rulesVersion:c.rules_version,ageAttested:true});db.exec("COMMIT");return out(res,201,{ok:true,entry:{entryId,entered:true},message:"Entry recorded. Free and paid plan status does not change your odds."});
    }catch(e){try{db.exec("ROLLBACK")}catch{}if(String(e?.message||"").includes("UNIQUE"))return out(res,200,{ok:true,alreadyEntered:true});return out(res,503,{ok:false,error:"Entry could not be recorded. No entry was created."})}
  });
  app.post("/api/topreels/customer/giveaway/claim",(req,res)=>{
    if(!topReelsCustomerCors(req,res))return out(res,403,{ok:false,error:"origin not allowed"});const u=getTopReelsCustomer(req);if(!u)return out(res,401,{ok:false,error:"Sign in first."});
    const c=current(),sku=String(req.body?.sku||"").trim().toUpperCase();if(!c||c.status!=="winner_selected")return out(res,409,{ok:false,error:"There is no open winner claim."});
    try{
      db.exec("BEGIN IMMEDIATE");const claim=db.prepare("SELECT * FROM topreels_giveaway_claims WHERE giveaway_id=? AND user_id=? AND status='pending'").get(c.id,u.id);
      if(!claim){db.exec("ROLLBACK");return out(res,403,{ok:false,error:"Only the selected winner can choose a prize."})}
      if(Date.now()>Date.parse(claim.claim_deadline)){db.exec("ROLLBACK");return out(res,409,{ok:false,error:"The prize claim period ended."})}
      if(!skus(c).includes(sku)){db.exec("ROLLBACK");return out(res,400,{ok:false,error:"Choose a build listed for this giveaway."})}
      const item=db.prepare("SELECT sku,name FROM topreels_inventory WHERE sku=? AND status='reserved_giveaway' AND server_locked=0").get(sku);if(!item){db.exec("ROLLBACK");return out(res,409,{ok:false,error:"That build is no longer reserved for this giveaway. Refresh and contact support."})}
      db.prepare("UPDATE topreels_inventory SET status='available' WHERE sku IN ("+skus(c).filter(x=>x!==sku).map(()=>"?").join(",")+") AND status='reserved_giveaway'").run(...skus(c).filter(x=>x!==sku));
      db.prepare("UPDATE topreels_giveaway_claims SET sku=?,status='chosen' WHERE id=? AND status='pending'").run(sku,claim.id);db.prepare("UPDATE topreels_giveaways SET status='claimed',updated_on=datetime('now') WHERE id=?").run(c.id);audit(c.id,"prize_chosen","user:"+u.id,{sku,name:item.name});db.exec("COMMIT");
      return out(res,200,{ok:true,claim:{status:"chosen",sku,name:item.name},message:"Your selection is reserved; owner site setup and delivery are still pending."});
    }catch(e){try{db.exec("ROLLBACK")}catch{}return out(res,503,{ok:false,error:"Prize choice could not be reserved."})}
  });
  app.get("/api/admin/topreels/giveaway",(req,res)=>{
    if(!topReelsCustomerCors(req,res))return out(res,403,{ok:false,error:"origin not allowed"});if(!isTopReelsOwner(req))return out(res,403,{ok:false,error:"TopReels owner sign-in required"});
    const campaigns=db.prepare("SELECT * FROM topreels_giveaways ORDER BY created_on DESC LIMIT 20").all().map(c=>({id:c.id,status:c.status,title:c.title,sponsor:c.sponsor,rulesUrl:c.rules_url,rulesVersion:c.rules_version,legalReviewRef:c.legal_review_ref,opensAt:c.opens_at,closesAt:c.closes_at,minAge:c.min_age,eligibleRegions:read(c.eligible_regions_json,[]),prizeSkus:skus(c),prizeValueCents:c.prize_value_cents,claimDays:c.claim_days,unclaimedPolicy:c.unclaimed_policy,entryCount:Number(db.prepare("SELECT COUNT(*) n FROM topreels_giveaway_entries WHERE giveaway_id=?").get(c.id).n),draws:db.prepare("SELECT attempt,entry_count AS entryCount,entries_sha256 AS entriesSha256,selected_entry_id AS selectedEntryId,random_index AS randomIndex,algorithm,drawn_on AS drawnOn FROM topreels_giveaway_draws WHERE giveaway_id=? ORDER BY attempt").all(c.id),claims:db.prepare("SELECT x.id,x.status,x.sku,x.claim_deadline AS claimDeadline,u.email FROM topreels_giveaway_claims x JOIN users u ON u.id=x.user_id WHERE x.giveaway_id=? ORDER BY x.created_on DESC").all(c.id),audit:db.prepare("SELECT action,actor,metadata_json AS metadata,created_on AS createdOn FROM topreels_giveaway_audit WHERE giveaway_id=? ORDER BY id DESC LIMIT 50").all(c.id)}));
    const catalog=db.prepare("SELECT sku,name,hostname FROM topreels_inventory WHERE status='available' AND server_locked=0 ORDER BY sku").all();return out(res,200,{ok:true,campaigns,availableCatalog:catalog});
  });
  app.post("/api/admin/topreels/giveaway/campaigns",(req,res)=>{
    if(!topReelsCustomerCors(req,res))return out(res,403,{ok:false,error:"origin not allowed"});if(!isTopReelsOwner(req))return out(res,403,{ok:false,error:"TopReels owner sign-in required"});
    const b=req.body||{},id=crypto.randomUUID(),title=String(b.title||"").trim().slice(0,120),sponsor=String(b.sponsor||"").trim().slice(0,160),rulesUrl=String(b.rulesUrl||"").trim(),version=String(b.rulesVersion||"").trim().slice(0,80),legal=String(b.legalReviewRef||"").trim().slice(0,500),opens=iso(b.opensAt),closes=iso(b.closesAt),age=Number(b.minAge),regions=Array.isArray(b.eligibleRegions)?[...new Set(b.eligibleRegions.map(x=>String(x).trim().toUpperCase()))]:[],prize=Array.isArray(b.prizeSkus)?[...new Set(b.prizeSkus.map(x=>String(x).trim().toUpperCase()))]:[],value=Number(b.prizeValueCents),days=Number(b.claimDays),policy=String(b.unclaimedPolicy||"");
    if(!title||!sponsor||!/^https:\/\//i.test(rulesUrl)||!version||!legal||!opens||!closes||Date.parse(closes)<=Date.parse(opens)||!Number.isInteger(age)||age<18||age>99||!regions.length||regions.some(x=>!/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/.test(x))||!prize.length||!Number.isSafeInteger(value)||value<1||!Number.isInteger(days)||days<1||days>60||!["no_award","alternate"].includes(policy))return out(res,400,{ok:false,error:"Complete sponsor, HTTPS rules URL/version, legal review reference, dates, adult age minimum, eligible locations, available prize SKUs, prize value, claim window, and unclaimed-winner policy."});
    const available=db.prepare("SELECT sku FROM topreels_inventory WHERE status='available' AND server_locked=0").all().map(x=>x.sku);if(prize.some(x=>!available.includes(x)))return out(res,409,{ok:false,error:"Every prize build must be available and unlocked."});
    try{db.prepare("INSERT INTO topreels_giveaways(id,status,title,sponsor,rules_url,rules_version,legal_review_ref,opens_at,closes_at,min_age,eligible_regions_json,prize_skus_json,prize_value_cents,claim_days,unclaimed_policy,created_by) VALUES(?,'draft',?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id,title,sponsor,rulesUrl,version,legal,opens,closes,age,JSON.stringify(regions),JSON.stringify(prize),value,days,policy,getTopReelsOwnerEmail(req)||"owner");audit(id,"campaign_draft_created",getTopReelsOwnerEmail(req),{title,prizeSkus:prize});return out(res,201,{ok:true,id,status:"draft"})}catch{return out(res,503,{ok:false,error:"Giveaway draft could not be saved."})}
  });
  app.post("/api/admin/topreels/giveaway/campaigns/:id/open",(req,res)=>{
    if(!topReelsCustomerCors(req,res))return out(res,403,{ok:false,error:"origin not allowed"});if(!isTopReelsOwner(req))return out(res,403,{ok:false,error:"TopReels owner sign-in required"});
    if(req.body?.confirmation!=="I CONFIRM LEGAL REVIEW")return out(res,400,{ok:false,error:"Owner confirmation of completed written legal review is required."});
    const c=byId(String(req.params.id||""));if(!c||c.status!=="draft")return out(res,404,{ok:false,error:"Draft giveaway not found."});
    if(Date.parse(c.closes_at)<=Date.now()||Date.parse(c.closes_at)<=Date.parse(c.opens_at))return out(res,409,{ok:false,error:"Giveaway dates are invalid or the deadline has passed."});
    if(db.prepare("SELECT 1 FROM topreels_giveaways WHERE status IN ('open','winner_selected','claimed') LIMIT 1").get())return out(res,409,{ok:false,error:"Another giveaway is active or awaiting fulfillment."});
    try{db.exec("BEGIN IMMEDIATE");const fresh=byId(c.id);if(!fresh||fresh.status!=="draft"){db.exec("ROLLBACK");return out(res,409,{ok:false,error:"Draft changed; refresh and try again."})}const pool=skus(fresh),marks=pool.map(()=>"?").join(","),available=db.prepare("SELECT sku FROM topreels_inventory WHERE sku IN ("+marks+") AND status='available' AND server_locked=0").all(...pool).map(x=>x.sku);if(available.length!==pool.length){db.exec("ROLLBACK");return out(res,409,{ok:false,error:"Prize catalog changed. Save a new draft with currently available, unlocked builds."})}db.prepare("UPDATE topreels_inventory SET status='reserved_giveaway' WHERE sku IN ("+marks+") AND status='available' AND server_locked=0").run(...pool);const opened=db.prepare("UPDATE topreels_giveaways SET status='open',updated_on=datetime('now') WHERE id=? AND status='draft'").run(c.id);if(!opened.changes){db.exec("ROLLBACK");return out(res,409,{ok:false,error:"Draft could not be opened."})}audit(c.id,"entries_opened",getTopReelsOwnerEmail(req),{opensAt:c.opens_at,closesAt:c.closes_at,rulesVersion:c.rules_version,reservedSkus:pool});db.exec("COMMIT");return out(res,200,{ok:true,id:c.id,status:"open",reservedPrizeCount:pool.length})}catch{try{db.exec("ROLLBACK")}catch{}return out(res,503,{ok:false,error:"Could not open the giveaway and reserve its prize catalog."})}
  });
  app.post("/api/admin/topreels/giveaway/:id/fulfill",async(req,res)=>{
    if(!topReelsCustomerCors(req,res))return out(res,403,{ok:false,error:"origin not allowed"});if(!isTopReelsOwner(req))return out(res,403,{ok:false,error:"TopReels owner sign-in required"});
    const c=byId(String(req.params.id||"")),url=String(req.body?.url||"").trim(),expected=String(req.body?.expectedText||"").trim().slice(0,120);if(!c||c.status!=="claimed"||!/^https:\/\//i.test(url)||expected.length<3)return out(res,409,{ok:false,error:"A claimed prize, HTTPS URL, and expected site identity are required."});
    const claim=db.prepare("SELECT * FROM topreels_giveaway_claims WHERE giveaway_id=? AND status='chosen'").get(c.id);if(!claim)return out(res,404,{ok:false,error:"Chosen prize claim not found."});
    try{const check=await probeIdentity(url,expected);if(!check.ok)return out(res,409,{ok:false,error:"Prize site needs HTTPS HTTP 200 and matching site identity.",httpStatus:check.status});db.exec("BEGIN IMMEDIATE");const fresh=db.prepare("SELECT id FROM topreels_giveaway_claims WHERE id=? AND status='chosen'").get(claim.id);if(!fresh){db.exec("ROLLBACK");return out(res,409,{ok:false,error:"Prize claim changed; refresh."})}db.prepare("UPDATE topreels_giveaway_claims SET status='fulfilled',site_url=?,verified_at=datetime('now') WHERE id=?").run(url,claim.id);const item=db.prepare("UPDATE topreels_inventory SET status='given_away' WHERE sku=? AND status='reserved_giveaway' AND server_locked=0").run(claim.sku);if(!item.changes){db.exec("ROLLBACK");return out(res,409,{ok:false,error:"The selected inventory is no longer reserved. Fulfillment remains pending."})}db.prepare("UPDATE topreels_giveaways SET status='fulfilled',updated_on=datetime('now') WHERE id=?").run(c.id);audit(c.id,"prize_fulfilled",getTopReelsOwnerEmail(req),{sku:claim.sku,url,httpStatus:200,identityVerified:true});db.exec("COMMIT");return out(res,200,{ok:true,status:"fulfilled",url,httpStatus:200,identityVerified:true})}catch(e){try{db.exec("ROLLBACK")}catch{}return out(res,503,{ok:false,error:"Final site could not be verified or fulfillment recorded."})}
  });
  app.post("/api/admin/topreels/giveaway/:id/cancel",(req,res)=>{
    if(!topReelsCustomerCors(req,res))return out(res,403,{ok:false,error:"origin not allowed"});if(!isTopReelsOwner(req))return out(res,403,{ok:false,error:"TopReels owner sign-in required"});
    const c=byId(String(req.params.id||""));if(!c||!["draft","open"].includes(c.status))return out(res,409,{ok:false,error:"Only a draft or open giveaway can be canceled."});try{db.exec("BEGIN IMMEDIATE");db.prepare("UPDATE topreels_giveaways SET status='cancelled',updated_on=datetime('now') WHERE id=?").run(c.id);db.prepare("UPDATE topreels_inventory SET status='available' WHERE sku IN ("+skus(c).map(()=>"?").join(",")+") AND status='reserved_giveaway'").run(...skus(c));audit(c.id,"campaign_cancelled",getTopReelsOwnerEmail(req),{reason:String(req.body?.reason||"").slice(0,300)});db.exec("COMMIT");return out(res,200,{ok:true,status:"cancelled"})}catch{try{db.exec("ROLLBACK")}catch{}return out(res,503,{ok:false,error:"Campaign cancellation could not safely release its reserved prize inventory."})}
  });
}