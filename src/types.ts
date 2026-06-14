export interface Snapshot {
  generatedAt: string;
  baseCurrency: string;
  exchange: {
    provider: string;
    updatedAt: string | null;
    nextUpdateAt: string | null;
  };
  targets: TargetSnapshot[];
}

export interface AppListSnapshot {
  generatedAt: string;
  baseCurrency: string;
  apps: AppSummary[];
}

export interface AppSummary {
  name: string;
  platform: string;
  appId: string;
  iconUrl: string | null;
  description: string | null;
  artistName: string | null;
  primaryGenreName: string | null;
  country: string;
  status: string;
  error: string | null;
}

export interface TargetSnapshot {
  name: string;
  platform: string;
  appId: string;
  iconUrl: string | null;
  description: string | null;
  requestedCountryCount: number;
  filteredCountryCount: number;
  countryCount: number;
  countries: CountrySnapshot[];
  subscriptionPlans: ProductComparison[];
  oneTimePurchases: ProductComparison[];
}

export interface CountrySnapshot {
  country: string;
  countryName: string | null;
  status: string;
}

export interface ProductComparison {
  key: string;
  name: string;
  salableAdamId: string | null;
  offerName: string | null;
  productType: string | null;
  billingPeriod: string | null;
  baseCurrency: string | null;
  countryCount: number;
  stats: PriceStats | null;
  prices: CountryPrice[];
}

export interface PriceStats {
  min: number | null;
  max: number | null;
  average: number | null;
  median: number | null;
  spread: number | null;
}

export interface CountryPrice {
  country: string;
  countryName: string | null;
  status: string;
  currency: string | null;
  localPrice: string | null;
  priceAmount: number | null;
  baseCurrency: string | null;
  priceInBase: number | null;
  offerName: string | null;
  salableAdamId: string | null;
}
