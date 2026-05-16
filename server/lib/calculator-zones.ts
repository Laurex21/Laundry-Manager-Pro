export type ContactZone = "africa" | "maghreb" | "europe";

export const COUNTRY_ZONES: Record<string, ContactZone> = {
  cameroun: "africa", senegal: "africa", cote_divoire: "africa",
  mali: "africa", burkina_faso: "africa", guinee: "africa",
  rdc: "africa", gabon: "africa", congo: "africa",
  togo: "africa", benin: "africa", niger: "africa",
  tchad: "africa", centrafrique: "africa",
  maroc: "maghreb", tunisie: "maghreb", algerie: "maghreb",
  france: "europe", belgique: "europe", suisse: "europe",
};

export function getContactZone(countryKey: string): ContactZone {
  return COUNTRY_ZONES[countryKey] ?? "africa";
}

export const COUNTRY_META: Record<string, {
  label: string; currency: string; cityPlaceholder: string; dialCode: string;
}> = {
  cameroun:     { label: "Cameroun",         currency: "FCFA", cityPlaceholder: "ex: Douala, Yaoundé, Bafoussam...",       dialCode: "+237" },
  senegal:      { label: "Sénégal",           currency: "FCFA", cityPlaceholder: "ex: Dakar, Thiès, Saint-Louis...",        dialCode: "+221" },
  cote_divoire: { label: "Côte d'Ivoire",     currency: "FCFA", cityPlaceholder: "ex: Abidjan, Bouaké, Yamoussoukro...",   dialCode: "+225" },
  mali:         { label: "Mali",              currency: "FCFA", cityPlaceholder: "ex: Bamako, Sikasso, Ségou...",           dialCode: "+223" },
  burkina_faso: { label: "Burkina Faso",      currency: "FCFA", cityPlaceholder: "ex: Ouagadougou, Bobo-Dioulasso...",     dialCode: "+226" },
  guinee:       { label: "Guinée",            currency: "GNF",  cityPlaceholder: "ex: Conakry, Kankan, Labé...",            dialCode: "+224" },
  rdc:          { label: "RD Congo",          currency: "USD",  cityPlaceholder: "ex: Kinshasa, Lubumbashi, Goma...",       dialCode: "+243" },
  gabon:        { label: "Gabon",             currency: "FCFA", cityPlaceholder: "ex: Libreville, Port-Gentil...",          dialCode: "+241" },
  congo:        { label: "Congo-Brazzaville", currency: "FCFA", cityPlaceholder: "ex: Brazzaville, Pointe-Noire...",        dialCode: "+242" },
  togo:         { label: "Togo",              currency: "FCFA", cityPlaceholder: "ex: Lomé, Kpalimé, Sokodé...",            dialCode: "+228" },
  benin:        { label: "Bénin",             currency: "FCFA", cityPlaceholder: "ex: Cotonou, Porto-Novo, Parakou...",     dialCode: "+229" },
  maroc:        { label: "Maroc",             currency: "MAD",  cityPlaceholder: "ex: Casablanca, Rabat, Marrakech...",     dialCode: "+212" },
  tunisie:      { label: "Tunisie",           currency: "TND",  cityPlaceholder: "ex: Tunis, Sfax, Sousse...",              dialCode: "+216" },
  algerie:      { label: "Algérie",           currency: "DZD",  cityPlaceholder: "ex: Alger, Oran, Constantine...",         dialCode: "+213" },
  france:       { label: "France",            currency: "EUR",  cityPlaceholder: "ex: Paris, Lyon, Marseille, Bordeaux...", dialCode: "+33"  },
  belgique:     { label: "Belgique",          currency: "EUR",  cityPlaceholder: "ex: Bruxelles, Liège, Anvers...",         dialCode: "+32"  },
  suisse:       { label: "Suisse",            currency: "CHF",  cityPlaceholder: "ex: Genève, Lausanne, Zurich...",         dialCode: "+41"  },
};
