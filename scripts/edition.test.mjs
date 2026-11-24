import { test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../worker/edition.mjs';
const origin='https://atlas.example';
const recent='2026-01-01';
const national='https://newsonair.gov.in/national-story/';
const xml=link=>'<rss><channel><item><title>Monsoon report</title><description><![CDATA[<p>Forecast for the week.</p>]]></description><link>'+link+'</link><pubDate>Thu, 1 Jan 2026 10:00:00 +0530</pubDate></item></channel></rss>';
const wp=JSON.stringify([{title:{rendered:'Andhra Pradesh budget'},excerpt:{rendered:'<p>Legislature met.</p>'},date_gmt:recent+'T10:00:00',link:'https://newsonair.gov.in/ap-budget/'}]);
const district='<div class="pressRelease-content"><h2>గ్రామ పంచాయతీ ఎన్నికలు</h2><strong>Published on:</strong>01/01/2026<p>Information</p><a href="https://westgodavari.ap.gov.in/ap-release/">View</a></div>';
const pib='<ul><li><a href="/PressReleseDetail.aspx?PRID=100">Climate report</a><span>Posted on: 01 Jan 2026</li></ul>';

test('edition renders five official sources; strips markup, rejects unsafe URLs, caches and preserves archive', async () => {
  const savedFetch=globalThis.fetch, savedCaches=globalThis.caches;
  const cache=new Map();
  globalThis.caches={default:{
    async match(key){return cache.get(key.url)?.clone()},
    async put(key,r){cache.set(key.url,r)}
  }};
  let calls=0,offline=false;
  globalThis.fetch=async url=>{
    calls++;
    if(offline)throw Error('offline');
    if(url.includes('wp-json'))return new Response(wp);
    if(url.includes('westgodavari'))return new Response(district);
    if(url.includes('pib.gov.in'))return new Response(pib);
    if(url.includes('/international/'))return new Response(xml('https://stranger.invalid/'));
    return new Response(xml(national));
  };
  try {
    const load=async ()=> (await app.fetch(new Request(origin+'/api/edition'))).json();
    const result=await load();
    assert.equal(result.items.length,4);
    assert.equal(result.sources.find(s=>s.region==='World').status,'empty');
    const story=result.items.find(i=>i.url===national);
    assert.equal(story.summary,'Forecast for the week.');
    assert.equal(story.date,recent);
    assert.equal(story.topic,'Geography');
    assert.match(story.id,/^[\da-f]{20}$/);
    await load(); assert.equal(calls,5);
    for(const k of cache.keys()) if(k.includes('?day='))cache.delete(k);
    offline=true;
    const fallback=await load();
    assert.deepEqual(fallback.items,result.items);
    assert.ok(fallback.sources.every(s=>s.status==='unavailable'));
    assert.equal((await app.fetch(new Request(origin+'/other'))).status,404);
    assert.equal((await app.fetch(new Request(origin+'/api/edition',{method:'POST'}))).status,405);
  } finally {globalThis.fetch=savedFetch;globalThis.caches=savedCaches;}
});
