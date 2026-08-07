export const NOTIFICATION_TEMPLATES = {
  welcome: (first: string, plan: string, number: string, business: string) => `Bienvenue ${first} ! 🎉\n\nVotre abonnement ${plan} est maintenant actif.\nN° membre : ${number}\n\nPrésentez ce numéro à chaque visite.\nMerci de votre fidélité !\n— ${business}`,
  renewal_reminder: (first: string, plan: string, days: number, business: string) => `Bonjour ${first},\n\nVotre abonnement ${plan} expire dans ${days} jour${days > 1 ? "s" : ""}.\n\nRenouvelez maintenant pour continuer à profiter de vos avantages.\n— ${business}`,
  expired: (first: string, plan: string, business: string) => `Bonjour ${first},\n\nVotre abonnement ${plan} a expiré.\n\nRéabonnez-vous pour continuer à bénéficier de vos avantages.\n— ${business}`,
  usage_80: (first: string, plan: string, remainingKg: number, business: string) => `Bonjour ${first},\n\nVous avez consommé 80% de votre forfait ${plan}.\nIl vous reste ${remainingKg} kg.\n\nPensez à renouveler si besoin.\n— ${business}`,
  usage_100: (first: string, plan: string, business: string) => `Bonjour ${first},\n\nVous avez utilisé tout votre forfait ${plan}.\n\nLes commandes supplémentaires seront facturées au tarif dépassement.\nContactez-nous pour renouveler.\n— ${business}`,
  payment_confirmed: (first: string, plan: string, amount: string, currency: string, business: string) => `Bonjour ${first},\n\nPaiement reçu : ${amount} ${currency}\nAbonnement : ${plan}\n\nMerci pour votre fidélité !\n— ${business}`,
  card_ready: (first: string, number: string, business: string) => `Bonjour ${first},\n\nVotre carte de membre est prête !\nN° : ${number}\n\nPrésentez-la lors de vos prochaines visites.\n— ${business}`,
};

export type SubscriptionNotificationTrigger = keyof typeof NOTIFICATION_TEMPLATES;
