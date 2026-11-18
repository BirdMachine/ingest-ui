import axios from 'axios';
import {useState} from 'react';

export function prepareDemo() {
  let session=sessionStorage.getItem('ingest-demo-session');
  if(!session){session=crypto.randomUUID();sessionStorage.setItem('ingest-demo-session',session);}
  axios.interceptors.request.use(config=>{
    if(!new URL(config.url,location.origin).pathname.startsWith('/mock/')) throw new Error('Demo mode blocks non-mock API requests.');
    config.headers['X-Demo-Session']=session;
    return config;
  });
  localStorage.setItem('info',JSON.stringify({name:'Demo Researcher',displayname:'Demo Researcher',email:'demo@example.invalid',groups_token:'synthetic-demo-token',uuid:session}));
}
export function DemoBanner() {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function reset(){
    setBusy(true);
    try{await axios.post('/mock/reset',{});location.assign('/');}catch{setError('Reset failed. Please try again.');setBusy(false);}
  }
  return <aside style={{background:'#fff0c2',color:'#322b10',padding:'10px 18px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',fontSize:14,borderBottom:'1px solid #d0ac55'}} aria-label="Demo environment">
    <strong>Portfolio demo · fictional data</strong><span>Search, view, create and edit simulated records. Changes expire after one hour of inactivity.</span>
    <button onClick={reset} disabled={busy} style={{marginLeft:'auto'}}>{busy?'Resetting…':'Reset demo'}</button>
    {error && <span role="alert">{error}</span>}
  </aside>;
}
