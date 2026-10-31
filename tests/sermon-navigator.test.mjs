import test from "node:test";
import assert from "node:assert/strict";
import {parseFragment} from "parse5";
import {createSatteriMarkdownProcessor} from "@astrojs/markdown-satteri";
import {prepareSermon,PASSAGE_VERSION} from "../src/lib/sermon-passages.ts";
import {currentNavigator,failedNavigatorPoints,navigatorHash,NAVIGATOR_MODEL,NAVIGATOR_VERSION,validatePoints,navigatorCandidates} from "../src/lib/sermon-navigator.ts";

const text = n => n.nodeName==="#text" ? n.value : n.tagName==="br" ? "\n" : (n.childNodes??[]).map(text).join("");
const elements = n => [n,...(n.childNodes??[]).flatMap(elements)];
const body="We are called to forgive one another with humility and compassion.\n\nTrue repentance opens our hearts to receive the mercy of Christ.\n\nGod invites us to leave our shame behind and live with hope.";
const labels=["Forgiveness calls us to respond with humility and compassion.","Repentance opens our hearts to receive the mercy of Christ.","God invites us to leave shame behind and live with hope."];

test("passage anchors preserve rendered text, entities, inline formatting and links",async()=>{
  const source=("Faith &amp; mercy remain **important in every season of our spiritual life**, and [prayer](https://example.com) draws us closer to Christ. ".repeat(25))+"\n\nA final reflection brings us back to the love of God.";
  const prepared=await prepareSermon(source),renderer=await createSatteriMarkdownProcessor({});
  const original=parseFragment((await renderer.render(source)).code),rendered=parseFragment(prepared.html);
  assert.equal(text(rendered),text(original));
  assert(prepared.passages.length>=4);
  assert.equal(new Set(prepared.passages.map(p=>p.id)).size,prepared.passages.length);
  for(const p of prepared.passages){const span=elements(rendered).find(n=>n.attrs?.some(a=>a.name==="id"&&a.value===p.id));assert(span);assert.equal(text(span).trim(),p.text);}
  assert(prepared.html.includes("<strong>"));assert(prepared.html.includes('href="https://example.com"'));
});

test("unchanged passages keep their anchors and repeated passages never duplicate IDs",async()=>{
  const one=await prepareSermon(body),two=await prepareSermon("A newly inserted paragraph begins this sermon.\n\n"+body);
  assert.deepEqual(one.passages.map(p=>p.id),two.passages.slice(1).map(p=>p.id));
  const repeated=await prepareSermon(body+"\n\n"+body);assert.equal(new Set(repeated.passages.map(p=>p.id)).size,6);
});

test("navigator records require three to six distinct short sentences with real destinations",async()=>{
  const {passages}=await prepareSermon(body);
  const points=labels.map((text,i)=>({text,passageId:passages[i].id}));
  assert.deepEqual(validatePoints([...points].reverse(),passages),points);
  assert.deepEqual(navigatorCandidates([...points,{...points[0]},{text:"Broken sentence,",passageId:"missing"}],passages),points);
  assert.throws(()=>navigatorCandidates(points.slice(0,2),passages),/three to six/);
  assert.equal(validatePoints(points.map((p,i)=>i ? p : {...p,text:"Christ says, 'Do not be afraid, but only believe.'"}),passages).length,3);
  assert.throws(()=>validatePoints(points.slice(0,2),passages),/three to six/);
  assert.throws(()=>validatePoints([...points,{...points[0]}],passages),/distinct/);
  assert.throws(()=>validatePoints(points.map((p,i)=>i? p:{...p,passageId:"missing"}),passages),/source passage/);
  assert.throws(()=>validatePoints(points.map((p,i)=>i? p:{...p,text:"God offers mercy to everyone. We should forgive others."}),passages),/one sentence/);
  assert.throws(()=>validatePoints(points.map((p,i)=>i? p:{...p,text:"<script>God offers mercy to everyone who seeks forgiveness.</script>"}),passages),/plain-text/);
});

test("changed transcripts suppress stale navigator links",async()=>{
  const entry={body,data:{archiveId:1,title:"Forgiveness",theme:"Receiving mercy"}},{passages}=await prepareSermon(body);
  const points=labels.map((text,i)=>({text,passageId:passages[i].id}));
  const artifact={schemaVersion:1,promptVersion:NAVIGATOR_VERSION,passageVersion:PASSAGE_VERSION,generationModel:NAVIGATOR_MODEL,verificationModel:"@cf/cloudflare/clef",generatedAt:"",sermons:{"1":{contentHash:navigatorHash(entry),points}}};
  assert.equal(currentNavigator(entry,passages,artifact).length,3);
  assert.deepEqual(currentNavigator({...entry,body:body+" Added text."},passages,artifact),[]);
  assert.deepEqual(currentNavigator(entry,passages,{...artifact,promptVersion:"old"}),[]);
});

test("unsupported or incidental model points fail the verification gate",()=>{
  const points=labels.map((text,i)=>({text,passageId:"p"+i}));
  const score=n=>({score:n,confidence:1,probabilities:{[n]:1}});
  const answers=Object.fromEntries(points.flatMap((_,i)=>[["support_"+i,score(3)],["importance_"+i,score(3)]]));
  assert.deepEqual(failedNavigatorPoints(points,answers),[]);
  answers.support_1=score(1);answers.importance_2=score(0);
  assert.deepEqual(failedNavigatorPoints(points,answers),[1,2]);
});
