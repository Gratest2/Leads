"use client";

import { useEffect, useState } from "react";
import { buildTopicKeywordIdeas, getTopicMetrics, mockGooglePlacesProvider, mockWebsiteAnalyzer, topics, type Competitor, type DataQuality, type DataSourceStatus, type TreatmentArea } from "@/lib/radar";

type View = "overview" | "profile" | "competitors" | "sources";
type Sort = "score" | "competition" | "coverage";
const STORAGE_KEY = "niche-radar-v1";

export default function RadarApp() {
  const [view, setView] = useState<View>("overview");
  const [city, setCity] = useState("Odense");
  const [radius, setRadius] = useState("25");
  const [customRadius, setCustomRadius] = useState(25);
  const [website, setWebsite] = useState("https://kfmm.dk");
  const [treatments, setTreatments] = useState<TreatmentArea[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState("Alle områder");
  const [sort, setSort] = useState<Sort>("score");
  const [query, setQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [newTreatment, setNewTreatment] = useState("");
  const [saved, setSaved] = useState(false);
  const [dataSources, setDataSources] = useState<DataSourceStatus[] | null>(null);
  const [sourceStatusError, setSourceStatusError] = useState<string | null>(null);
  const [sourceRefresh, setSourceRefresh] = useState(0);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const timeout = window.setTimeout(() => {
      try {
        const state = JSON.parse(stored) as { treatments?: TreatmentArea[]; city?: string; radius?: string; website?: string; competitors?: Competitor[]; analyzed?: boolean };
        setTreatments(state.treatments ?? []);
        setCity(state.city ?? "Odense");
        setRadius(state.radius ?? "25");
        setWebsite(state.website ?? "https://kfmm.dk");
        setCompetitors(state.competitors ?? []);
        setAnalyzed(state.analyzed ?? false);
        setSaved(true);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (saved) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ treatments, city, radius, website, competitors, analyzed }));
  }, [treatments, city, radius, website, competitors, analyzed, saved]);

  useEffect(() => {
    if (view !== "sources") return;
    let active = true;
    fetch("/api/data-sources")
      .then((response) => {
        if (!response.ok) throw new Error("Status kunne ikke hentes");
        return response.json() as Promise<{ sources: DataSourceStatus[] }>;
      })
      .then(({ sources }) => {
        if (active) {
          setDataSources(sources);
          setSourceStatusError(null);
        }
      })
      .catch(() => {
        if (active) setSourceStatusError("Datakildestatus kunne ikke hentes. Kontrollér forbindelsen til appen.");
      });
    return () => { active = false; };
  }, [view, sourceRefresh]);

  const approvedTreatments = treatments.filter((item) => item.status === "approved");
  const candidateTreatments = treatments.filter((item) => item.status === "candidate");
  const eligibleTopics = topics.filter((topic) => approvedTreatments.some((item) => item.id === topic.id));
  const rows = eligibleTopics.map((topic) => ({ topic, metrics: getTopicMetrics(topic, competitors, true) }))
    .filter(({ topic }) => `${topic.label} ${topic.bodyArea} ${topic.patientGroup}`.toLowerCase().includes(query.toLowerCase()) && (filter === "Alle områder" || topic.bodyArea === filter))
    .sort((a, b) => sort === "competition" ? a.metrics.competitors.length - b.metrics.competitors.length : sort === "coverage" ? (a.metrics.coveragePercent ?? 0) - (b.metrics.coveragePercent ?? 0) : (b.metrics.score ?? 0) - (a.metrics.score ?? 0));
  const currentTopic = topics.find((topic) => topic.id === selectedTopic);
  const currentMetrics = currentTopic ? getTopicMetrics(currentTopic, competitors, approvedTreatments.some((item) => item.id === currentTopic.id)) : null;
  const radiusKm = radius === "custom" ? customRadius : Number(radius);

  async function analyzeWebsite() {
    setScanning(true);
    const suggestions = await mockWebsiteAnalyzer.analyze(website);
    setTreatments((current) => {
      const existingIds = new Set(current.map((item) => item.id));
      return [...current, ...suggestions.filter((item) => !existingIds.has(item.id))];
    });
    setAnalyzed(true);
    setSaved(true);
    setScanning(false);
    setView("profile");
  }

  async function findCompetitors() {
    setScanning(true);
    const found = await mockGooglePlacesProvider.findNearby(city, radiusKm);
    setCompetitors(found.filter((item, index, all) => all.findIndex((other) => other.name.toLowerCase() === item.name.toLowerCase()) === index));
    setSaved(true);
    setScanning(false);
  }

  function updateTreatment(id: string, status: TreatmentArea["status"] | null) {
    setTreatments((current) => status ? current.map((item) => item.id === id ? { ...item, status } : item) : current.filter((item) => item.id !== id));
    setSaved(true);
  }

  function addTreatment() {
    const label = newTreatment.trim();
    if (!label) return;
    const normalized = topics.find((topic) => [topic.label, ...topic.aliases].some((alias) => alias.toLowerCase() === label.toLowerCase()));
    const id = normalized?.id ?? `manual-${Date.now()}`;
    const existing = treatments.find((item) => item.id === id || item.label.toLowerCase() === label.toLowerCase());
    if (existing) updateTreatment(existing.id, "approved");
    else {
      setTreatments((current) => [...current, { id, label: normalized?.label ?? label, bodyArea: normalized?.bodyArea ?? "Manuelt tilføjet", patientGroup: normalized?.patientGroup ?? "Ikke angivet", status: "approved" }]);
      setSaved(true);
    }
    setNewTreatment("");
  }

  function saveSettings() {
    setSaved(true);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ treatments, city, radius, website, competitors, analyzed }));
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top" onClick={() => setView("overview")}><span className="brand-mark"><i /></span><span><strong>Niche Radar</strong><small>LOCAL OPPORTUNITY INTELLIGENCE</small></span></a>
      <div className="workspace-label">ARBEJDSOMRÅDE</div>
      <nav className="side-nav" aria-label="Hovednavigation">
        <button className={view === "overview" ? "nav-item active" : "nav-item"} onClick={() => setView("overview")}><span className="nav-glyph">◫</span>Muligheder<span className="nav-count">{rows.length}</span></button>
        <button className={view === "profile" ? "nav-item active" : "nav-item"} onClick={() => setView("profile")}><span className="nav-glyph">◎</span>Behandlingsprofil<span className="nav-count">{approvedTreatments.length}</span></button>
        <button className={view === "competitors" ? "nav-item active" : "nav-item"} onClick={() => setView("competitors")}><span className="nav-glyph">⌖</span>Konkurrenter<span className="nav-count">{competitors.length || "—"}</span></button>
        <button className={view === "sources" ? "nav-item active" : "nav-item"} onClick={() => setView("sources")}><span className="nav-glyph">⚙</span>Indstillinger</button>
      </nav>
      <div className="side-divider" /><div className="scan-label"><span className="live-dot" /> SCANNING</div>
      <label className="field-label" htmlFor="city">By</label><div className="input-with-icon"><span>⌖</span><input id="city" value={city} onChange={(event) => setCity(event.target.value)} /></div>
      <label className="field-label" htmlFor="radius">Radius</label><select id="radius" value={radius} onChange={(event) => setRadius(event.target.value)}>{[5, 10, 15, 25, 50].map((km) => <option key={km} value={km}>{km} km</option>)}<option value="custom">Brugerdefineret</option></select>
      {radius === "custom" && <div className="input-with-unit"><input aria-label="Brugerdefineret radius i kilometer" type="number" min="1" max="200" value={customRadius} onChange={(event) => setCustomRadius(Number(event.target.value))} /><span>km</span></div>}
      <label className="field-label" htmlFor="website">Klinikkens hjemmeside</label><div className="input-with-icon website-input"><span>↗</span><input id="website" value={website} onChange={(event) => setWebsite(event.target.value)} /></div>
      <button className="button button-dark scan-button" onClick={analyzeWebsite} disabled={scanning || !website.trim()}>{scanning ? <><span className="spinner" />Analyserer…</> : <>Analyser hjemmeside <span>→</span></>}</button>
      <button className="button button-outline scan-button" onClick={findCompetitors} disabled={scanning || !city.trim()}>Find lokale konkurrenter <span>↗</span></button>
      <div className="sidebar-bottom"><div className="source-status"><span className="status-dot" /><span><b>Demo-datakilde</b><small>Ingen eksterne API’er tilsluttet</small></span></div><button className="settings-button" onClick={saveSettings} title="Gem indstillinger lokalt"><span>⌑</span>{saved ? "Gemt lokalt" : "Gem lokalt"}</button></div>
    </aside>

    <section className="main-panel" id="top">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>{view === "overview" ? "Muligheder" : view === "profile" ? "Behandlingsprofil" : view === "competitors" ? "Konkurrenter" : "Indstillinger / Datakilder"}</b></div><div className="topbar-right"><span className="demo-pill"><i /> DEMO-MILJØ</span><button className="avatar" title="Lokal klinikprofil">K</button></div></header>
      {view === "overview" && <>
        <div className="page-heading"><div><div className="eyebrow">LOKAL MARKEDSOVERSIGT <span>·</span> {city.toUpperCase()}</div><h1>Find pladsen i markedet.</h1><p>Behandlingsområder med klinik-match og lav lokal synlighed.</p></div><div className="heading-actions"><span className="radius-chip"><span>⌖</span> {city} <b>·</b> {radiusKm} km</span><button className="icon-button" title="Gem scanindstillinger" onClick={saveSettings}>⌑</button></div></div>
        <div className="notice-bar"><span className="notice-icon">i</span><span><b>Demo-data — ikke verificerede markedsmålinger.</b> Søgeresultater og månedlig søgevolumen hentes ikke endnu. Score er foreløbig og beregnes uden efterspørgselsdata.</span><button onClick={() => setView("profile")}>Gennemgå profil <span>→</span></button></div>
        <div className="stat-grid"><div className="stat-block"><span className="stat-label">GODKENDTE OMRÅDER</span><div className="stat-value">{approvedTreatments.length}<small>behandlinger</small></div><span className="stat-foot">Bruges til at afgrænse muligheder</span></div><div className="stat-block"><span className="stat-label">LOKALE KONKURRENTER</span><div className="stat-value">{competitors.length || "—"}<small>{competitors.length ? "i demo-datasæt" : "ikke indlæst"}</small></div><span className="stat-foot">{competitors.length ? `Inden for ${radiusKm} km fra ${city}` : "Kør en konkurrent-scanning"}</span></div><div className="stat-block"><span className="stat-label">ANALYSEREDE HJEMMESIDER</span><div className="stat-value">{competitors.length || "—"}<small>{competitors.length ? "demo-profiler" : "ikke analyseret"}</small></div><span className="stat-foot">Offentlige sider · demo-integration</span></div><div className="stat-block stat-emphasis"><span className="stat-label">NICHEEMNER</span><div className="stat-value">{rows.length}<small>matcher din profil</small></div><span className="stat-foot">Kun godkendte behandlinger tæller</span></div></div>
        <div className="results-header"><div><span className="eyebrow">MULIGHEDER</span><h2>Behandlingsområder</h2></div><button className="text-button" onClick={() => setView("profile")}>Administrer profil <span>→</span></button></div>
        <div className="toolbar"><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søg i emner…" /></label><label className="select-wrap"><span>Område</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>Alle områder</option>{Array.from(new Set(eligibleTopics.map((topic) => topic.bodyArea))).map((area) => <option key={area}>{area}</option>)}</select></label><label className="select-wrap sort-select"><span>Sortér</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="score">Opportunity Score</option><option value="competition">Færrest konkurrenter</option><option value="coverage">Laveste dækning</option></select></label><span className="result-count">{rows.length} emner</span></div>
        <div className="table-wrap"><table><thead><tr><th>EMNE</th><th>SØGERESULTATER</th><th>MÅNEDLIGE SØGNINGER</th><th>KONKURRENTER</th><th>LOKAL DÆKNING</th><th>OPPORTUNITY SCORE</th></tr></thead><tbody>{rows.map(({ topic, metrics }, index) => <tr key={topic.id} onClick={() => setSelectedTopic(topic.id)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelectedTopic(topic.id)}><td><div className="topic-cell"><span className={`topic-index index-${index % 4}`}>{String(index + 1).padStart(2, "0")}</span><span><b>{topic.label}</b><small>{topic.bodyArea} <i>·</i> {topic.patientGroup}</small></span></div></td><td><span className="unavailable">Ikke tilgængelig</span></td><td><span className="unavailable">Ikke tilgængelig</span></td><td><span className="metric-number">{competitors.length ? metrics.competitors.length : "—"}</span><small className="metric-context">{competitors.length ? `af ${competitors.length} demo` : "ikke indlæst"}</small></td><td>{metrics.coveragePercent === null ? <span className="unavailable">Ikke tilgængelig</span> : <div className="coverage-cell"><span className="coverage-track"><i style={{ width: `${metrics.coveragePercent}%` }} /></span><b>{metrics.coveragePercent}%</b></div>}</td><td><div className="score-cell"><span className="score-number">{metrics.score ?? "—"}</span><span className="score-state">{metrics.score === null ? "MANGLER DATA" : "FORELØBIG"}</span></div></td></tr>)}</tbody></table>
          {!rows.length && <div className="empty-state"><div className="empty-radar"><i /><i /><i /></div><h3>{approvedTreatments.length ? "Ingen emner matcher filtrene" : "Start med klinikkens behandlingsprofil"}</h3><p>{approvedTreatments.length ? "Prøv en anden søgning eller nulstil område-filteret." : "Analyser hjemmesiden, og godkend de behandlinger klinikken faktisk tilbyder. Først derefter vises relevante emner."}</p><button className="button button-dark" onClick={() => setView("profile")}>{approvedTreatments.length ? "Se behandlingsprofil" : "Gennemgå behandlingsprofil"} <span>→</span></button></div>}
        </div>
        <footer className="page-footer"><span><i className="footer-dot" /> Data fra mock-integration</span><span>Søgevolumen: ikke tilgængelig <b>·</b> Google Ads ikke tilsluttet</span></footer>
      </>}

      {view === "profile" && <>
        <div className="page-heading"><div><div className="eyebrow">KLINIKKENS GRUNDLAG <span>·</span> TRIN 01</div><h1>Behandlingsprofil</h1><p>Kun godkendte områder bliver brugt til at finde annonce-nicher.</p></div><span className="profile-count">{approvedTreatments.length} GODKENDT</span></div>
        <div className="notice-bar"><span className="notice-icon">i</span><span><b>Hjemmesideanalyse er simuleret i denne version.</b> Vi henter ikke eller gennemgår hjemmesiden endnu. Kontrollér hvert forslag manuelt, før du godkender det.</span><span className="source-tag">MOCK-ANALYSE</span></div>
        <section className="profile-section"><div className="section-title"><div><span className="eyebrow">DIN KLINIK</span><h2>Områder klinikken arbejder med</h2></div><span className="count-label">{approvedTreatments.length} GODKENDT</span></div>
          {approvedTreatments.length ? <div className="treatment-list">{approvedTreatments.map((item) => <TreatmentRow key={item.id} item={item} onRemove={() => updateTreatment(item.id, null)} approved />)}</div> : <div className="profile-empty"><span className="empty-mark">＋</span><div><b>Ingen behandlinger godkendt endnu</b><p>Analysér hjemmesiden, eller tilføj et område manuelt. Forslag bliver aldrig godkendt automatisk.</p></div></div>}
        </section>
        <section className="profile-section candidate-section"><div className="section-title"><div><span className="eyebrow">AFVENTER DIN VURDERING</span><h2>Mulige behandlingsområder</h2></div><span className="count-label muted-count">{candidateTreatments.length} FORSLAG</span></div>
          {!analyzed && !candidateTreatments.length ? <div className="profile-empty"><span className="empty-mark">↗</span><div><b>Ingen hjemmesideanalyse endnu</b><p>Start analysen fra sidepanelet for at få forslag, du kan gennemgå.</p></div><button className="button button-outline" onClick={analyzeWebsite}>Analyser hjemmeside <span>→</span></button></div> : candidateTreatments.length ? <div className="treatment-list">{candidateTreatments.map((item) => <TreatmentRow key={item.id} item={item} onApprove={() => updateTreatment(item.id, "approved")} onRemove={() => updateTreatment(item.id, null)} />)}</div> : <div className="profile-empty compact-empty"><div><b>Alle forslag er gennemgået.</b><p>Tilføj et område manuelt nedenfor.</p></div></div>}
        </section>
        <section className="manual-add"><div><span className="eyebrow">MANUELT</span><h2>Tilføj behandlingsområde</h2></div><div className="add-control"><input value={newTreatment} onChange={(event) => setNewTreatment(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTreatment()} placeholder="Fx svimmelhed, sportsskader…" aria-label="Nyt behandlingsområde" /><button className="button button-dark" onClick={addTreatment} disabled={!newTreatment.trim()}>Tilføj som godkendt <span>＋</span></button></div></section>
        <div className="inline-tip"><span>i</span> Relaterede emner som rotator cuff eller golfalbue kan først indgå i din opportunity-liste, når du selv godkender dem.</div>
      </>}

      {view === "competitors" && <>
        <div className="page-heading"><div><div className="eyebrow">LOKALT LANDSKAB <span>·</span> {city.toUpperCase()}</div><h1>Konkurrenter</h1><p>Offentlige klinikprofiler i det valgte område.</p></div><button className="button button-dark" onClick={findCompetitors} disabled={scanning}>{scanning ? "Scanner…" : "Opdatér scanning  ↗"}</button></div>
        <div className="notice-bar"><span className="notice-icon">i</span><span><b>Demo-klinikker vises.</b> Ingen eksterne kort-, søge- eller hjemmesidekilder er tilsluttet. Afstande og omtaler er testdata.</span><span className="source-tag">MOCK-DATA</span></div>
        <div className="competitor-summary"><div><span className="stat-label">DEMO-KLINIKKER</span><b>{competitors.length}</b></div><div><span className="stat-label">SCANRADIUS</span><b>{radiusKm} <small>km</small></b></div><div><span className="stat-label">DUPLETTER</span><b>0 <small>fjernet</small></b></div></div>
        <div className="competitor-list">{competitors.length ? competitors.map((competitor, index) => <article className="competitor-row" key={competitor.id}><span className={`competitor-avatar avatar-${index % 4}`}>{competitor.name.slice(-1)}</span><div className="competitor-info"><b>{competitor.name}</b><span>{competitor.category} <i>·</i> {competitor.address}</span></div><div className="competitor-topics"><span className="eyebrow">PROFILERER SIG PÅ</span><div>{competitor.topics.map((id) => <span key={id}>{topics.find((topic) => topic.id === id)?.label ?? id}</span>)}</div></div><div className="distance">{competitor.distanceKm.toFixed(1)} <small>km</small></div></article>) : <div className="competitor-empty"><span className="empty-mark">⌖</span><div><b>Ingen konkurrentdata endnu</b><p>Kør en scanning fra sidepanelet for at hente det lokale demo-datasæt.</p></div><button className="button button-outline" onClick={findCompetitors}>Find lokale konkurrenter <span>→</span></button></div>}</div>
        <footer className="page-footer"><span><i className="footer-dot" /> Demo-datasæt · ikke verificeret</span><span>Udvid med Google Places eller anden lokal datakilde</span></footer>
      </>}

      {view === "sources" && <>
        <div className="page-heading"><div><div className="eyebrow">INDSTILLINGER <span>·</span> INTEGRATIONER</div><h1>Datakilder</h1><p>Forbindelser kontrolleres på serveren. Nøgler vises aldrig i browseren.</p></div><button className="button button-outline" onClick={() => setSourceRefresh((value) => value + 1)}>Opdatér status <span>↻</span></button></div>
        <div className="notice-bar"><span className="notice-icon">i</span><span><b>Konfigureret betyder kun, at miljøvariablerne er udfyldt.</b> Appen tester ikke API-adgang eller kontotilladelser, før en provider er implementeret.</span></div>
        <div className="source-list">{sourceStatusError ? <div className="source-load-state">{sourceStatusError}</div> : dataSources === null ? <div className="source-load-state">Henter datakildestatus…</div> : dataSources.map((source) => <article className="source-card" key={source.id}>
          <div className="source-card-head"><div><span className={`source-icon source-icon-${source.id}`}>{source.id === "google-places" ? "PL" : source.id === "website-crawler" ? "WEB" : source.id === "search-provider" ? "SRCH" : source.id === "google-ads" ? "ADS" : "META"}</span><span><b>{source.label}</b><small>{source.description}</small></span></div><span className={`connection-state connection-${source.connection}`}>{source.connection === "mock" ? "MOCK AKTIV" : source.connection === "configured" ? "NØGLER KONFIGURERET" : "IKKE FORBUNDET"}</span></div>
          <div className="source-card-foot">{source.requiredVariables.length ? <><span>Miljøvariabler</span><div>{source.requiredVariables.map((variable) => <code key={variable}>{variable}</code>)}</div></> : <span>Ingen API-nøgle kræves til mock-flowet. Offentlig crawling er endnu ikke implementeret.</span>}</div>
        </article>)}</div>
        <div className="source-security"><span className="security-mark">⌑</span><div><b>Lokale miljøvariabler</b><p>Kopiér navnene fra <code>.env.example</code> til din lokale `.env.local`. Tilføj aldrig nøgler til Git. Google Ads kræver også developer token, customer ID og OAuth credentials.</p></div></div>
      </>}
    </section>

    {currentTopic && currentMetrics && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedTopic(null)}><section className="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title" onClick={(event) => event.stopPropagation()}>
      <div className="detail-top"><span className="eyebrow">EMNEANALYSE <span>·</span> DEMO</span><button className="icon-button close-button" onClick={() => setSelectedTopic(null)} aria-label="Luk">×</button></div>
      <div className="detail-title-row"><div><h2 id="detail-title">{currentTopic.label}</h2><p>{currentTopic.bodyArea} <i>·</i> {currentTopic.patientGroup}</p></div><div className="detail-score"><strong>{currentMetrics.score ?? "—"}</strong><span>{currentMetrics.dataConfidence}% DATA</span></div></div>
      <div className="detail-warning"><b>Confidence {currentMetrics.dataConfidence}%.</b> Scoren normaliseres kun over tilgængelige signaler. Manglende kilder tæller ikke som nul; demo-/estimerede data sænker confidence.</div>
      <div className="detail-section"><div className="section-title"><h3>Konkurrence på flere niveauer</h3><span className="source-tag">SEPARATE SIGNALER</span></div><div className="competition-breakdown">
        <CompetitionRow label="Lokale klinikker" value={currentMetrics.competition.localProviders.value === null ? "Ikke tilgængelig" : `${currentMetrics.competition.localProviders.value} fundet inden for ${radiusKm} km`} quality={currentMetrics.competition.localProviders.quality} />
        <CompetitionRow label="Website-emnedækning" value={currentMetrics.competition.websiteTopic.value ? `${currentMetrics.competition.websiteTopic.value.mentions}/${currentMetrics.competition.websiteTopic.value.total} klinikker · ${currentMetrics.competition.websiteTopic.value.coveragePercent}%` : "Ikke tilgængelig"} quality={currentMetrics.competition.websiteTopic.quality} />
        <CompetitionRow label="Search-konkurrence" value={currentMetrics.competition.search.value && (currentMetrics.resultCount !== null || currentMetrics.competition.search.value.results.length > 0) ? `${new Set(currentMetrics.competition.search.value.results.map((result) => result.domain)).size} domæner fundet` : "Ikke tilgængelig"} quality={currentMetrics.competition.search.value && (currentMetrics.resultCount !== null || currentMetrics.competition.search.value.results.length > 0) ? currentMetrics.competition.search.quality : "missing"} />
        <CompetitionRow label="Google Ads-konkurrence" value={currentMetrics.competition.googleAds.value ? Array.from(new Set(currentMetrics.competition.googleAds.value.ideas.map((idea) => idea.competition).filter((level) => level !== "UNSPECIFIED"))).join(", ") || "Indeks ikke tilgængeligt" : "Ikke tilgængelig"} quality={currentMetrics.competition.googleAds.quality} />
        <CompetitionRow label="Meta-annoncekonkurrence" value={currentMetrics.competition.metaAds.value ? `${new Set(currentMetrics.competition.metaAds.value.map((ad) => ad.clinicName ?? ad.advertiserName)).size} annoncører` : "Ikke tilgængelig"} quality={currentMetrics.competition.metaAds.quality} />
      </div></div>
      <div className="detail-section"><div className="section-title"><h3>Søgeord</h3><span className="source-tag">IDÉER · IKKE SØGEDATA</span></div><div className="keyword-list">{buildTopicKeywordIdeas(currentTopic, city).map((keyword) => <span key={keyword}>{keyword}</span>)}</div></div>
      <div className="detail-section"><div className="section-title"><h3>Lokal dækning</h3><b>{currentMetrics.coveragePercent === null ? "Data ikke tilgængelig" : `${currentMetrics.competitors.length} af ${competitors.length} demo-klinikker`}</b></div>{currentMetrics.coveragePercent === null ? <p className="no-mentions">Kør en konkurrencescanning for at se lokal dækning.</p> : <><div className="detail-meter"><i style={{ width: `${currentMetrics.coveragePercent}%` }} /></div><small>{currentMetrics.coveragePercent}% af demo-klinikkerne profilerer sig på emnet.</small>{currentMetrics.competitors.length ? <div className="mention-list">{currentMetrics.competitors.map((item) => <div key={item.id}><b>{item.name}</b><span>“{currentTopic.label}” nævnt på profilsiden</span><small>Eksempeltekst fra demo-data · ikke hentet fra en offentlig hjemmeside</small></div>)}</div> : <p className="no-mentions">Ingen demo-klinikker profilerer sig tydeligt på dette emne.</p>}</>}</div>
      {currentMetrics.competition.search.value?.results.length ? <div className="detail-section"><div className="section-title"><h3>Lokale søgeresultater</h3><span className="source-tag">SEARCH PROVIDER</span></div><div className="research-results">{currentMetrics.competition.search.value.results.map((result) => <article key={`${result.domain}-${result.position}`}><b>{result.title}</b><span>{result.domain}{result.position ? ` · position ${result.position}` : ""}{result.clinicName ? ` · ${result.clinicName}` : ""}</span><p>{result.snippet}</p></article>)}</div></div> : null}
      {currentMetrics.competition.googleAds.value?.ideas.length ? <div className="detail-section"><div className="section-title"><h3>Keyword Planner</h3><span className="source-tag">{currentMetrics.competition.googleAds.value.cachedAt ? "LOKAL CACHE" : "GOOGLE ADS"}</span></div><div className="keyword-metrics">{currentMetrics.competition.googleAds.value.ideas.map((idea) => <article key={idea.keyword}><b>{idea.keyword}</b><span>{idea.averageMonthlySearches === null ? "Volumen ikke tilgængeligt" : `${idea.averageMonthlySearches.toLocaleString("da-DK")} søgninger/md.`}</span><small>Competition: {idea.competition}{idea.competitionIndex === null ? "" : ` · indeks ${idea.competitionIndex}`}</small><small>Topbud: {idea.topOfPageBidLowMicros === null || idea.topOfPageBidHighMicros === null ? "ikke tilgængeligt" : `${(idea.topOfPageBidLowMicros / 1_000_000).toLocaleString("da-DK", { minimumFractionDigits: 2 })}–${(idea.topOfPageBidHighMicros / 1_000_000).toLocaleString("da-DK", { minimumFractionDigits: 2 })} kr.`}</small></article>)}</div></div> : null}
      {currentMetrics.competition.metaAds.value?.length ? <div className="detail-section"><div className="section-title"><h3>Meta Ad Library</h3><span className="source-tag">ANNONCEEKSEMPLER</span></div><div className="research-results">{currentMetrics.competition.metaAds.value.map((ad) => <article key={ad.adId}><b>{ad.clinicName ?? ad.advertiserName} · {ad.active ? "Aktiv" : "Inaktiv"}</b><span>{ad.platform} · {ad.adId}{ad.startDate ? ` · fra ${ad.startDate}` : ""}</span><p>{ad.headline ? `${ad.headline} · ` : ""}{ad.text}</p></article>)}</div></div> : null}
      <div className="detail-section"><div className="section-title"><h3>Scorefordeling</h3><span className="source-tag">VÆGTET SCORE · NORMALISERET</span></div><div className="factor-list">{currentMetrics.scoreFactors.map((factor) => <div key={factor.id}><span>{factor.label}<small>{factor.detail} · {factor.quality === "verified" ? "verificeret" : factor.quality === "estimated" ? "estimeret" : "mangler"}</small></span><b>{factor.value === null ? "Ikke tilgængelig" : `${factor.value}/100`}<small>Vægt {factor.weight}%</small></b></div>)}</div></div>
      <div className="detail-section search-data"><h3>Søgedata</h3><div><span>Google-resultater <small>Antal sider fra Search provider</small></span><b>{currentMetrics.resultCount === null ? "Ikke tilgængelig" : currentMetrics.resultCount.toLocaleString("da-DK")}</b></div><div><span>Månedlige søgninger <small>Google Ads Keyword Planner</small></span><b>{currentMetrics.monthlySearches === null ? "Ikke tilgængelig" : currentMetrics.monthlySearches.toLocaleString("da-DK")}</b></div></div>
      {!approvedTreatments.some((item) => item.id === currentTopic.id) && <button className="button button-dark full-button" onClick={() => { updateTreatment(currentTopic.id, "approved"); setSelectedTopic(null); setView("profile"); }}>Godkend behandling før brug <span>→</span></button>}
    </section></div>}
  </main>;
}

