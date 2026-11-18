import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDemoApi} from './api.mjs';
import {mockMiddleware} from './node.mjs';
const root=fileURLToPath(new URL('../src/build/',import.meta.url));
const middleware=mockMiddleware(createDemoApi());
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
const server=createServer((req,res)=>middleware(req,res,async()=>{
  try {
    const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(path!==root.replace(/\/$/,'') && !path.startsWith(root.replace(/\/$/,'')+sep)) {res.writeHead(403);res.end();return;}
    let target=path;
    try{if(!(await stat(target)).isFile()) throw new Error();}catch{
      if(extname(path)){res.writeHead(404);res.end();return;}
      target=resolve(root,'index.html');
    }
    const data=await readFile(target);
    res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream'});res.end(data);
  }catch{res.writeHead(500);res.end('Build the demo first: npm --prefix src run build:demo');}
}));
server.listen(Number(process.env.PORT||8585),'0.0.0.0',()=>console.log('Ingest UI synthetic demo listening on port',server.address().port));
