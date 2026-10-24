import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { decisionRange, employeePerformanceSql } from './decision-support';
import { cashResult, stockForecast } from '../../shared/decision-support';

const now=new Date('2026-10-24T18:00:00Z');
const range=decisionRange('day',now,'Africa/Douala');
assert.equal(range.start.toISOString(),'2026-10-23T23:00:00.000Z');
assert.equal(decisionRange('month',now,'Africa/Douala').start.toISOString(),'2026-09-30T23:00:00.000Z');
assert.equal(decisionRange('week',now,'Africa/Douala').startDay,'2026-10-18');
assert.equal(cashResult(1000,400,100,'included'),600);
assert.equal(cashResult(1000,400,100,'separate'),500);
assert.equal(stockForecast(20,60,10).suggestedQuantity,null);
assert.equal(stockForecast(20,0,30).daysRemaining,null);
assert.deepEqual(stockForecast(20,60,30,7,14),{dailyUse:2,daysRemaining:10,suggestedQuantity:22,orderNow:false});
assert.equal(stockForecast(2,60,30,7,14).orderNow,true);
assert.equal(stockForecast(1000,60,30).suggestedQuantity,0);
const db=new PGlite();
try {
 await db.exec(`CREATE TABLE orders(id int,site_id int,entry_date timestamp,created_at timestamp,status text,total_amount numeric,discount_amount numeric,pickup_date timestamp,delivered_at timestamp);
 CREATE TABLE payments(order_id int,amount numeric,date timestamp);
 CREATE TABLE expenditures(site_id int,amount numeric,category text,date timestamp);
 CREATE TABLE employees(id int,name text,site_id int);
 CREATE TABLE employee_activities(employee_id int,site_id int,order_id int,action_type text,weight_kg numeric,action_date timestamp);
 CREATE TABLE employee_attendance(employee_id int,site_id int,check_in_at timestamp,check_out_at timestamp,work_date timestamp);
 CREATE TABLE garment_return_cases(order_id int,site_id int,status text,returned_at timestamp,garment_item_id int);
 INSERT INTO orders VALUES
 (1,1,'2026-09-20','2026-09-20','delivered',1000,0,'2026-10-24','2026-10-24 14:00'),
 (2,1,'2026-10-01','2026-10-01','delivered',2000,0,'2026-10-24','2026-10-24 16:00'),
 (3,2,'2026-10-24','2026-10-24','delivered',9999,0,'2026-10-24','2026-10-24 16:00'),
 (4,1,'2026-10-24','2026-10-24','cancelled',100,0,NULL,NULL);
 INSERT INTO payments VALUES(1,1000,'2026-10-24 12:00'),(3,9999,'2026-10-24 12:00'),(4,100,'2026-10-24 12:00');
 INSERT INTO expenditures VALUES(1,400,' rent ','2026-10-24'),(1,20,'unknown','2026-10-24'),(2,9000,'rent','2026-10-24');
 INSERT INTO employees VALUES(1,'QA',1),(2,'Other site',2);
 INSERT INTO employee_activities VALUES(1,1,2,'order_created',5,'2026-10-24 08:00'),(1,1,2,'order_processed',5,'2026-10-24 09:00'),(1,1,2,'order_delivered',5,'2026-10-24 10:00'),(2,2,3,'order_delivered',50,'2026-10-24 10:00'),(1,1,1,'order_created',5,'2026-09-20');
 INSERT INTO employee_attendance VALUES(1,1,'2026-10-24 08:00','2026-10-24 10:00','2026-10-24'),(1,1,'2026-10-24 12:00',NULL,'2026-10-24');
 INSERT INTO garment_return_cases VALUES(2,1,'pending_review','2026-10-24 17:00',1),(2,1,'pending_review','2026-10-24 17:00',2);`);
 const staff=await db.query<any>(employeePerformanceSql,[[1],range.start,now,range.startDay,range.endDay]);
 assert.equal(staff.rows.length,1);
 assert.deepEqual({...staff.rows[0]}, {id:1,name:'QA',actions:3,orders:1,delivered:1,weight:5,hours:2,incomplete:1,rework:1});
 assert.equal((await db.query(employeePerformanceSql,[[],range.start,now,range.startDay,range.endDay])).rows.length,0);
 const routes=readFileSync('server/routes.ts','utf8');
 const sql=routes.slice(routes.indexOf('const [ordersResult, previousResult')).match(/`(WITH scoped_orders[\s\S]+?)`/)! [1];
 const metrics=(await db.query<any>(sql,[[1],range.start,now,'Africa/Douala',['rent'],['water']])).rows[0];
 assert.equal(metrics.delivered_orders,2,'Deliveries include orders entered before the selected period');
 assert.equal(metrics.delivered_on_time,2,'Date-only promise includes the full reporting day');
 assert.equal(Number(metrics.revenue),1000,'Cancelled orders and another site never inflate collections');
 assert.equal(Number(metrics.fixed_costs),400);
 assert.equal(Number(metrics.unclassified_costs),20);
 const inventory=readFileSync('server/lib/inventory-routes.ts','utf8');
 await db.exec(`CREATE TABLE inventory_products(id int PRIMARY KEY,site_id int,name text,unit text,current_quantity numeric,reorder_level numeric,unit_cost numeric,is_active boolean);
 CREATE TABLE inventory_movements(product_id int,site_id int,movement_type text,quantity numeric,unit_cost numeric,created_at timestamp);
 INSERT INTO inventory_products VALUES(1,1,'QA SOAP','l',20,10,100,true),(2,2,'OTHER','l',999,10,100,true),(3,1,'NEW','piece',10,2,5,true);
 INSERT INTO inventory_movements VALUES(1,1,'receipt',100,100,'2026-09-01'),(1,1,'consumption',-60,100,'2026-10-24'),(2,2,'consumption',-999,100,'2026-10-24');`);
 const planningSql=inventory.slice(inventory.indexOf('app.get("/api/inventory/planning"')).match(/pool.query\(`([\s\S]+?)`/)! [1];
 const planning=await db.query<any>(planningSql,[[1],new Date('2026-09-24T23:00:00Z'),now]);
 assert.equal(planning.rows.length,2);
 const soap=planning.rows.find((r:any)=>r.id===1);
 assert.equal(soap.consumed,60);assert.equal(soap.historyDays,30);
 assert.equal(stockForecast(Number(soap.current_quantity),soap.consumed,soap.historyDays).suggestedQuantity,22);
 const fresh=planning.rows.find((r:any)=>r.id===3);assert.equal(stockForecast(Number(fresh.current_quantity),fresh.consumed,fresh.historyDays).suggestedQuantity,null);
 const summarySql=inventory.slice(inventory.indexOf('app.get("/api/inventory/summary"')).match(/`(SELECT[\s\S]+?)`/)! [1];
 const summary=(await db.query<any>(summarySql,[[1],decisionRange('month',now,'Africa/Douala').start,now])).rows[0];
 assert.equal(Number(summary.consumptionCostThisMonth),6000);
 assert.equal(summary.productCount,2);
 // Queries are read-only and do not repair legacy counters or change stock.
 assert.equal(Number((await db.query<any>('SELECT current_quantity FROM inventory_products WHERE id=1')).rows[0].current_quantity),20);
 console.log('PASS isolated decision support: unique orders vs actions, no duplicated kg, attendance coverage, linked rework, site isolation, reporting timezone, old-order deliveries, cost basis and stock estimates');
} finally {await db.close();}
