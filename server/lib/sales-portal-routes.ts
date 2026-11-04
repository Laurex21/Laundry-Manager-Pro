import type { Express, RequestHandler } from 'express';

export const salesSameOrigin:RequestHandler=(req,res,next)=>{
 try{const origin=new URL(String(req.get('origin')));if(req.get('sec-fetch-site')==='cross-site'||origin.origin!==`${req.protocol}://${req.get('host')}`)return void res.status(403).json({code:'SALES_ORIGIN_REQUIRED'});next();}
 catch{res.status(403).json({code:'SALES_ORIGIN_REQUIRED'});}
};

// Old passwords/invitation tokens are deliberately no longer accepted. Data is
// retained for history; only an explicit Super Admin binding grants the new role.
export function registerSalesPortalRoutes(app:Express,admin:RequestHandler){
 const retired:RequestHandler=(_req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  res.status(410).json({code:'SALES_PORTAL_REPLACED',signInPath:'/auth',workspacePath:'/ambassador'});
 };
 for(const path of ['/api/sales/session','/api/sales/summary','/api/sales/registrations'])app.get(path,retired);
 for(const path of ['/api/sales/login','/api/sales/logout','/api/sales/invitations/inspect','/api/sales/invitations/accept'])app.post(path,retired);
 app.get('/api/platform-admin/sales/:id/account',admin,retired);
 app.post('/api/platform-admin/sales/:id/invitation',admin,retired);
 app.patch('/api/platform-admin/sales/:id/account',admin,retired);
}
