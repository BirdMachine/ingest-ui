// Synthetic data only. This module never calls or proxies an upstream service.
export const groups = [
  {uuid:'00000000-0000-4000-8000-000000000001', name:'hubmap-demo-provider', shortname:'TMC Demo Lab', displayname:'TMC Demo Lab', data_provider:true},
  {uuid:'00000000-0000-4000-8000-000000000002', name:'hubmap-demo-partner', shortname:'RTI Demo Partner', displayname:'RTI Demo Partner', data_provider:true},
];
export const organs = {LK:'Left Kidney', RK:'Right Kidney', LI:'Liver', LU:'Lung', HT:'Heart'};
const datasetTypes = ['RNAseq','snRNAseq','CODEX'].map(dataset_type => ({dataset_type, assaytypes:[dataset_type], primary:true}));
const clone = x => structuredClone(x);
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});

export function seedRecords() {
  const rows = [];
  for (let n=1;n<=60;n++) {
    const entity_type = n<=12 ? 'Donor' : n<=30 ? 'Sample' : n<=54 ? 'Dataset' : 'Upload';
    const group = groups[n%2];
    const organ = Object.keys(organs)[n%5];
    const uuid = n.toString(16).padStart(32,'0');
    const timestamp = Date.UTC(2026,6,1+n%28,12);
    rows.push({uuid, hubmap_id:`HBM${String(n).padStart(3,'0')}.DEMO.001`, entity_type,
      group_uuid:group.uuid, group_name:group.displayname, lab_name:group.displayname,
      label:`Demo ${entity_type.toLowerCase()} ${n}`, title:`Synthetic ${organs[organ]} study ${n}`,
      description:`Fictional ${entity_type.toLowerCase()} record for a portfolio demonstration. No participant data.`,
      created_timestamp:timestamp, last_modified_timestamp:timestamp,
      created_by_user_displayname:'Demo Researcher', created_by_user_email:'demo@example.invalid',
      last_modified_user_displayname:'Demo Researcher', last_modified_user_email:'demo@example.invalid',
      data_access_level:'consortium', status:entity_type==='Dataset' ? ['New','QA','Processing'][n%3] : 'New',
      display_subtype:entity_type==='Sample' ? organs[organ] : entity_type==='Dataset' ? 'RNAseq' : entity_type,
      lab_donor_id:`DEMO-DONOR-${n}`, lab_tissue_sample_id:`DEMO-SAMPLE-${n}`, lab_dataset_id:`DEMO-DATASET-${n}`,
      submission_id:`DEMO-${n}`, protocol_url:'https://doi.org/10.17504/protocols.io.synthetic-demo',
      sample_category:'organ', organ, intended_organ:organ, dataset_type:'RNAseq', intended_dataset_type:'RNAseq',
      contains_human_genetic_sequences:false, ingest_task:'', assigned_to_group_name:group.displayname,
      direct_ancestors:[], ancestors:[], descendants:[], datasets:[], files:[], metadata:{},
      contacts:[], contributors:[], previous_revision_uuid:null,
    });
  }
  for (const row of rows) {
    if(row.entity_type!=='Donor') delete row.lab_donor_id;
    if(row.entity_type!=='Sample') {delete row.lab_tissue_sample_id;delete row.sample_category;}
    if(row.entity_type!=='Dataset') {delete row.lab_dataset_id;delete row.dataset_type;}
    if(row.entity_type!=='Upload') {delete row.intended_organ;delete row.intended_dataset_type;}
    if(row.entity_type==='Donor' || row.entity_type==='Upload') delete row.organ;
  }
  // A small lineage to demonstrate links and selecting a sample parent.
  for (const row of rows.filter(x=>x.entity_type==='Sample')) row.direct_ancestors=[clone(rows[(parseInt(row.uuid,16)-13)%12])];
  for (const row of rows.filter(x=>x.entity_type==='Dataset')) row.direct_ancestors=[clone(rows[12+(parseInt(row.uuid,16)-31)%18])];
  return rows;
}

