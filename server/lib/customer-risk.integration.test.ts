import './customer-risk.test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {generateDrizzleJson,generateMigration} from 'drizzle-kit/api';
import * as schema from '../../shared/schema';
process.env.DATABASE_URL='postgresql://unused:unused@127.0.0.1:1/risk_isolated';
process.env.NODE_ENV='test';
process.env.SAAS_BILLING_MODE='disabled';
process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED='true';
const pg=new PGlite();const isolated=drizzle(pg,{schema});
const {db,pool}=await import('../db');
(db as any).select=isolated.select.bind(isolated);
const {storage}=await import('../storage');
try{
 for(const statement of await generateMigration(generateDrizzleJson({}),generateDrizzleJson(schema)))await pg.exec(statement);
 const ago=(days:number)=>new Date(Date.now()-days*86400000);
 await isolated.insert(schema.customers).values([
 {id:1,name:'QA Risk',phone:'000',address:'Test',siteId:1,visitCount:3,avgDaysBetweenVisits:'10',lastVisitAt:ago(20),churnRiskScore:0,segment:'regular'},
 {id:2,name:'QA New',phone:'000',address:'Test',siteId:1,visitCount:2,avgDaysBetweenVisits:'10',lastVisitAt:ago(30),churnRiskScore:100,segment:'lost'},
 {id:3,name:'QA Returned',phone:'000',address:'Test',siteId:1,visitCount:3,avgDaysBetweenVisits:'10',lastVisitAt:ago(1),churnRiskScore:100,segment:'lost'},
 {id:4,name:'Other site',phone:'000',address:'Test',siteId:2,visitCount:3,avgDaysBetweenVisits:'10',lastVisitAt:ago(30),churnRiskScore:100,segment:'lost'},
 ]);
 const result=await storage.getCustomerBehaviorAnalytics('month',[1]);
 assert.equal(result.churn.atRiskCount,1);assert.equal(result.churn.insufficientHistoryCount,1);assert.deepEqual(result.churn.customers.map((x:any)=>x.id),[1]);
 assert.equal((await storage.getCustomerBehaviorAnalytics('month',[])).churn.atRiskCount,0);
 const before=await isolated.select().from(schema.customers);
 await storage.getCustomerBehaviorAnalytics('day',[1]);
 assert.deepEqual(await isolated.select().from(schema.customers),before,'analytics reads do not update cached fields');
 assert.equal(before.find(x=>x.id===1)?.churnRiskScore,0,'stored score unchanged despite current risk');
 console.log('PASS customer behavior integration: actual Analytics storage, scoped risk, insufficient history, empty scope and unchanged customer records');
}finally{await pg.close();await pool.end();}
