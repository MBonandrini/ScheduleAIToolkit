import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fetchWebPage, fetchYouTubeTranscript, searchWeb, setResearchTokens, transcribeAudio } from '../js/web_tools.js';

let server; let base;
before(async () => {
  server = http.createServer(async (req,res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Access-Control-Allow-Origin','*');
    if (url.pathname === '/search') {
      assert.match(url.searchParams.get('q') || url.searchParams.get('query') || '', /project/i);
      assert.equal(req.headers.authorization, 'Bearer research-secret');
      res.setHeader('content-type','application/json');
      return res.end(JSON.stringify({ results:[{ title:'Result A', url:`${base}/page`, snippet:'Useful evidence' }] }));
    }
    if (url.pathname === '/page') {
      res.setHeader('content-type','application/json');
      return res.end(JSON.stringify({ title:'Fetched Page', text:'Primary web evidence about Project Alpha.' }));
    }
    if (url.pathname === '/transcript') {
      assert.equal(req.headers.authorization, 'Bearer transcript-secret');
      res.setHeader('content-type','application/json');
      return res.end(JSON.stringify({ title:'Video', text:'Transcript text', segments:[{start:0,text:'Transcript text'}] }));
    }
    if (url.pathname === '/transcribe') {
      assert.equal(req.method,'POST'); assert.equal(req.headers.authorization,'Bearer transcription-secret');
      let bytes=0; for await (const chunk of req) bytes += chunk.length; assert.ok(bytes>0);
      res.setHeader('content-type','application/json');
      return res.end(JSON.stringify({ text:'Audio transcript text' }));
    }
    res.statusCode=404; res.end('not found');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${server.address().port}`;
  setResearchTokens({ research:'research-secret', transcript:'transcript-secret', transcription:'transcription-secret' });
});
after(async()=>{ await new Promise(resolve=>server.close(resolve)); });

test('generic search endpoint normalizes result rows and authenticates', async () => {
  const rows=await searchWeb({query:'Project Alpha',endpoint:`${base}/search?q={q}`,maxResults:5});
  assert.equal(rows.length,1); assert.equal(rows[0].title,'Result A'); assert.equal(rows[0].url,`${base}/page`);
});

test('web page JSON/proxy style response becomes readable source text', async () => {
  const page=await fetchWebPage({url:`${base}/page`}); assert.equal(page.title,'Fetched Page'); assert.match(page.text,/Project Alpha/);
});

test('YouTube transcript endpoint is authenticated and normalized', async () => {
  const t=await fetchYouTubeTranscript({url:'https://youtube.com/watch?v=abc',endpoint:`${base}/transcript?url={url}`});
  assert.equal(t.title,'Video'); assert.equal(t.text,'Transcript text'); assert.equal(t.segments.length,1);
});

test('audio transcription posts multipart file and returns text', async () => {
  const file=new File([new Uint8Array([1,2,3,4])],'sample.mp3',{type:'audio/mpeg'});
  const t=await transcribeAudio({file,endpoint:`${base}/transcribe`,timeoutSeconds:10}); assert.equal(t.text,'Audio transcript text');
});