const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
function values(row, field) {
  const keys = field.replace(/\.keyword$/, '').replace(/\^[\d.]+$/, '').split('.');
  return keys.reduce((v,key)=>v.flatMap(item=>item?.[key] ?? []),[row]).flat(Infinity);
}
function textMatches(row, query, fields) {
  const haystack = list(fields).length ? list(fields).flatMap(field=>values(row,field)).join(' ') : JSON.stringify(row);
  return String(query).split(/\s+OR\s+/i).some(term=> {
    // Support the wildcard syntax the UI sends; escape everything else.
    const escaped = term.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*');
    return new RegExp(escaped,'i').test(haystack);
  });
}
export function matches(row, query) {
  if (!query || Object.keys(query).length===0 || query.match_all) return true;
  if (query.bool) {
    const b = query.bool;
    const minimum = b.minimum_should_match ?? (b.should && !b.must && !b.filter ? 1 : 0);
    return [...list(b.must),...list(b.filter)].every(q=>matches(row,q)) &&
      list(b.must_not).every(q=>!matches(row,q)) && list(b.should).filter(q=>matches(row,q)).length>=Number(minimum);
  }
  if (query.range) return Object.entries(query.range).every(([key,limits])=>values(row,key).some(v=>
    (limits.gte===undefined || v>=limits.gte) && (limits.lte===undefined || v<=limits.lte)));
  if (query.terms) return Object.entries(query.terms).every(([key,terms])=>values(row,key).some(v=>terms.includes(v)));
  if (query.term) return Object.entries(query.term).every(([key,v])=>values(row,key).includes(v?.value ?? v));
  if (query.match) return Object.entries(query.match).every(([key,q])=>textMatches(row,q?.query ?? q,[key]));
  const q = query.multi_match || query.query_string || query.simple_query_string;
  if (q) return textMatches(row,q.query,q.fields);
  throw new Error('This search clause is not supported by the demo API.');
}

