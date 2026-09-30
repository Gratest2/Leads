import type { DataSourceStatus } from "@/lib/radar";

export const dynamic = "force-dynamic";

const sourceDefinitions: Omit<DataSourceStatus, "connection">[] = [
  {
    id: "google-places",
    label: "Google Places",
    requiredVariables: ["GOOGLE_PLACES_API_KEY"],
    description: "Lokale behandlere, sted-ID, adresse, koordinater og afstand.",
  },
  {
    id: "website-crawler",
    label: "Website crawler",
    requiredVariables: [],
    description: "Offentlige kliniksider. En rigtig crawler skal overholde robots.txt, rate limits og samme-origin crawl-politik.",
  },
  {
    id: "search-provider",
    label: "Google Search provider",
    requiredVariables: ["SEARCH_API_ENDPOINT", "SEARCH_API_KEY"],
    description: "Søgeresultater, domæner, titler, snippets og positioner via en legitim Search API.",
  },
  {
    id: "google-ads",
    label: "Google Ads Keyword Planner",
    requiredVariables: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN"],
    description: "Keyword ideas, månedlige søgninger, konkurrenceindeks og budintervaller.",
  },
  {
    id: "meta-ads",
    label: "Meta Ad Library",
    requiredVariables: ["META_ACCESS_TOKEN"],
    description: "Tilgængelige annonce-ID’er, annoncører, tekst, status, destination og emner.",
  },
];

export async function GET() {
  const sources: DataSourceStatus[] = sourceDefinitions.map((source) => {
    if (source.id === "website-crawler") return { ...source, connection: "mock" };
    const configured = source.requiredVariables.every((variable) => Boolean(process.env[variable]?.trim()));
    return { ...source, connection: configured ? "configured" : "not-configured" };
  });

  return Response.json({ sources });
}