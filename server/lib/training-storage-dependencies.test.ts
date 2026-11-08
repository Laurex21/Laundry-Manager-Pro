import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

for(const dependency of ['gaxios','teeny-request']){
 test(`${dependency}: corrected uuid retains CommonJS v4 and rejects truncated output`,()=>{
  const dependencyRequire=createRequire(require.resolve(dependency));
  const uuid=dependencyRequire('uuid');
  // Both storage transports use require('uuid').v4() for multipart boundaries.
  const boundary=uuid.v4();
  assert.equal(uuid.validate(boundary),true);
  assert.equal(uuid.version(boundary),4);
  const buffer=new Uint8Array(24);uuid.v4({},buffer,8);
  assert.equal(uuid.version(uuid.stringify(buffer,8)),4);
  for(const method of ['v3','v5'])assert.throws(()=>uuid[method]('training',uuid[method].DNS,new Uint8Array(8),4),RangeError);
  assert.throws(()=>uuid.v6({},new Uint8Array(8),4),RangeError);
  assert.ok(dependencyRequire(dependency));
 });
}