export function createDemoApi() {
  const sessions = new Map();
  return async request => {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/,'');
    if (!path.startsWith('/mock/')) return json({error:'Not a mock API route'},404);
    const session = request.headers.get('x-demo-session') || 'standalone';
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(session)) return json({error:'Invalid demo session'},400);
    const now = Date.now();
    for (const [key,state] of sessions) if (now-state.touched>3600000) sessions.delete(key);
    if (!sessions.has(session)) {
      if(sessions.size>=128) sessions.delete(sessions.keys().next().value);
      sessions.set(session,{rows:seedRecords(),touched:now});
    }
    const state = sessions.get(session);
    state.touched=now;
    const rows = state.rows;
    const method = request.method;
    if (path==='/mock/reset' && method==='POST') {state.rows=seedRecords();return json({reset:true});}
    if (path==='/mock/status' && method==='GET') return json({entity_api:{neo4j_connection:true},ingest_api:{neo4j_connection:true},ontology_api:{neo4j_connection:true},search_api:{elasticsearch_status:'green'}});
    if (path==='/mock/ingest/login' || path==='/mock/ingest/logout') return new Response(null,{status:302,headers:{Location:'/'}});
    if (path==='/mock/ingest/metadata/usergroups' || path==='/mock/ingest/metadata/data-provider-groups') return json({groups:clone(groups)});
    if (path==='/mock/ontology/organs/by-code') return json(organs);
    if (path==='/mock/ontology/organs') return json(Object.entries(organs).map(([code,term])=>({organ_code:code,organ_term:term,term,code,rui_code:code,rui_supported:false})));
    if (path==='/mock/ontology/dataset-types') return json(datasetTypes);
    if (path==='/mock/ontology/valueset') return json(datasetTypes.map((x,i)=>({code:String(i),term:x.dataset_type})));
    if (path==='/mock/search/assaytype') return json({result:datasetTypes.map(x=>({name:x.dataset_type,description:x.dataset_type,primary:true}))});
    if (path==='/mock/ingest/has-pipeline-test-privs') return json(false);
    let body = {};
    if (['POST','PUT'].includes(method)) {
      if (request.headers.get('content-type')?.includes('multipart')) return json({error:'Bulk metadata and file transfers are not simulated in this demo.'},501);
      try {body = await request.json();} catch {return json({error:'Expected a JSON body'},400);}
    }
    if (path==='/mock/search/search' && method==='POST') {
      try {
        const filtered=rows.filter(row=>matches(row,body.query));
        for(const sort of [...list(body.sort)].reverse()) for(const [key,option] of Object.entries(sort)) {
          const direction=(option?.order ?? option)==='desc' ? -1 : 1;
          filtered.sort((a,b)=>String(values(a,key)[0]??'').localeCompare(String(values(b,key)[0]??''),undefined,{numeric:true})*direction);
        }
        const from=Math.max(0,Number(body.from)||0), size=Math.min(1000,Math.max(0,Number(body.size ?? 100)));
        return json({took:1,hits:{total:{value:filtered.length,relation:'eq'},hits:filtered.slice(from,from+size).map(row=>({_id:row.uuid,_source:clone(row)}))}});
      } catch(error) {return json({error:error.message},400);}
    }
    const createType = path.match(/^\/mock\/entity\/entities\/(Donor|Sample|Dataset|Upload|Publication|Collection|Epicollection)$/i)?.[1] ||
      ({'/mock/ingest/uploads':'Upload','/mock/ingest/datasets':'Dataset'})[path];
    if (createType && method==='POST') {
      const type = createType[0].toUpperCase()+createType.slice(1).toLowerCase();
      const required = type==='Donor' ? ['label','protocol_url','group_uuid'] : type==='Upload' ? ['title','description','intended_organ','intended_dataset_type','group_uuid'] : ['group_uuid'];
      const missing = required.filter(key=>!body[key]);
      if (missing.length) return json({error:`Required: ${missing.join(', ')}`},400);
      const uuid = crypto.randomUUID().replaceAll('-','');
      const row={...clone(seedRecords().find(x=>x.entity_type===type) || seedRecords()[0]), ...body,
        uuid, hubmap_id:`HBM${String(900+rows.length)}.DEMO.001`,entity_type:type,status:'New',
        group_name:groups.find(g=>g.uuid===body.group_uuid)?.displayname || groups[0].displayname,
        created_timestamp:now,last_modified_timestamp:now};
      rows.push(row);return json(row);
    }
    const id=path.match(/^\/mock\/(entity|ingest)\/(entities|datasets|uploads|specimens)\/([^/]+)/)?.[3];
    const row = rows.find(x=>x.uuid===id || x.hubmap_id===id);
    if (id && !row) return json({error:'Fictional record not found'},404);
    if (row) {
      if (path.endsWith('/allowable-edit-states')) return json({has_admin_priv:false,has_publish_priv:false,has_submit_priv:false,has_write_priv:true});
      if (path.endsWith('/ancestor-organs')) return json(row.organ?[{organ:row.organ}]:[]);
      if (path.endsWith('/ingest-group-ids')) return json({ingest_group_ids:[{submission_id:row.submission_id,group_uuid:row.group_uuid}]});
      if (path.endsWith('/globus-url')) return json({error:'Globus file transfer is unavailable in the demo.'},501);
      if (path===`/mock/entity/entities/${id}`) {
        if (method==='GET') return json(row);
        if (method==='PUT') {const {uuid,hubmap_id,entity_type}=row; Object.assign(row,body,{uuid,hubmap_id,entity_type,last_modified_timestamp:now});return json(row);}
      }
    }
    const ancestorId=path.match(/^\/mock\/entity\/ancestors\/([^/]+)$/)?.[1];
    if (ancestorId) return json(rows.find(x=>x.uuid===ancestorId || x.hubmap_id===ancestorId)?.direct_ancestors || []);
    return json({error:`This action is not simulated: ${method} ${path}. Search, record viewing, creation and editing are supported.`},501);
  };
}
