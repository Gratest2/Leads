import { opportunityScoreWeights } from "@/lib/radar-config";

export type TreatmentStatus = "approved" | "candidate";

export type TreatmentArea = {
  id: string;
  label: string;
  bodyArea: string;
  patientGroup: string;
  status: TreatmentStatus;
};

export type Competitor = {
  id: string;
  name: string;
  category: string;
  address: string;
  distanceKm: number;
  topics: string[];
  placeId?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
};

export type Topic = {
  id: string;
  label: string;
  aliases: string[];
  bodyArea: string;
  patientGroup: string;
  specificity: number;
  intent: number;
  keywords: string[];
};

export type DataQuality = "verified" | "estimated" | "missing";

export type DataSignal<T> = {
  quality: DataQuality;
  value: T | null;
  source: string;
  detail: string;
};

export type CrawledPage = {
  url: string;
  title: string | null;
  headings: string[];
  snippets: string[];
};

export type SearchResult = {
  domain: string;
  title: string;
  snippet: string;
  url: string;
  position: number | null;
  clinicName: string | null;
};

export type SearchResponse = {
  resultCount: number | null;
  results: SearchResult[];
};

export type KeywordIdea = {
  keyword: string;
  averageMonthlySearches: number | null;
  competition: "LOW" | "MEDIUM" | "HIGH" | "UNSPECIFIED";
  competitionIndex: number | null;
  topOfPageBidLowMicros: number | null;
  topOfPageBidHighMicros: number | null;
};

export type GoogleAdsKeywordResponse = {
  ideas: KeywordIdea[];
  cachedAt: string | null;
};

export interface KeywordPlannerCache {
  get(cacheKey: string): GoogleAdsKeywordResponse | null;
  set(cacheKey: string, response: GoogleAdsKeywordResponse): void;
}

export type MetaAd = {
  advertiserName: string;
  clinicName: string | null;
  adId: string;
  active: boolean;
  text: string;
  headline: string | null;
  landingPage: string | null;
  startDate: string | null;
  platform: "Facebook" | "Instagram" | "Unknown";
  topics: string[];
};

export type TopicResearch = {
  search: DataSignal<SearchResponse>;
  googleAds: DataSignal<GoogleAdsKeywordResponse>;
  metaAds: DataSignal<MetaAd[]>;
};

export type ScoreFactor = {
  id: string;
  label: string;
  weight: number;
  value: number | null;
  quality: DataQuality;
  detail: string;
};

export type TopicMetrics = {
  competitors: Competitor[];
  coveragePercent: number | null;
  score: number | null;
  dataConfidence: number;
  resultCount: number | null;
  monthlySearches: number | null;
  competition: {
    localProviders: DataSignal<number>;
    websiteTopic: DataSignal<{ mentions: number; total: number; coveragePercent: number }>;
    search: DataSignal<SearchResponse>;
    googleAds: DataSignal<GoogleAdsKeywordResponse>;
    metaAds: DataSignal<MetaAd[]>;
  };
  scoreFactors: ScoreFactor[];
};

export type DataSourceId = "google-places" | "website-crawler" | "search-provider" | "google-ads" | "meta-ads";
export type DataSourceConnection = "mock" | "configured" | "not-configured";

export type DataSourceStatus = {
  id: DataSourceId;
  label: string;
  connection: DataSourceConnection;
  requiredVariables: string[];
  description: string;
};

export type CrawlOptions = {
  maxPages: number;
  respectRobotsTxt: true;
  minDelayMs: number;
  sameOriginOnly: true;
};

export interface WebsiteAnalyzer {
  analyze(url: string): Promise<TreatmentArea[]>;
}

export interface GooglePlacesProvider {
  findNearby(city: string, radiusKm: number): Promise<Competitor[]>;
}

export interface WebsiteCrawlerProvider {
  crawl(url: string, options: CrawlOptions): Promise<CrawledPage[]>;
}

export interface SearchProvider {
  search(query: string): Promise<SearchResponse | null>;
}

export interface GoogleAdsKeywordProvider {
  getKeywordIdeas(keywords: string[], location: string): Promise<GoogleAdsKeywordResponse | null>;
}

export interface MetaAdsProvider {
  searchAds(city: string, topics: string[]): Promise<MetaAd[] | null>;
}

export class BrowserKeywordPlannerCache implements KeywordPlannerCache {
  constructor(private readonly maxAgeMs = 24 * 60 * 60 * 1000) {}

  get(cacheKey: string): GoogleAdsKeywordResponse | null {
    if (typeof window === "undefined") return null;
    const storageKey = `niche-radar-keywords:${cacheKey}`;
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return null;
    try {
      const entry = JSON.parse(stored) as { savedAt: number; response: GoogleAdsKeywordResponse };
      if (Date.now() - entry.savedAt > this.maxAgeMs) {
        window.localStorage.removeItem(storageKey);
        return null;
      }
      return entry.response;
    } catch {
      window.localStorage.removeItem(storageKey);
      return null;
    }
  }

