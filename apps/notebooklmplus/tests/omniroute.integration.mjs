import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { embedAiTexts, listAiModels, streamAiChat, testAiConnection } from '../js/ai.js';

let server, endpoint, lastAuth='';
function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Access-Control-Allow-Origin','*');res.end(JSON.stringify(body));}

test.before(async()=>{
  server=http.createServer(async(req,res)=>{
    lastAuth=req.headers.authorization||'';
    let body=''; for await (const chunk of req) body+=chunk;
    if (!/^Bearer\s+\S+/.test(lastAuth)) return json(res,401,{error:'missing bearer'});
    if(req.url==='/v1/models') return json(res,200,{data:[{id:'auto'},{id:'felo/auto'},{id:'embed-route'}]});
    if(req.url==='/v1/embeddings'){
      const payload=JSON.parse(body||'{}'); const inputs=Array.isArray(payload.input)?payload.input:[payload.input];
      return json(res,200,{data:inputs.map((_,i)=>({index:i,embedding:[0.2,i,0.8]}))});
    }
    if(req.url==='/v1/chat/completions'){
      const payload=JSON.parse(body||'{}');
      assert.equal(payload.model,'auto');
      res.statusCode=200;res.setHeader('Content-Type','text/event-stream');res.setHeader('Access-Control-Allow-Origin','*');
      res.write('data: '+JSON.stringify({choices:[{delta:{content:'Omni'}}]})+'\n\n');
      res.write('data: '+JSON.stringify({choices:[{delta:{content:'Route'}}]})+'\n\n');
      res.end('data: [DONE]\n\n'); return;
    }
    return json(res,404,{error:'not found'});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  endpoint=`http://127.0.0.1:${server.address().port}/v1`;
});
test.after(async()=>new Promise(resolve=>server.close(resolve)));

test('OmniRoute keyless mode sends a non-empty local placeholder bearer',async()=>{
  const out=await testAiConnection({provider:'omniroute',endpoint,apiKey:'',timeoutSeconds:5});
  assert.equal(out.ok,true); assert.equal(out.label,'OmniRoute online'); assert.equal(lastAuth,'Bearer sk_omniroute');
});

test('OmniRoute discovers auto routes',async()=>{
  const models=await listAiModels({provider:'omniroute',endpoint,apiKey:'',timeoutSeconds:5});
  assert.deepEqual(models.map(x=>x.name),['auto','felo/auto','embed-route']);
});

test('OmniRoute auto chat streams through OpenAI-compatible interface',async()=>{
  const full=await streamAiChat({provider:'omniroute',endpoint,apiKey:'',model:'auto',messages:[{role:'user',content:'hi'}],timeoutSeconds:5});
  assert.equal(full,'OmniRoute');
});

test('OmniRoute embeddings work when an embedding-capable route is selected',async()=>{
  const vectors=await embedAiTexts({provider:'omniroute',endpoint,apiKey:'',model:'embed-route',texts:['a','b'],timeoutSeconds:5});
  assert.deepEqual(vectors,[[0.2,0,0.8],[0.2,1,0.8]]);
});
