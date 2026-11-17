import type { DecisionRegistration } from '../../shared/platform-admin-decision';

export function suggestedContactMessage(account: DecisionRegistration, language: 'fr' | 'en') {
  const fr = language === 'fr';
  const name = account.owner.name.trim().split(/\s+/)[0];
  const hello = fr ? `Bonjour${name ? ` ${name}` : ''},` : `Hello${name ? ` ${name}` : ''},`;
  const business = account.name;
  const end = account.subscription.endDate ? new Intl.DateTimeFormat(fr ? 'fr-FR' : 'en-GB', { dateStyle: 'long', timeZone: 'Africa/Douala' }).format(new Date(account.subscription.endDate)) : '';
  const copy = {
    recent_signup: [
      `Bienvenue sur XpressPro pour ${business} ! Pour démarrer, connectez-vous sur https://app.xpressclean.cm et ouvrez le guide depuis Aide. Souhaitez-vous être accompagné pour enregistrer votre première commande ?`,
      `Welcome to XpressPro for ${business}! Sign in at https://app.xpressclean.cm and open the guide from Help. Would you like help recording your first order?`],
    no_orders: [
      `Je vous contacte au sujet du démarrage de ${business} sur XpressPro. Avez-vous rencontré une difficulté pour enregistrer votre première commande ? Nous pouvons vous guider pas à pas.`,
      `I am checking in on getting ${business} started with XpressPro. Have you had any difficulty recording your first order? We can guide you step by step.`],
    stopped_ordering: [
      `Comment se passe l’utilisation de XpressPro pour ${business} ? Souhaitez-vous de l’aide pour reprendre l’enregistrement des commandes ou résoudre un blocage ?`,
      `How is XpressPro working for ${business}? Would you like help getting back to recording orders or resolving an issue?`],
    payment_issue: [
      `Bonjour de l’équipe XpressPro pour ${business}. Un paiement nécessite une vérification. Avez-vous rencontré une difficulté lors de votre tentative ? Nous allons vérifier son état avant de vous proposer une nouvelle démarche.`,
      `The XpressPro team is following up with ${business} about a payment that needs checking. Did you encounter a problem? We will check its status before suggesting another step.`],
    trial_ending: [
      `Votre essai XpressPro pour ${business} se termine le ${end}. Souhaitez-vous que nous vous aidions à choisir la formule adaptée à votre activité ? Les formules sont disponibles ici : https://app.xpressclean.cm/subscriptions`,
      `Your XpressPro trial for ${business} ends on ${end}. Would you like help choosing a plan for your business? View plans here: https://app.xpressclean.cm/subscriptions`],
    free_regular: [
      `Vous utilisez XpressPro pour ${business}. Votre formule Starter reste gratuite. Avez-vous besoin de fonctionnalités supplémentaires ? Nous pouvons vous aider à comparer les formules : https://app.xpressclean.cm/subscriptions`,
      `You are using XpressPro for ${business}. Your Starter plan remains free. Do you need additional features? We can help compare plans: https://app.xpressclean.cm/subscriptions`],
    renewal_due: [
      `La période de votre formule XpressPro pour ${business} arrive à échéance le ${end}. Souhaitez-vous faire le point sur votre renouvellement ? Vous pouvez consulter votre abonnement ici : https://app.xpressclean.cm/subscriptions`,
      `Your current XpressPro plan period for ${business} ends on ${end}. Would you like to review your renewal? View your subscription here: https://app.xpressclean.cm/subscriptions`],
    paid_access: [
      `Comment se passe l’utilisation de XpressPro pour ${business} ? Votre accès est en cours. Nous sommes disponibles si vous avez besoin d’aide sur une fonctionnalité.`,
      `How is XpressPro working for ${business}? Your access is current. We are available if you need help with a feature.`],
    prepaid_trial: [
      `Merci pour votre paiement XpressPro pour ${business}. Souhaitez-vous de l’aide pour utiliser votre formule ou vérifier les dates de votre accès ?`,
      `Thank you for your XpressPro payment for ${business}. Would you like help using your plan or checking your access dates?`],
    getting_started: [
      `Vous avez commencé à enregistrer des commandes pour ${business} sur XpressPro. Comment se passe la prise en main ? Nous pouvons vous aider sur la prochaine étape.`,
      `You have started recording orders for ${business} in XpressPro. How is onboarding going? We can help with your next step.`],
  };
  return `${hello}\n\n${copy[account.followUp.reason][fr ? 0 : 1]}\n\n${fr ? 'L’équipe XpressPro' : 'The XpressPro team'}`;
}
