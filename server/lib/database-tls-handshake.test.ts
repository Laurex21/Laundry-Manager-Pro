import assert from 'node:assert/strict';
import tls from 'node:tls';
import fs from 'node:fs';
import {once} from 'node:events';
import {secureDatabaseConfig} from './database-tls';
const dir=process.env.TLS_TEST_CERT_DIR;
if(!dir)throw Error('TLS_TEST_CERT_DIR required: isolated disposable certificate only');
const cert=fs.readFileSync(dir+'/cert.pem','utf8');
const server=tls.createServer({key:fs.readFileSync(dir+'/key.pem'),cert},socket=>socket.end());
server.on('tlsClientError',()=>{});
server.listen(0,'127.0.0.1');await once(server,'listening');
async function connect(ca?:string,servername='localhost') {
 const ssl=secureDatabaseConfig({DATABASE_URL:'postgresql://fake:fake@localhost/test',NODE_ENV:'production',DATABASE_SSL_CA:ca}).ssl as tls.ConnectionOptions;
 return new Promise<void>((resolve,reject)=>{
  const socket=tls.connect({...ssl,host:'127.0.0.1',port:(server.address() as any).port,servername},()=>{socket.end();resolve();});
  socket.on('error',reject);socket.setTimeout(3000,()=>socket.destroy(Error('TLS test timeout')));
 });
}
try {
 await assert.rejects(connect(),e=>['DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN'].includes((e as any).code));
 await connect(cert);
 await assert.rejects(connect(cert,'wrong.example.invalid'),e=>(e as any).code==='ERR_TLS_CERT_ALTNAME_INVALID');
 console.log('PASS: untrusted certificate rejected, explicit trusted CA accepted, wrong hostname rejected (local TLS only)');
} finally {server.close();}