function TreatmentRow({ item, onApprove, onRemove, approved = false }: { item: TreatmentArea; onApprove?: () => void; onRemove: () => void; approved?: boolean }) {
  return <div className="treatment-row"><span className={approved ? "treatment-check checked" : "treatment-check"}>{approved ? "✓" : "·"}</span><div className="treatment-name"><b>{item.label}</b><span>{item.bodyArea} <i>·</i> {item.patientGroup}</span></div><span className={approved ? "approval-badge approved-badge" : "approval-badge candidate-badge"}>{approved ? "GODKENDT" : "AFVENTER"}</span><div className="treatment-actions">{!approved && <button className="approve-button" onClick={onApprove}>Godkend <span>✓</span></button>}<button className="remove-button" onClick={onRemove} aria-label={`${approved ? "Fjern" : "Afvis"} ${item.label}`}>{approved ? "Fjern" : "Afvis"}</button></div></div>;
}

function CompetitionRow({ label, value, quality }: { label: string; value: string; quality: DataQuality }) {
  const qualityLabel = quality === "verified" ? "VERIFICERET" : quality === "estimated" ? "ESTIMERET" : "MANGLER";
  return <div className="competition-row-detail"><span><b>{label}</b><small className={`signal-quality quality-${quality}`}>{qualityLabel}</small></span><strong>{value}</strong></div>;
}
