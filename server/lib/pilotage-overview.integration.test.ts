import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { getPilotageOverview } from './pilotage-overview';
const db=new PGlite();
await db.exec(`
CREATE TABLE sites(id int primary key,name text,organisation_id int);
CREATE TABLE orders(id int primary key,site_id int,status text,pickup_date timestamp,entry_date timestamp,delivered_at timestamp,total_amount numeric);
CREATE TABLE payments(order_id int,amount numeric,date timestamp);
CREATE TABLE employees(id int,site_id int,status text);
CREATE TABLE employee_attendance(employee_id int,site_id int,work_date timestamp,check_in_at timestamp,check_out_at timestamp);
CREATE TABLE machines(site_id int,status text);
CREATE TABLE production_cycles(site_id int,machine_id int,status text);
CREATE TABLE inventory_products(site_id int,is_active boolean,current_quantity numeric,reorder_level numeric);
CREATE TABLE customers(id int,site_id int);
CREATE TABLE subscription_plans(id int,organisation_id int,included_weight_kg numeric,included_pieces int,max_orders int);
CREATE TABLE customer_subscriptions(id int,organisation_id int,customer_id int,subscription_plan_id int,status text,start_date date,expiry_date date,remaining_kg numeric,remaining_pieces int,remaining_orders int);
CREATE TABLE membership_subscription_payments(subscription_id int,organisation_id int,status text,payment_date timestamp,amount numeric);
INSERT INTO sites VALUES(1,'A',10),(2,'B',20);
INSERT INTO orders VALUES(1,1,'received','2026-10-23','2026-09-01',null,1000),(2,1,'ready','2026-10-24','2026-10-23 23:30',null,500),(3,1,'delivered','2026-10-24','2026-09-01','2026-10-24 08:00',200),(4,1,'cancelled','2026-10-22','2026-10-24',null,900),(5,2,'received','2026-10-22','2026-10-24',null,9999);
INSERT INTO payments VALUES(1,200,'2026-10-23 23:30'),(3,200,'2026-10-24 08:00'),(4,900,'2026-10-24'),(5,9999,'2026-10-24');
INSERT INTO employees VALUES(1,1,'active'),(2,1,'active'),(3,2,'active');
INSERT INTO employee_attendance VALUES(1,1,'2026-10-24','2026-10-24 08:00',null),(1,1,'2026-10-24','2026-10-24 08:00',null),(2,1,'2026-10-24','2026-10-24 08:00','2026-10-24 09:00'),(3,2,'2026-10-24','2026-10-24 08:00',null);
INSERT INTO machines VALUES(1,'active'),(2,'active');
INSERT INTO production_cycles VALUES(1,1,'running'),(1,1,'running'),(2,2,'running');
INSERT INTO inventory_products VALUES(1,true,2,2),(1,false,0,1),(2,true,0,1);
INSERT INTO customers VALUES(1,1),(2,1),(3,1),(4,2),(5,1);
INSERT INTO subscription_plans VALUES(1,10,10,null,null),(2,20,10,null,null),(3,10,null,null,null);
INSERT INTO customer_subscriptions VALUES
(1,10,1,1,'active','2026-10-01','2026-10-27',2,null,null),
(2,10,2,1,'active','2026-09-01','2026-10-10',0,null,null),
(3,10,3,1,'expired','2026-09-01','2026-10-01',0,null,null),
(4,10,3,3,'active','2026-10-02','2026-11-02',null,null,null),
(5,20,4,2,'active','2026-10-01','2026-10-27',1,null,null),
(6,20,5,2,'active','2026-10-01','2026-10-27',1,null,null);
INSERT INTO membership_subscription_payments VALUES(1,10,'completed','2026-10-24 08:00',600),(1,10,'failed','2026-10-24',700),(5,20,'completed','2026-10-24',9999);
`);
const adapter={query:(sql:string,args:any[])=>db.query(sql,args.map(v=>v instanceof Date?v.toISOString():v))};
const now=new Date('2026-10-24T10:00:00Z');
const result=await getPilotageOverview(adapter,[1],now,'Africa/Douala');
assert.equal(result.priorities.overdue,1);assert.equal(result.priorities.due,1);assert.equal(result.priorities.outstanding,1300);
assert.equal(result.operations.find((x:any)=>x.status==='delivered').count,1,'old receipt delivered today included');
assert.deepEqual(result.resources,{employees:2,present:1,machines:1,running:1,low_stock:1});
assert.equal(result.trend.length,14);assert.deepEqual(result.trend.at(-1),{day:'2026-10-24',orders:1,collections:400});
assert.equal(result.sites.length,1);assert.equal(result.sites[0].pending,2);
assert.deepEqual(result.memberships,{active:2,expiring:1,low:1,expired:1,collections:600},'dates override stale active status, renewed history/unlimited/wrong org excluded');
const empty=await getPilotageOverview(adapter,[],now,'Africa/Douala');
assert.equal(empty.memberships.active,0);assert.equal(empty.priorities.outstanding,0);assert.equal(empty.sites.length,0);
assert.equal((await db.query<any>('SELECT count(*)::int n FROM customer_subscriptions')).rows[0].n,6,'read only');
await db.close();console.log('PASS overview SQL: all six blocks, local-day boundaries, historical workload, cancelled payments, presence deduplication, scopes, expired/renewed memberships, low/unlimited quota and separate collections');
