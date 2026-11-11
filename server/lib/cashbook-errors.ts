const messages:Record<string,string>={
 CASHBOOK_SITE_NOT_ENABLED:"Le suivi de caisse n’est pas activé pour cette boutique.",
 CASHBOOK_MEMBERSHIP_SITE_REQUIRED:'Sélectionnez la boutique du client avant d’enregistrer cet encaissement.',
 CASHBOOK_MEMBERSHIP_DATE_REQUIRED:'Indiquez la date à laquelle le paiement a été reçu.',
 CASHBOOK_MEMBERSHIP_RECEIPT_IMMUTABLE:'Cet encaissement est conservé dans la caisse. Enregistrez une correction si nécessaire.',
 INVALID_CASHBOOK_INPUT:'Vérifiez les champs : montant positif, date valide et justification de 10 caractères minimum.',
 FORBIDDEN:'Votre session ne permet pas cette opération.', FORBIDDEN_SITE:'Cette boutique ne fait pas partie de vos accès.',FORBIDDEN_ROLE:'Cette opération est réservée au propriétaire de la boutique.',FORBIDDEN_ORGANISATION:'Cette boutique ne fait pas partie de votre entreprise.',
 CASHBOOK_PERIOD_CLOSED:'Cette écriture appartient à une période clôturée. Elle ne peut plus être modifiée. Le propriétaire peut enregistrer une correction dans Pilotage → Suivi de caisse, sur le mois courant.',
 CASHBOOK_CORRECTION_IMMUTABLE:'Une correction enregistrée est conservée dans l’historique. Pour la rectifier, ajoutez une correction inverse avec sa référence.',
 RECONCILIATION_REQUIRED:'Ventilez les mouvements et résolvez les anomalies avant de poursuivre.',COUNT_REQUIRED:'Indiquez le montant constaté pour chaque compte.',
 OPENING_REQUIRED:'Créez et validez les soldes d’ouverture avant de poursuivre.',
 BALANCES_CHANGED_REFRESH_PREVIEW:'Les soldes ont changé. Actualisez puis vérifiez à nouveau l’aperçu avant de confirmer.',
 BALANCES_CHANGED_REFRESH_RECONCILIATION:'Les soldes ont changé depuis le rapprochement. Enregistrez un nouveau rapprochement avant de clôturer.',
 ONLY_COMPLETED_MONTH_CAN_CLOSE:'Seul un mois terminé peut être clôturé.',RESOLVE_VARIANCE_BEFORE_CLOSING:'Un écart subsiste. Vérifiez les écritures et les montants constatés avant de clôturer.',
 CLOSE_OPENING_MONTH_FIRST:'Commencez par clôturer le mois d’ouverture de la caisse.',CLOSE_PREVIOUS_MONTH_FIRST:'Clôturez d’abord le mois précédent.',PERIOD_ALREADY_CLOSED:'Cette période est déjà clôturée.',SELECT_SINGLE_SITE_RECONCILIATION:'Sélectionnez un rapprochement de cette boutique uniquement.',
 INVALID_CORRECTION_ACCOUNT_OR_CLOSURE:'Choisissez un compte et une clôture de la même boutique et de la même devise.',
 IDEMPOTENCY_CONFLICT:'Cette demande a déjà été utilisée avec des informations différentes. Actualisez avant de réessayer.',
 FUTURE_OPENING:'La date d’ouverture ne peut pas être dans le futur.',FUTURE_MOVEMENT:'La date du mouvement ne peut pas être dans le futur.',INVALID_ACCOUNT_OR_DATE:'Vérifiez le compte et sa date d’ouverture.',INVALID_TRANSFER:'Les deux comptes doivent appartenir à la même boutique, être ouverts et utiliser la même devise.',
 EXPENSE_ALREADY_ALLOCATED:'Cette dépense est déjà affectée à un compte.',FORBIDDEN_EXPENSE_OR_ACCOUNT:'La dépense et le compte doivent appartenir à la boutique sélectionnée.',
 ACCOUNT_METHOD_ALREADY_EXISTS:'Un compte existe déjà pour ce mode de règlement.',ACCOUNT_CURRENCY_OR_TIMEZONE_MISMATCH:'Les comptes de la boutique doivent utiliser la même devise et le même fuseau horaire.',SELECT_SITES_WITH_SAME_CURRENCY:'Sélectionnez des boutiques utilisant la même devise.',REPORTING_TIMEZONE_MISMATCH:'Sélectionnez des boutiques utilisant le même fuseau horaire.',
 CASHBOOK_RETRY:'Une autre écriture a été enregistrée en même temps. Actualisez et recommencez la vérification.',CASHBOOK_UNAVAILABLE:'Le suivi de caisse est temporairement indisponible. Réessayez dans un instant.'
};
export function cashbookErrorResponse(code:string){return {code:code.startsWith('CASHBOOK_')?code:'CASHBOOK_'+code,message:messages[code]??'Cette opération de caisse ne peut pas être effectuée. Actualisez et vérifiez les données.'};}
// Narrow recognition through driver/ORM causes; no changes outside development.
export function respondCashbookDatabaseError(res:any,error:unknown){
 if(process.env.NODE_ENV!=='development'||process.env.XPRESSPRO_CASHBOOK_DEVELOPMENT!=='true')return false;
 let e:any=error;
 for(let i=0;e&&i<6;i++,e=e.cause){
  const code=['CASHBOOK_PERIOD_CLOSED','CASHBOOK_CORRECTION_IMMUTABLE','CASHBOOK_MEMBERSHIP_SITE_REQUIRED','CASHBOOK_MEMBERSHIP_DATE_REQUIRED','CASHBOOK_MEMBERSHIP_RECEIPT_IMMUTABLE'].find(c=>String(e.message??'').includes(c));
  if(code){res.status(409).json(cashbookErrorResponse(code));return true;}
 }
 return false;
}