  set(cacheKey: string, response: GoogleAdsKeywordResponse): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(`niche-radar-keywords:${cacheKey}`, JSON.stringify({ savedAt: Date.now(), response: { ...response, cachedAt: new Date().toISOString() } }));
  }
}

export class CachedGoogleAdsKeywordProvider implements GoogleAdsKeywordProvider {
  constructor(private readonly provider: GoogleAdsKeywordProvider, private readonly cache: KeywordPlannerCache) {}

  async getKeywordIdeas(keywords: string[], location: string): Promise<GoogleAdsKeywordResponse | null> {
    const cacheKey = JSON.stringify({ keywords: [...keywords].map((keyword) => keyword.toLowerCase()).sort(), location: location.toLowerCase() });
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const response = await this.provider.getKeywordIdeas(keywords, location);
    if (response) this.cache.set(cacheKey, response);
    return response;
  }
}

export const topics: Topic[] = [
  { id: "jaw-pain", label: "Kæbesmerter / TMJ", aliases: ["kæbesmerter", "tmj", "kæbeproblemer"], bodyArea: "Kæbe", patientGroup: "Voksne", specificity: 19, intent: 19, keywords: ["kæbesmerter", "behandling af kæbesmerter", "TMJ Odense", "klik i kæben"] },
  { id: "tennis-elbow", label: "Tennisalbue", aliases: ["tennisalbue", "lateral epicondylitis", "smerter yderside albue"], bodyArea: "Albue", patientGroup: "Voksne", specificity: 18, intent: 18, keywords: ["tennisalbue", "behandling tennisalbue", "tennisalbue Odense", "smerter yderside albue"] },
  { id: "low-back-pain", label: "Lændesmerter", aliases: ["lændesmerter", "ondt i lænden", "lændehold"], bodyArea: "Ryg", patientGroup: "Voksne", specificity: 8, intent: 18, keywords: ["lændesmerter", "behandling af lændesmerter", "ondt i lænden Odense"] },
  { id: "neck-pain", label: "Nakkesmerter", aliases: ["nakkesmerter", "hold i nakken", "stiv nakke"], bodyArea: "Nakke", patientGroup: "Voksne", specificity: 11, intent: 17, keywords: ["nakkesmerter", "behandling af nakkesmerter", "hold i nakken Odense"] },
  { id: "shoulder-pain", label: "Skuldersmerter", aliases: ["skuldersmerter", "rotator cuff", "impingement"], bodyArea: "Skulder", patientGroup: "Voksne", specificity: 12, intent: 18, keywords: ["skuldersmerter", "rotator cuff behandling", "skuldersmerter om natten"] },
  { id: "headache", label: "Hovedpine", aliases: ["hovedpine", "spændingshovedpine", "migræne"], bodyArea: "Hoved", patientGroup: "Voksne", specificity: 9, intent: 17, keywords: ["hovedpine behandling", "spændingshovedpine", "hovedpine Odense"] },
  { id: "pelvic-pain", label: "Bækkensmerter", aliases: ["bækkensmerter", "halebenssmerter", "bækkenproblemer"], bodyArea: "Bækken", patientGroup: "Voksne", specificity: 17, intent: 18, keywords: ["bækkensmerter", "halebenssmerter behandling", "bækkenproblemer"] },
];

export const demoCompetitors: Competitor[] = [
  { id: "demo-1", name: "Demo klinik · Centrum", category: "Fysioterapi", address: "Centrum", distanceKm: 1.8, topics: ["low-back-pain", "neck-pain", "shoulder-pain", "headache"] },
  { id: "demo-2", name: "Demo klinik · Syd", category: "Kiropraktor", address: "Sydbyen", distanceKm: 3.4, topics: ["low-back-pain", "neck-pain", "jaw-pain"] },
  { id: "demo-3", name: "Demo klinik · Nord", category: "Osteopat", address: "Nordbyen", distanceKm: 4.1, topics: ["low-back-pain", "shoulder-pain", "tennis-elbow"] },
  { id: "demo-4", name: "Demo klinik · Havn", category: "Fysioterapi", address: "Havneområdet", distanceKm: 6.2, topics: ["low-back-pain", "neck-pain", "headache", "tennis-elbow"] },
  { id: "demo-5", name: "Demo klinik · Vest", category: "Smerteklinik", address: "Vestbyen", distanceKm: 8.7, topics: ["low-back-pain", "shoulder-pain", "pelvic-pain"] },
  { id: "demo-6", name: "Demo klinik · Øst", category: "Manuel terapeut", address: "Østbyen", distanceKm: 11.3, topics: ["low-back-pain", "neck-pain", "tennis-elbow"] },
];

