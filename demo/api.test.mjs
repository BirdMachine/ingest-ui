import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemoApi,groups} from './api.mjs';
const api=createDemoApi();
async function call(path,method='GET',body,session='test') {
  const response=await api(new Request(`http://localhost/mock/${path}`,{method,headers:{'content-type':'application/json','x-demo-session':session},...(body===undefined?{}:{body:JSON.stringify(body)})}));
  return {status:response.status,data:await response.json()};
}
const search=(query={},extra={},session='test')=>call('search/search','POST',{query,...extra},session);
test('search combines filters, date ranges, wildcards, sorting and pagination',async()=>{
  const query={bool:{must:[{match:{entity_type:'Donor OR Sample'}}],filter:[{range:{created_timestamp:{gte:Date.UTC(2026,6,10)}}}],must_not:[{term:{organ:'LI'}}]}};
  const all=await search(query,{sort:[{hubmap_id:'desc'}]});
  assert.equal(all.status,200);
  assert.ok(all.data.hits.total.value>5);
  assert.ok(all.data.hits.hits.every(x=>['Donor','Sample'].includes(x._source.entity_type) && x._source.organ!=='LI'));
  const page=await search(query,{sort:[{hubmap_id:'desc'}],from:2,size:3});
  assert.deepEqual(page.data.hits.hits,all.data.hits.hits.slice(2,5));
  const wild=await search({query_string:{query:'HBM001.*',fields:['hubmap_id.keyword']}});
  assert.equal(wild.data.hits.total.value,1);
  const ids=await search({bool:{should:[{terms:{'hubmap_id.keyword':['HBM001.DEMO.001','HBM002.DEMO.001']}}],minimum_should_match:1}});
  assert.equal(ids.data.hits.total.value,2);
});
test('create and update are visible only in the same session; reset restores seed',async()=>{
  const payload={label:'My demo donor',protocol_url:'https://www.protocols.io/view/example',group_uuid:groups[0].uuid};
  const created=await call('entity/entities/Donor','POST',payload,'writer');
  assert.equal(created.status,200);
  assert.equal((await call(`entity/entities/${created.data.uuid}`,'GET',undefined,'reader')).status,404);
  const edited=await call(`entity/entities/${created.data.uuid}`,'PUT',{description:'Edited',uuid:'override'},'writer');
  assert.equal(edited.data.uuid,created.data.uuid);
  assert.equal(edited.data.description,'Edited');
  assert.equal((await search({}, {},'writer')).data.hits.total.value,61);
  await call('reset','POST',{},'writer');
  assert.equal((await search({}, {},'writer')).data.hits.total.value,60);
});
test('validation, missing records and unsupported actions fail explicitly',async()=>{
  assert.equal((await call('entity/entities/Donor','POST',{})).status,400);
  assert.equal((await call('entity/entities/missing')).status,404);
  assert.equal((await call('ingest/notify','POST',{})).status,501);
  assert.equal((await search({unsupported_clause:{}})).status,400);
  assert.equal((await call('search/search','POST',{},'bad/session')).status,400);
});
