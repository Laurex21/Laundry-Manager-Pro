import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "dashboard": "Dashboard",
      "orders": "Orders",
      "customers": "Customers",
      "services": "Services",
      "expenses": "Expenditures",
      "sign_out": "Sign Out",
      "new_order": "New Order",
      "add_customer": "Add Customer",
      "add_service": "Add Service",
      "log_expense": "Log Expense",
      "total_orders": "Total Orders",
      "total_revenue": "Total Revenue",
      "pending_orders": "Pending Orders",
      "active_customers": "Active Customers",
      "search_orders": "Search orders...",
      "search_customers": "Search by name or phone...",
      "status": "Status",
      "payment": "Payment",
      "amount": "Amount",
      "date": "Date",
      "phone": "Phone",
      "address": "Address",
      "notes": "Notes",
      "payments": "Payments",
      "welcome": "Welcome",
      "laundry_manager": "Laundry Manager"
    }
  },
  fr: {
    translation: {
      "dashboard": "Tableau de bord",
      "orders": "Commandes",
      "customers": "Clients",
      "services": "Services",
      "expenses": "Dépenses",
      "sign_out": "Se déconnecter",
      "new_order": "Nouvelle commande",
      "add_customer": "Ajouter un client",
      "add_service": "Ajouter un service",
      "log_expense": "Enregistrer une dépense",
      "total_orders": "Total des commandes",
      "total_revenue": "Chiffre d'affaires",
      "pending_orders": "Commandes en attente",
      "active_customers": "Clients actifs",
      "search_orders": "Rechercher des commandes...",
      "search_customers": "Rechercher par nom ou téléphone...",
      "status": "Statut",
      "payment": "Paiement",
      "amount": "Montant",
      "date": "Date",
      "phone": "Téléphone",
      "address": "Adresse",
      "notes": "Notes",
      "payments": "Paiements",
      "welcome": "Bienvenue",
      "laundry_manager": "Gestionnaire de Blanchisserie"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
