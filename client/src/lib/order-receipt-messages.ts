export function orderReceiptMessages(language: string) {
  return language.startsWith("fr") ? {
    receiptTitle: "Commande enregistrée : reçu indisponible",
    receiptDescription: "Le reçu n’a pas pu être préparé. La commande reste enregistrée. Ouvrez-la pour réessayer le téléchargement ou la notification, sans recréer la commande.",
    coverageTitle: "Commande enregistrée : abonnement client non appliqué",
    coverageDescription: "L’application de l’abonnement n’a pas été confirmée. Vérifiez la commande et le solde du client avant toute nouvelle tentative. Ne recréez pas la commande.",
  } : {
    receiptTitle: "Order saved: receipt unavailable",
    receiptDescription: "The receipt could not be prepared. Your order is still saved. Open it to retry the download or notification without creating another order.",
    coverageTitle: "Order saved: subscription coverage not confirmed",
    coverageDescription: "Subscription coverage was not confirmed. Check the order and customer balance before retrying. Do not create another order.",
  };
}
