import crypto from 'node:crypto';
import { pool } from '../db';
import { deferredSaasOrganisations } from './saas-deferred';
import { salesEnvironment } from './sales-referrals';

export type AmbassadorExecutor = { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> };
export type AmbassadorDatabase = AmbassadorExecutor & { transaction: <T>(fn: (tx: AmbassadorExecutor) => Promise<T>) => Promise<T> };
export class AmbassadorError extends Error {}
export const ambassadorDatabase: AmbassadorDatabase = {
  query: (sql, params) => pool.query(sql, params),
  async transaction(fn) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  },
};

// A personal capability, never a replacement for merchant roles or subscription rights.
export class AmbassadorAccess {
  constructor(readonly db: AmbassadorDatabase = ambassadorDatabase) {}
  async excluded(tx: AmbassadorExecutor, user: any) {
    const excluded = deferredSaasOrganisations();
    if (excluded.includes(Number(user.organisation_id))) return true;
    return (await tx.query('SELECT 1 FROM organisations WHERE owner_id=$1 AND id=ANY($2::int[]) LIMIT 1', [user.id, excluded])).rows.length > 0;
  }
  async candidates(search: string) {
    return (await this.db.query(`SELECT u.id,u.email,u.first_name,u.last_name,u.business_name,u.user_type,
      a.representative_id,s.active AS ambassador_active
      FROM users u LEFT JOIN sales_user_access a ON a.user_id=u.id AND a.environment=$2
      LEFT JOIN sales_representatives s ON s.id=a.representative_id AND s.environment=$2
      WHERE u.email IS NOT NULL AND (u.email ILIKE $1 OR u.business_name ILIKE $1 OR concat_ws(' ',u.first_name,u.last_name) ILIKE $1)
      ORDER BY lower(u.email),u.id LIMIT 20`, ['%' + search.replace(/[\\%_]/g, '\\$&') + '%', salesEnvironment()])).rows;
  }
  async principal(userId: string) {
    const row = (await this.db.query(`SELECT s.id,s.name,s.country,COALESCE(s.public_code,s.code) AS code,s.active,
      u.id AS user_id,u.organisation_id FROM sales_user_access a
      JOIN sales_representatives s ON s.id=a.representative_id AND s.environment=a.environment
      JOIN users u ON u.id=a.user_id WHERE a.user_id=$1 AND a.environment=$2 AND s.active`, [userId,salesEnvironment()])).rows[0];
    return row && !(await this.excluded(this.db,{id:row.user_id,organisation_id:row.organisation_id})) ? row : null;
  }
  async activate(input: {userId:string;name:string;country:string;representativeId?:number}, actorId:string) {
    return this.db.transaction(async tx=>{
      // User lock makes simultaneous/retried activation idempotent.
      const user=(await tx.query('SELECT id,email,organisation_id FROM users WHERE id=$1 FOR UPDATE',[input.userId])).rows[0];
      if(!user?.email)throw new AmbassadorError('USER_NOT_FOUND');
      if(await this.excluded(tx,user))throw new AmbassadorError('AMBASSADOR_DEFERRED');
      const env=salesEnvironment();
      const existing=(await tx.query('SELECT representative_id FROM sales_user_access WHERE user_id=$1 AND environment=$2',[user.id,env])).rows[0];
      if(existing&&input.representativeId&&existing.representative_id!==input.representativeId)throw new AmbassadorError('USER_ALREADY_LINKED');
      let rep:any;
      const repId=existing?.representative_id||input.representativeId;
      if(repId){
        rep=(await tx.query('SELECT * FROM sales_representatives WHERE id=$1 AND environment=$2 FOR UPDATE',[repId,env])).rows[0];
        if(!rep)throw new AmbassadorError('REPRESENTATIVE_NOT_FOUND');
        const bound=(await tx.query('SELECT user_id FROM sales_user_access WHERE representative_id=$1',[rep.id])).rows[0];
        if(bound&&bound.user_id!==user.id)throw new AmbassadorError('REPRESENTATIVE_ALREADY_LINKED');
        // Existing name, country, links and attributed accounts stay unchanged.
      }else{
        for(let attempt=0;attempt<5&&!rep;attempt++){
          const code=input.country+'-'+crypto.randomBytes(10).toString('hex').toUpperCase();
          const publicCode=input.country+'-'+crypto.randomBytes(4).toString('hex').toUpperCase();
          rep=(await tx.query(`INSERT INTO sales_representatives(name,country,code,public_code,environment,created_by)
            VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING *`,[input.name,input.country,code,publicCode,env,actorId])).rows[0];
        }
        if(!rep)throw new AmbassadorError('CODE_UNAVAILABLE');
        await tx.query("INSERT INTO sales_admin_events(actor_id,representative_id,action) VALUES($1,$2,'created')",[actorId,rep.id]);
      }
      if(!existing){
        await tx.query('INSERT INTO sales_user_access(representative_id,user_id,environment,created_by) VALUES($1,$2,$3,$4)',[rep.id,user.id,env,actorId]);
        await tx.query("INSERT INTO sales_user_access_events(representative_id,user_id,actor_id,action) VALUES($1,$2,$3,'linked')",[rep.id,user.id,actorId]);
      }
      if(!rep.active){
        await tx.query('UPDATE sales_representatives SET active=true WHERE id=$1',[rep.id]);
        await tx.query("INSERT INTO sales_user_access_events(representative_id,user_id,actor_id,action) VALUES($1,$2,$3,'activated')",[rep.id,user.id,actorId]);
      }
      return {id:rep.id,user_id:user.id,name:rep.name,country:rep.country,code:rep.public_code||rep.code,active:true};
    });
  }
  async setActive(id:number,active:boolean,actorId:string){
    return this.db.transaction(async tx=>{
      const rep=(await tx.query(`SELECT s.id,s.active,a.user_id FROM sales_representatives s
        JOIN sales_user_access a ON a.representative_id=s.id AND a.environment=s.environment
        WHERE s.id=$1 AND s.environment=$2 FOR UPDATE OF s`,[id,salesEnvironment()])).rows[0];
      if(!rep)throw new AmbassadorError('REPRESENTATIVE_NOT_FOUND');
      const user=(await tx.query('SELECT id,organisation_id FROM users WHERE id=$1',[rep.user_id])).rows[0];
      if(active&&(!user||await this.excluded(tx,user)))throw new AmbassadorError('AMBASSADOR_DEFERRED');
      if(rep.active!==active){
        await tx.query('UPDATE sales_representatives SET active=$2 WHERE id=$1',[id,active]);
        const action=active?'activated':'disabled';
        await tx.query('INSERT INTO sales_user_access_events(representative_id,user_id,actor_id,action) VALUES($1,$2,$3,$4)',[id,rep.user_id,actorId,action]);
        await tx.query('INSERT INTO sales_admin_events(actor_id,representative_id,action) VALUES($1,$2,$3)',[actorId,id,action]);
      }
      return {ok:true,active};
    });
  }
}