export const mockWebsiteAnalyzer: WebsiteAnalyzer = {
  async analyze() {
    return [
      { id: "low-back-pain", label: "Lændesmerter", bodyArea: "Ryg", patientGroup: "Voksne", status: "candidate" },
      { id: "neck-pain", label: "Nakkesmerter", bodyArea: "Nakke", patientGroup: "Voksne", status: "candidate" },
      { id: "jaw-pain", label: "Kæbesmerter / TMJ", bodyArea: "Kæbe", patientGroup: "Voksne", status: "candidate" },
      { id: "tennis-elbow", label: "Tennisalbue", bodyArea: "Albue", patientGroup: "Voksne", status: "candidate" },
    ];
  },
};

export const mockGooglePlacesProvider: GooglePlacesProvider = {
  async findNearby(city, radiusKm) {
    return city.trim() ? demoCompetitors.filter((competitor) => competitor.distanceKm <= radiusKm) : [];
  },
};

export const mockWebsiteCrawler: WebsiteCrawlerProvider = {
  async crawl(url) {
    return [{ url, title: "Demo-side", headings: ["Behandling", "Symptomer"], snippets: ["Eksempel på offentligt sideindhold fra mock-crawler."] }];
  },
};

export const unavailableSearchProvider: SearchProvider = {
  async search() {
    return null;
  },
};

export const unavailableGoogleAdsProvider: GoogleAdsKeywordProvider = {
  async getKeywordIdeas() {
    return null;
  },
};

export const unavailableMetaAdsProvider: MetaAdsProvider = {
  async searchAds() {
    return null;
  },
};

function missingSignal<T>(source: string, detail: string): DataSignal<T> {
  return { quality: "missing", value: null, source, detail };
}

function factorValue(quality: DataQuality, value: number | null): number | null {
  return quality === "missing" ? null : value;
}

function normalizedDemand(searches: number): number {
  return Math.round(Math.min(100, (Math.log10(searches + 1) / 3) * 100));
}

export function buildTopicKeywordIdeas(topic: Topic, city: string): string[] {
  const location = city.trim();
  const seeds = [topic.label, ...topic.aliases, ...topic.keywords];
  return [...new Set(seeds.flatMap((seed) => location ? [seed, `${seed} ${location}`] : [seed]))];
}

export function buildGoogleAdsSeedKeywords(profile: TreatmentArea[], city: string): string[] {
  const approved = profile.filter((treatment) => treatment.status === "approved");
  const recognizedTopics = topics.filter((topic) => approved.some((treatment) => treatment.id === topic.id));
  const generated = recognizedTopics.flatMap((topic) => buildTopicKeywordIdeas(topic, city));
  const manualSeeds = approved.filter((treatment) => !topics.some((topic) => topic.id === treatment.id)).map((treatment) => city.trim() ? `${treatment.label} ${city.trim()}` : treatment.label);
  return [...new Set([...generated, ...manualSeeds])];
}

function adsCompetitionScore(response: GoogleAdsKeywordResponse): number | null {
  const indexes = response.ideas.map((idea) => idea.competitionIndex).filter((value): value is number => value !== null);
  if (indexes.length) return Math.round(100 - indexes.reduce((sum, value) => sum + value, 0) / indexes.length);
  const levels = response.ideas.map((idea) => idea.competition);
  if (!levels.length) return null;
  const scores = { LOW: 90, MEDIUM: 55, HIGH: 15, UNSPECIFIED: null };
  const available = levels.map((level) => scores[level]).filter((value): value is number => value !== null);
  return available.length ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length) : null;
}

