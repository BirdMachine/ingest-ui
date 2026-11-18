import {Readable} from 'node:stream';
export function mockMiddleware(api) {
  return async (req,res,next) => {
    if (!req.url.startsWith('/mock/')) return next();
    try {
      const chunks=[];
      let length=0;
      for await(const chunk of req) {
        length+=chunk.length;
        if(length>1024*1024) {res.writeHead(413);res.end('Demo request too large');return;}
        chunks.push(chunk);
      }
      const response = await api(new Request(new URL(req.url,'http://localhost'),{
        method:req.method,headers:req.headers,
        ...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})
      }));
      res.writeHead(response.status,Object.fromEntries(response.headers));
      if(response.body) Readable.fromWeb(response.body).pipe(res);else res.end();
    } catch(error) {res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
  };
}
