/** Presentation only: never overwrite the saved identity of a paying customer. */
export function starterReceiptSettings<T extends Record<string, any>>(settings:T):T {
 const french=!settings.receiptLanguage || String(settings.receiptLanguage).startsWith('fr');
 return {...settings,starterServiceProvider:settings.businessName||'',businessName:'XpressPro',
 tagline:french?'Votre plateforme de gestion de pressing':'Your laundry management platform',
 companyRegistrationNumber:'',address:'',city:'',country:'',phone:'',phone2:'',email:'',website:'',
 logoBase64:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNDAiIGhlaWdodD0iMjQwIiB2aWV3Qm94PSIwIDAgMjQwIDI0MCI+CjxyZWN0IHdpZHRoPSIyNDAiIGhlaWdodD0iMjQwIiByeD0iNDAiIGZpbGw9IiMwODJENUIiLz48cG9seWdvbiBwb2ludHM9IjQ1LjMzLDUwLjY3IDkwLjY3LDUwLjY3IDExNy4zMyw4NS4zMyA5Ny4zMywxMDUuMzMiIGZpbGw9IiNGRkZGRkYiLz48cG9seWdvbiBwb2ludHM9IjE0OS4zMyw1MC42NyAxOTQuNjcsNTAuNjcgMTQyLjY3LDEwNS4zMyAxMjIuNjcsODUuMzMiIGZpbGw9IiNGRkZGRkYiLz48cG9seWdvbiBwb2ludHM9Ijk3LjMzLDEzNC42NyAxMTcuMzMsMTU0LjY3IDkwLjY3LDE4OS4zMyA0NS4zMywxODkuMzMiIGZpbGw9IiNGRkZGRkYiLz48cG9seWdvbiBwb2ludHM9IjEyMi42NywxNTQuNjcgMTQyLjY3LDEzNC42NyAxOTQuNjcsMTg5LjMzIDE0OS4zMywxODkuMzMiIGZpbGw9IiNGRkZGRkYiLz4KPC9zdmc+',showLogo:true,receiptHeaderColor:'#082d5b',
 receiptQrCodeBase64:null,receiptQrCodeTarget:'',receiptQrCodeLabel:'',showPickupDate:true,showGarmentList:true,showPaymentHistory:true,
 showTerms:false,termsOfService:null,receiptFooterNote:french?'Reçu généré avec XpressPro':'Receipt generated with XpressPro'};
}
export const STARTER_SETTINGS_FIELDS=['businessName','address','city','country','phone','phone2','email'] as const;