export function getTopicMetrics(topic: Topic, competitors: Competitor[], treatmentApproved: boolean, research?: Partial<TopicResearch>): TopicMetrics {
  const matchingCompetitors = competitors.filter((competitor) => competitor.topics.includes(topic.id));
  const hasCompetitorData = competitors.length > 0;
  const coveragePercent = hasCompetitorData ? Math.round((matchingCompetitors.length / competitors.length) * 100) : null;
  const localProviders: DataSignal<number> = hasCompetitorData
    ? { quality: "estimated", value: competitors.length, source: "demo-places", detail: "Demo-datasæt, ikke verificeret lokalt" }
    : missingSignal("google-places", "Kør en scanning for lokale klinikker");
  const websiteTopic: DataSignal<{ mentions: number; total: number; coveragePercent: number }> = hasCompetitorData
    ? { quality: "estimated", value: { mentions: matchingCompetitors.length, total: competitors.length, coveragePercent: coveragePercent ?? 0 }, source: "demo-websites", detail: "Emneomtaler fra demo-data" }
    : missingSignal("website-crawler", "Konkurrenternes websites er ikke analyseret");
  const search = research?.search ?? missingSignal<SearchResponse>("search-provider", "Search provider ikke forbundet");
  const googleAds = research?.googleAds ?? missingSignal<GoogleAdsKeywordResponse>("google-ads", "Google Ads ikke forbundet");
  const metaAds = research?.metaAds ?? missingSignal<MetaAd[]>("meta-ads", "Meta-data ikke tilgængelig");
  const hasSearchData = search.value !== null && (search.value.resultCount !== null || search.value.results.length > 0);
  const monthlySearches = googleAds.value?.ideas.map((idea) => idea.averageMonthlySearches).filter((value): value is number => value !== null) ?? [];
  const domainCount = search.value?.results.length ?? 0;
  const metaClinicCount = metaAds.value ? new Set(metaAds.value.map((ad) => ad.clinicName ?? ad.advertiserName)).size : 0;
  const adsScore = googleAds.value ? adsCompetitionScore(googleAds.value) : null;
  const scoreFactors: ScoreFactor[] = [
    { id: "treatment-relevance", label: "Behandlingsrelevans", weight: opportunityScoreWeights.treatmentRelevance, value: factorValue("verified", treatmentApproved ? 100 : null), quality: treatmentApproved ? "verified" : "missing", detail: treatmentApproved ? "Området er godkendt af klinikken" : "Ikke godkendt" },
    { id: "search-demand", label: "Google-søgeefterspørgsel", weight: opportunityScoreWeights.searchDemand, value: monthlySearches.length ? normalizedDemand(monthlySearches.reduce((sum, value) => sum + value, 0) / monthlySearches.length) : null, quality: monthlySearches.length ? googleAds.quality : "missing", detail: monthlySearches.length ? `${Math.round(monthlySearches.reduce((sum, value) => sum + value, 0) / monthlySearches.length)} gennemsnitlige søgninger pr. måned` : "Månedlig volumen ikke tilgængelig" },
    { id: "website-topic-competition", label: "Website-emnekonkurrence", weight: opportunityScoreWeights.websiteTopicCompetition, value: websiteTopic.value ? 100 - websiteTopic.value.coveragePercent : null, quality: websiteTopic.quality, detail: websiteTopic.value ? `${websiteTopic.value.mentions}/${websiteTopic.value.total} profilerer sig på emnet` : websiteTopic.detail },
    { id: "google-ads-competition", label: "Google Ads-konkurrence", weight: opportunityScoreWeights.googleAdsCompetition, value: adsScore, quality: adsScore === null ? "missing" : googleAds.quality, detail: adsScore === null ? "Google Ads ikke forbundet" : "Konkurrenceniveau fra Keyword Planner" },
    { id: "meta-ads-competition", label: "Meta-annoncekonkurrence", weight: opportunityScoreWeights.metaAdsCompetition, value: metaAds.value ? Math.max(0, 100 - metaClinicCount * 15) : null, quality: metaAds.quality, detail: metaAds.value ? `${metaClinicCount} annoncører i datakilden` : metaAds.detail },
    { id: "search-result-competition", label: "Search-resultatkonkurrence", weight: opportunityScoreWeights.searchResultCompetition, value: hasSearchData ? Math.max(0, 100 - domainCount * 10) : null, quality: hasSearchData ? search.quality : "missing", detail: hasSearchData ? `${domainCount} domæner fra Search provider` : search.detail },
    { id: "search-intent-specificity", label: "Søgeintention / specificitet", weight: opportunityScoreWeights.searchIntentSpecificity, value: Math.round(((topic.specificity + topic.intent) / 40) * 100), quality: "verified", detail: "Regelbaseret emneklassifikation" },
  ];
  const availableFactors = scoreFactors.filter((factor) => factor.value !== null && factor.quality !== "missing");
  const availableWeight = availableFactors.reduce((sum, factor) => sum + factor.weight, 0);
  const score = treatmentApproved && availableWeight
    ? Math.round(availableFactors.reduce((sum, factor) => sum + (factor.value ?? 0) * factor.weight, 0) / availableWeight)
    : null;
  const dataConfidence = Math.round(scoreFactors.reduce((sum, factor) => sum + factor.weight * (factor.quality === "verified" ? 1 : factor.quality === "estimated" ? 0.5 : 0), 0));

  return {
    competitors: matchingCompetitors,
    coveragePercent,
    score,
    dataConfidence,
    resultCount: search.value?.resultCount ?? null,
    monthlySearches: monthlySearches.length ? Math.round(monthlySearches.reduce((sum, value) => sum + value, 0) / monthlySearches.length) : null,
    competition: { localProviders, websiteTopic, search, googleAds, metaAds },
    scoreFactors,
  };
}
