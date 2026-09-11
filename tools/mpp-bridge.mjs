import http from "node:http";
import {mkdtemp,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,basename} from "node:path";
import {convert} from "@byteink/mppjs";

const HOST="127.0.0.1",PORT=Number(process.env.MPP_BRIDGE_PORT||8765),MAX=250*1024*1024;
function cors(res){res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type,X-Filename");res.setHeader("Access-Control-Allow-Private-Network","true");res.setHeader("Cache-Control","no-store")}
function send(res,status,body,type="text/plain; charset=utf-8"){cors(res);res.statusCode=status;res.setHeader("Content-Type",type);res.end(body)}
function safeName(raw){let name="schedule.mpp";try{name=decodeURIComponent(String(raw||name))}catch{}return basename(name).replace(/[^a-zA-Z0-9._ -]/g,"_")||"schedule.mpp"}
async function collect(req){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>MAX)throw new Error("MPP file exceeds the 250 MB local bridge limit.");chunks.push(c)}return Buffer.concat(chunks)}
const server=http.createServer(async(req,res)=>{
  if(req.method==="OPTIONS"){cors(res);res.statusCode=204;res.end();return}
  if(req.method==="GET"&&req.url==="/health"){send(res,200,JSON.stringify({ok:true,message:"Local MPP parser is ready",version:"1.3.0"}),"application/json");return}
  if(req.method!=="POST"||req.url!=="/convert"){send(res,404,"Not found");return}
  let dir="";
  try{
    const data=await collect(req);if(!data.length)throw new Error("No MPP file data received.");dir=await mkdtemp(join(tmpdir(),"pcai-mpp-"));
    const input=join(dir,safeName(req.headers["x-filename"]));const output=join(dir,"converted.xml");await writeFile(input,data);
    await convert(input,output,{timeoutMs:80000});const xml=await readFile(output,"utf8");if(!xml.includes("<Project"))throw new Error("Converter did not return an MSPDI Project XML document.");send(res,200,xml,"application/xml; charset=utf-8");
  }catch(error){console.error(error);send(res,500,error?.message||String(error))}finally{if(dir)await rm(dir,{recursive:true,force:true}).catch(()=>{})}
});
server.listen(PORT,HOST,()=>{console.log(`Project Controls MPP bridge running at http://${HOST}:${PORT}`);console.log("Leave this window open while importing .mpp files into the GitHub Pages site.")});
