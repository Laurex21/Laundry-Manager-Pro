export function followUpLabels(fr:boolean){return{
 status:fr?{to_contact:'À relancer',contacted:'Client contacté',return_planned:'Retour annoncé',returned:'Retour confirmé',unavailable:'Indisponible',declined:'Ne souhaite pas revenir'}:{to_contact:'To follow up',contacted:'Customer contacted',return_planned:'Return planned',returned:'Return confirmed',unavailable:'Unavailable',declined:'Not planning to return'},
 channel:fr?{whatsapp:'WhatsApp',sms:'SMS',call:'Appel téléphonique'}:{whatsapp:'WhatsApp',sms:'SMS',call:'Phone call'},
 outcome:fr?{no_answer:'Sans réponse',contacted:'Client joint',return_planned:'Retour prévu',unavailable:'Client indisponible',declined:'Ne souhaite pas revenir'}:{no_answer:'No answer',contacted:'Customer reached',return_planned:'Return planned',unavailable:'Customer unavailable',declined:'Not planning to return'}
};}
