import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

type Control = {orderId:number;orderReference:string|null;siteName:string;garmentItemId:number;itemName:string;registeredQuantity:number;checkedQuantity:number;phase:"quality"|"handover";checkedAt:string;actorName:string|null;actorId:string|null};
type Controls = {items:Control[];total:number;page:number;pageSize:number};
export function GarmentControlReport({start,end,site,validRange}:{start:string;end:string;site:string;validRange:boolean}) {
 const {t,i18n}=useTranslation();
 const [selection,setSelection]=useState({range:'',page:1,phase:'all'});
 const range=`${start}/${end}/${site}`;
 const phase=selection.phase;
 const page=selection.range===range?selection.page:1;
 const report=useQuery<Controls>({queryKey:[`/api/reports/garment-controls?start=${start}&end=${end}&site=${site}&phase=${phase}&page=${page}`],enabled:validRange,staleTime:0});
 return <Card data-testid="garment-control-report">
  <CardHeader><CardTitle>{t('control_report_title')}</CardTitle><p className="text-sm text-muted-foreground">{t('control_report_hint')}</p></CardHeader>
  <CardContent className="space-y-4">
   <label className="flex flex-wrap items-center gap-2 text-sm">{t('control_report_type')}
    <select className="rounded-md border bg-background px-3 py-2" value={phase} onChange={e=>setSelection({range,page:1,phase:e.target.value})} aria-label={t('control_report_type')}>
     <option value="all">{t('control_report_all')}</option><option value="quality">{t('garment_internal_qc')}</option><option value="handover">{t('garment_customer_handover')}</option>
    </select>
   </label>
   {!validRange&&<p role="alert">{t('business_evolution_invalid_range')}</p>}
   {report.isLoading&&validRange&&<p role="status">{t('loading')}</p>}
   {report.isError&&<div role="alert"><p>{t('control_report_error')}</p><Button variant="outline" onClick={()=>report.refetch()}>{t('control_report_retry')}</Button></div>}
   {validRange&&!report.isLoading&&!report.isError&&<>
    <p className="text-sm text-muted-foreground">{t('control_report_count',{count:report.data?.total??0})}</p>
    <div className="space-y-3 md:hidden" data-testid="garment-control-mobile-cards">{report.data?.items.map(row=><article key={`${row.garmentItemId}-${row.phase}`} className="rounded-lg border p-3 text-sm">
     <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{row.itemName}</span><Link className="underline" href={`/orders/${row.orderId}`}>{row.orderReference||`#${row.orderId}`}</Link></div>
     <p className="mt-2">{t(row.phase==='quality'?'garment_internal_qc':'garment_customer_handover')} · {row.checkedQuantity}/{row.registeredQuantity}</p>
     <p className="mt-2"><span className="text-muted-foreground">{t('control_report_actor')} : </span>{row.actorName||(row.actorId?t('control_report_user',{id:row.actorId}):t('control_report_unknown'))}</p>
     <p className="mt-1 text-muted-foreground">{new Date(row.checkedAt).toLocaleString(i18n.language)} · {row.siteName}</p>
    </article>)}{!report.data?.items.length&&<p>{t('control_report_empty')}</p>}</div>
    <div className="hidden overflow-x-auto md:block"><Table>
     <TableHeader><TableRow>{['order','control_report_article','control_report_type','control_report_quantity','control_report_date','control_report_actor','control_report_site'].map(key=><TableHead key={key}>{t(key)}</TableHead>)}</TableRow></TableHeader>
     <TableBody>{report.data?.items.map(row=><TableRow key={`${row.garmentItemId}-${row.phase}`}>
      <TableCell><Link className="font-medium underline" href={`/orders/${row.orderId}`}>{row.orderReference||`#${row.orderId}`}</Link></TableCell>
      <TableCell>{row.itemName}</TableCell><TableCell>{t(row.phase==='quality'?'garment_internal_qc':'garment_customer_handover')}</TableCell>
      <TableCell>{row.checkedQuantity}/{row.registeredQuantity}</TableCell>
      <TableCell className="whitespace-nowrap">{new Date(row.checkedAt).toLocaleString(i18n.language)}</TableCell>
      <TableCell>{row.actorName||(row.actorId?t('control_report_user',{id:row.actorId}):t('control_report_unknown'))}</TableCell><TableCell>{row.siteName}</TableCell>
     </TableRow>)}{!report.data?.items.length&&<TableRow><TableCell colSpan={7}>{t('control_report_empty')}</TableCell></TableRow>}</TableBody>
    </Table></div>
    <div className="flex flex-wrap items-center justify-between gap-2">
     <Button variant="outline" disabled={page<=1} onClick={()=>setSelection({range,phase,page:page-1})}>{t('control_report_previous')}</Button>
     <span className="text-sm">{t('control_report_page',{page,total:Math.max(1,Math.ceil((report.data?.total??0)/50))})}</span>
     <Button variant="outline" disabled={page*50>=(report.data?.total??0)} onClick={()=>setSelection({range,phase,page:page+1})}>{t('control_report_next')}</Button>
    </div>
   </>}
  </CardContent>
 </Card>;
}
