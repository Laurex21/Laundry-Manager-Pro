import assert from 'node:assert/strict';
import pg from 'pg';
import { secureDatabaseConfig } from './database-tls';
import { safeRequestLogPath } from './request-log';
const make=(url:string,extra:NodeJS.ProcessEnv={})=>secureDatabaseConfig({DATABASE_URL:url,NODE_ENV:'development',...extra});
for(const query of ['', '?sslmode=require','?sslmode=verify-ca&uselibpqcompat=true','?ssl=no-verify']) {
 const config=make('postgresql://test:fake@db.example.invalid/test'+query);
 const client=new pg.Client(config);
 assert.equal((client as any).connectionParameters.ssl.rejectUnauthorized,true);
 assert.equal((client as any).connectionParameters.ssl.checkServerIdentity,undefined);
}
assert.equal(make('postgresql://test:fake@127.0.0.1/test').ssl,false);
assert.equal((make('postgresql://test:fake@127.0.0.1/test',{NODE_ENV:'production'}).ssl as any).rejectUnauthorized,true);
for(const url of ['postgresql://test:fake@remote.invalid/test?sslmode=disable','postgresql://test:fake@localhost/test?host=remote.invalid','postgresql://test:fake@remote.invalid/test?sslrootcert=/tmp/unknown'])assert.throws(()=>make(url));
assert.throws(()=>make('postgresql://test:fake@remote.invalid/test',{DATABASE_SSL:'false'}));
assert.throws(()=>make('secret-password-invalid'),e=>!String(e).includes('secret-password'));
assert.equal((make('postgresql://test:fake@remote.invalid/test',{DATABASE_SSL_CA:'first\\nsecond'}).ssl as any).ca,'first\nsecond');
for(const route of ['/api/invitations/join/:token','/api/invitations/accept/:token','/api/staff/onboard/:token','/api/public/sales-referral/:code']) {
 const path=route.replace(/:(token|code)/,'SECRET_TOKEN_VALUE');
 assert.equal(safeRequestLogPath(route,path),route);
 assert.ok(!safeRequestLogPath(undefined,path).includes('SECRET_TOKEN_VALUE'));
}
assert.equal(safeRequestLogPath('/api/orders/:id','/api/orders/123'),'/api/orders/:id');
assert.equal(safeRequestLogPath(undefined,'/api/unknown/SECRET?token=SECRET'),'/api/[unmatched-or-blocked]');
console.log('PASS: effective pg TLS settings, local isolation, unsafe overrides refused, CA configuration, matched/blocked/unknown log redaction');

const heliumUrl = 'postgresql://test:fake@helium/heliumdb?sslmode=disable';
const workspace = { REPLIT_DEV_DOMAIN: 'test.workspace.replit.dev' };
assert.equal((new pg.Client(make(heliumUrl, workspace)) as any).connectionParameters.ssl, false);
assert.equal(make(heliumUrl.replace('helium/','helium:5432/'), workspace).ssl, false);
for (const extra of [
 {}, { REPLIT_DEV_DOMAIN: 'replit.dev.evil.invalid' },
 { ...workspace, NODE_ENV: 'production' }, { ...workspace, NODE_ENV: 'test' },
 { ...workspace, NODE_ENV: undefined }, { ...workspace, REPLIT_DEPLOYMENT: '1' },
 { ...workspace, REPLIT_DEPLOYMENT: 'true' }, { ...workspace, DATABASE_SSL: 'true' },
]) assert.throws(() => make(heliumUrl, extra));
for (const url of [heliumUrl.replace('helium/', 'remote.invalid/'),
 heliumUrl.replace('/heliumdb', '/production'), heliumUrl.replace('helium/', 'helium:5433/'),
 heliumUrl + '&host=remote.invalid', heliumUrl + '&hostaddr=127.0.0.1']) {
 assert.throws(() => make(url, workspace));
}
for (const extra of [workspace, {...workspace, NODE_ENV: 'production'}, {...workspace, REPLIT_DEPLOYMENT: '1'}]) {
 const config = make(heliumUrl.replace('disable', 'require'), extra);
 assert.equal((new pg.Client(config) as any).connectionParameters.ssl.rejectUnauthorized, true);
}
assert.throws(() => make('postgresql://test:fake@localhost/test?sslmode=disable', { REPLIT_DEPLOYMENT: '1' }));
console.log('PASS: Helium restricted to Replit development; production, deployments and explicit TLS remain verified');
