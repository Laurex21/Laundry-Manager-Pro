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

export interface CountryMeta {
  label: string;
  currency: string;
  cityPlaceholder: string;
  dialCode: string;
  dialCodeNumeric: string;
}

export const COUNTRY_META: Record<string, CountryMeta> = {
  cameroun:     { label: "Cameroun",         currency: "FCFA", dialCode: "+237", dialCodeNumeric: "237", cityPlaceholder: "ex: Douala, Yaoundé, Bafoussam..." },
  senegal:      { label: "Sénégal",           currency: "FCFA", dialCode: "+221", dialCodeNumeric: "221", cityPlaceholder: "ex: Dakar, Thiès, Saint-Louis..." },
  cote_divoire: { label: "Côte d'Ivoire",     currency: "FCFA", dialCode: "+225", dialCodeNumeric: "225", cityPlaceholder: "ex: Abidjan, Bouaké, Yamoussoukro..." },
  mali:         { label: "Mali",              currency: "FCFA", dialCode: "+223", dialCodeNumeric: "223", cityPlaceholder: "ex: Bamako, Sikasso, Ségou..." },
  burkina_faso: { label: "Burkina Faso",      currency: "FCFA", dialCode: "+226", dialCodeNumeric: "226", cityPlaceholder: "ex: Ouagadougou, Bobo-Dioulasso..." },
  guinee:       { label: "Guinée",            currency: "GNF",  dialCode: "+224", dialCodeNumeric: "224", cityPlaceholder: "ex: Conakry, Kankan, Labé..." },
  rdc:          { label: "RD Congo",          currency: "USD",  dialCode: "+243", dialCodeNumeric: "243", cityPlaceholder: "ex: Kinshasa, Lubumbashi, Goma..." },
  gabon:        { label: "Gabon",             currency: "FCFA", dialCode: "+241", dialCodeNumeric: "241", cityPlaceholder: "ex: Libreville, Port-Gentil..." },
  congo:        { label: "Congo-Brazzaville", currency: "FCFA", dialCode: "+242", dialCodeNumeric: "242", cityPlaceholder: "ex: Brazzaville, Pointe-Noire..." },
  togo:         { label: "Togo",              currency: "FCFA", dialCode: "+228", dialCodeNumeric: "228", cityPlaceholder: "ex: Lomé, Kpalimé, Sokodé..." },
  benin:        { label: "Bénin",             currency: "FCFA", dialCode: "+229", dialCodeNumeric: "229", cityPlaceholder: "ex: Cotonou, Porto-Novo, Parakou..." },
  maroc:        { label: "Maroc",             currency: "MAD",  dialCode: "+212", dialCodeNumeric: "212", cityPlaceholder: "ex: Casablanca, Rabat, Marrakech..." },
  tunisie:      { label: "Tunisie",           currency: "TND",  dialCode: "+216", dialCodeNumeric: "216", cityPlaceholder: "ex: Tunis, Sfax, Sousse..." },
  algerie:      { label: "Algérie",           currency: "DZD",  dialCode: "+213", dialCodeNumeric: "213", cityPlaceholder: "ex: Alger, Oran, Constantine..." },
  france:       { label: "France",            currency: "EUR",  dialCode: "+33",  dialCodeNumeric: "33",  cityPlaceholder: "ex: Paris, Lyon, Marseille, Bordeaux..." },
  belgique:     { label: "Belgique",          currency: "EUR",  dialCode: "+32",  dialCodeNumeric: "32",  cityPlaceholder: "ex: Bruxelles, Liège, Anvers..." },
  suisse:       { label: "Suisse",            currency: "CHF",  dialCode: "+41",  dialCodeNumeric: "41",  cityPlaceholder: "ex: Genève, Lausanne, Zurich..." },
};

export const REFERENCE = {
  baseEquipment: {
    less_50:  { min: 1_500_000, max: 4_000_000  },
    "50_150": { min: 4_000_000, max: 10_000_000 },
    more_150: { min: 10_000_000, max: 25_000_000 },
  } as Record<string, { min: number; max: number }>,
  typeMultiplier: { quartier: 0.7, semi_pro: 1.0, industriel: 1.8 } as Record<string, number>,
  defaultEmployees: { less_50: 1, "50_150": 2, more_150: 4 } as Record<string, number>,
  monthly: {
    cameroun:     { rent:[150_000,400_000], water:[30_000,80_000],  elec:[40_000,120_000],  salary:[70_000,120_000]  },
    senegal:      { rent:[200_000,500_000], water:[35_000,90_000],  elec:[45_000,130_000],  salary:[80_000,130_000]  },
    cote_divoire: { rent:[250_000,600_000], water:[40_000,100_000], elec:[50_000,140_000],  salary:[90_000,150_000]  },
    mali:         { rent:[120_000,350_000], water:[25_000,70_000],  elec:[35_000,100_000],  salary:[60_000,100_000]  },
    burkina_faso: { rent:[100_000,300_000], water:[20_000,60_000],  elec:[30_000,90_000],   salary:[55_000,90_000]   },
    rdc:          { rent:[200_000,600_000], water:[30_000,100_000], elec:[50_000,150_000],  salary:[80_000,150_000]  },
    gabon:        { rent:[200_000,500_000], water:[40_000,100_000], elec:[60_000,150_000],  salary:[100_000,180_000] },
    maroc:        { rent:[3_000,8_000],     water:[500,1_500],      elec:[800,2_500],       salary:[3_000,5_000]     },
    france:       { rent:[800,2000],        water:[80,200],         elec:[150,400],         salary:[1_800,2_200]     },
    belgique:     { rent:[900,2200],        water:[90,220],         elec:[180,450],         salary:[1_900,2_400]     },
    default:      { rent:[150_000,500_000], water:[30_000,100_000], elec:[40_000,150_000],  salary:[70_000,150_000]  },
  } as Record<string, { rent:number[]; water:number[]; elec:number[]; salary:number[] }>,
  toFcfa: { FCFA:1, EUR:655, MAD:65, TND:200, GNF:0.075, USD:600, CHF:720, DZD:4.4 } as Record<string, number>,
};
