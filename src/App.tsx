import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl, { type Map as MapboxMap, type Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AlertTriangle, Building2, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Crosshair, Filter, FolderKanban, Layers3, Map, MapPin, MousePointer2, MoreHorizontal, Plus, Search, Settings2, Users, Wifi, X, Zap } from 'lucide-react';
import { getCityData, type Area, type BuildEntity, type Company, type Sector, type Size } from './sampleData';
import { recordCityEvent } from './eventLog';
import { buildHexGrid, getCellColor, getRampBounds, topGapCells, type HeatMode, type HexCell } from './heatmap';

type ViewMode = 'Network' | 'Heatmap';
type Filters = { sectors: Sector[]; areas: Area[]; sizes: Size[]; funded: boolean; isNew: boolean; minYear: number; maxYear: number };
type ScreenPoint = { x: number; y: number };

const cityData = getCityData('reno-nevada');
const sectorColors: Record<Sector, string> = { 'Energy storage': '#f39b7c', Software: '#7fb7ff', Manufacturing: '#d18cff', Logistics: '#61d7c6' };
const defaultFilters: Filters = { sectors: [], areas: [], sizes: [], funded: false, isNew: false, minYear: 2000, maxYear: 2024 };
const boundary: [number, number][] = [[-119.93, 39.62], [-119.72, 39.60], [-119.68, 39.51], [-119.74, 39.42], [-119.91, 39.42], [-119.98, 39.51], [-119.93, 39.62]];
const sectorList: Sector[] = ['Energy storage', 'Software', 'Manufacturing', 'Logistics'];
const mapBounds = { minLat: 39.42, maxLat: 39.63, minLng: -119.98, maxLng: -119.68 };
const heatModeLabels: { id: HeatMode; label: string }[] = [{ id: 'found', label: 'Found in sources' }, { id: 'buildcities', label: 'BuildCities presence' }, { id: 'gap', label: 'Gap' }];

function EntityIcon({ type }: { type: BuildEntity['type'] }) {
  if (type === 'project') return <FolderKanban size={15} />;
  if (type === 'hub') return <Building2 size={15} />;
  return <CalendarDays size={15} />;
}

function CompanyCard({ company, selected, onSelect, onAdd, shortlist, onShortlist, matchReason, onEvent }: { company: Company; selected: boolean; onSelect: () => void; onAdd: () => void; shortlist: boolean; onShortlist: () => void; matchReason?: string; onEvent: (event: 'useful' | 'not_useful') => void }) {
  const evidence = cityData.evidenceRows.find((row) => row.companyId === company.id);
  return <button className={`company-card ${selected ? 'company-selected' : ''}`} onClick={onSelect}>
    <div className="company-head"><span className="company-ring" style={{ '--sector': sectorColors[company.sector] } as React.CSSProperties}><span /></span><div><strong>{company.name}</strong><small>{company.sector} · {company.area}</small></div><MoreHorizontal size={15} /></div>
    <div className="company-meta">{company.isFunded && <span className="chip funded">Funded</span>}{company.isNew && <span className="chip new-chip">New</span>}<span className="source-line">Source: {company.sourceDomain} · {company.sourceDate}</span></div>
    <div className="people-row"><Users size={13} />{company.roles.map((person) => <span key={`${company.id}-${person.role}`}>{person.role}{person.name ? ` · ${person.name}` : ''}</span>)}<a href="#source" onClick={(event) => event.stopPropagation()}>public profile</a></div>
    {selected && <div className="evidence-block">{matchReason && <strong>{matchReason}</strong>}<span>{company.evidence || evidence?.summary || `Public source listing describes ${company.sector.toLowerCase()} work in ${company.area}.`}</span></div>}
    {selected && <div className="card-actions"><button onClick={(event) => { event.stopPropagation(); onEvent('useful'); }}><Check size={13} /> Useful</button><button onClick={(event) => { event.stopPropagation(); onEvent('not_useful'); }}>Not useful</button><button onClick={(event) => { event.stopPropagation(); onShortlist(); }}>{shortlist ? 'Shortlisted' : 'Add to shortlist'}</button><button className="add-button" onClick={(event) => { event.stopPropagation(); onAdd(); }}><Plus size={13} /> Add to BuildCities</button></div>}
  </button>;
}

function BuildCard({ entity, selected, onSelect }: { entity: BuildEntity; selected: boolean; onSelect: () => void }) {
  return <button className={`build-card ${selected ? 'build-selected' : ''}`} onClick={onSelect}><span className={`build-icon ${entity.type}`}><EntityIcon type={entity.type} /></span><span><strong>{entity.name}</strong><small>{entity.type} · {entity.area}</small></span><MoreHorizontal size={15} /></button>;
}

function ScreenHexOverlay({ cells, mode, ramp, selectedCell, onSelect, mapRef }: { cells: HexCell[]; mode: HeatMode; ramp: { min: number; max: number }; selectedCell?: string; onSelect: (id: string) => void; mapRef: React.RefObject<MapboxMap | null> }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const r = () => setTick((t) => t + 1);
    map.on('move', r);
    return () => { map.off('move', r); };
  }, [mapRef]);
  const project = (lat: number, lng: number): ScreenPoint | null => {
    const map = mapRef.current;
    if (!map) return null;
    const p = map.project([lng, lat]);
    return { x: p.x, y: p.y };
  };
  return <svg className="hex-overlay">
    {cells.map((cell) => {
      const color = getCellColor(cell, mode, ramp);
      if (!color) return null;
      const pts = cell.vertices.map((v) => { const p = project(v[0], v[1]); return p ? `${p.x},${p.y}` : null; }).filter(Boolean);
      if (pts.length < 6) return null;
      const isSel = selectedCell === cell.id;
      return <g key={cell.id} className={isSel ? 'hex-cell selected' : 'hex-cell'} onClick={() => onSelect(cell.id)}>
        <polygon points={pts.join(' ')} fill={color} fillOpacity={isSel ? 0.7 : 0.48} stroke={isSel ? '#f2e85c' : 'rgba(20,22,24,0.6)'} strokeWidth={isSel ? 1.8 : 0.5} />
        {isSel && <polygon points={pts.join(' ')} fill="none" stroke="#f2e85c" strokeWidth={2.4} className="hex-pulse" />}
      </g>;
    })}
  </svg>;
}

function LassoOverlay({ mapRef, onResult }: { mapRef: React.RefObject<MapboxMap | null>; onResult: (points: [number, number][]) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [pts, setPts] = useState<[number, number][]>([]);
  const [cursor, setCursor] = useState<[number, number] | null>(null);

  const toLngLat = (clientX: number, clientY: number): [number, number] | null => {
    const map = mapRef.current;
    const svg = svgRef.current;
    if (!map || !svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const ll = map.unproject([x, y]);
    return [ll.lat, ll.lng];
  };

  const begin = (e: React.PointerEvent) => {
    if (!svgRef.current) return;
    svgRef.current.setPointerCapture(e.pointerId);
    setDrawing(true);
    setPts([]);
    const p = toLngLat(e.clientX, e.clientY);
    if (p) setPts([p]);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing) return;
    const p = toLngLat(e.clientX, e.clientY);
    if (!p) return;
    setPts((cur) => [...cur, p]);
    const svg = svgRef.current;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      setCursor([e.clientX - rect.left, e.clientY - rect.top]);
    }
  };
  const end = (e: React.PointerEvent) => {
    svgRef.current?.releasePointerCapture(e.pointerId);
    setDrawing(false);
    setCursor(null);
    if (pts.length >= 4) onResult(pts);
    setPts([]);
  };

  const toScreen = (lat: number, lng: number): ScreenPoint | null => {
    const map = mapRef.current;
    if (!map) return null;
    const p = map.project([lng, lat]);
    return { x: p.x, y: p.y };
  };

  return <svg ref={svgRef} className={`lasso-overlay ${drawing ? 'active' : ''}`} onPointerDown={begin} onPointerMove={move} onPointerUp={end}>
    {pts.length > 1 && (() => {
      const screenPts = pts.map((p) => toScreen(p[0], p[1])).filter(Boolean) as ScreenPoint[];
      const d = screenPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
      const close = screenPts.length > 2 ? 'Z' : '';
      return <path d={`${d}${close}`} className="lasso-path" />;
    })()}
    {drawing && cursor && <circle cx={cursor[0]} cy={cursor[1]} r={3} className="lasso-cursor" />}
  </svg>;
}

function MapCanvas({ view, filteredCompanies, filteredEntities, selectedProject, selectedCompany, onCompany, onProject, addedCompanies, onOpenLasso, onCluster, heatCells, heatMode, heatRamp, selectedCell, onSelectCell, onLasso, lassoActive, mapRef }: { view: ViewMode; filteredCompanies: Company[]; filteredEntities: BuildEntity[]; selectedProject?: BuildEntity; selectedCompany?: Company; onCompany: (id: string) => void; onProject: (id: string) => void; addedCompanies: string[]; onOpenLasso: () => void; onCluster: () => void; heatCells: HexCell[]; heatMode: HeatMode; heatRamp: { min: number; max: number }; selectedCell?: string; onSelectCell: (id: string) => void; onLasso: (pts: [number, number][]) => void; lassoActive?: boolean; mapRef: React.MutableRefObject<MapboxMap | null> }) {
  const mapRoot = useRef<HTMLDivElement>(null);
  const localMapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [mapTick, setMapTick] = useState(0);
  const token = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.MAPBOX_TOKEN;
  const lineMatches = useMemo(() => selectedProject ? cityData.matches.filter((match) => match.projectId === selectedProject.id).map((match) => ({ match, company: cityData.companies.find((company) => company.id === match.companyId) })).filter((item): item is { match: typeof cityData.matches[number]; company: Company } => Boolean(item.company && item.company.lat !== undefined && item.company.lng !== undefined && filteredCompanies.some((company) => company.id === item.company?.id))) : [], [selectedProject, filteredCompanies]);

  useEffect(() => {
    if (!mapRoot.current || !token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({ container: mapRoot.current, style: import.meta.env.STYLE || 'mapbox://styles/mapbox/dark-v11', center: [-119.8138, 39.5296], zoom: 11 });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    const refresh = () => setMapTick((tick) => tick + 1);
    map.on('move', refresh);
    map.on('load', () => {
      map.addSource('reno-boundary', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [boundary] } } });
      map.addLayer({ id: 'reno-boundary-line', type: 'line', source: 'reno-boundary', paint: { 'line-color': '#f2e85c', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.9 } });
      refresh();
    });
    localMapRef.current = map;
    mapRef.current = map;
    return () => { map.off('move', refresh); markersRef.current.forEach((m) => m.remove()); map.remove(); localMapRef.current = null; mapRef.current = null; };
  }, [token, mapRef]);

  useEffect(() => {
    if (!localMapRef.current || view === 'Heatmap') return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const map = localMapRef.current;
    filteredEntities.forEach((entity) => {
      const element = document.createElement('button');
      const isSelected = selectedProject?.id === entity.id;
      element.className = `map-pin build-pin ${entity.type} ${isSelected ? 'selected-build-pin' : ''} ${selectedProject && !isSelected ? 'dim-pin' : ''}`;
      element.innerHTML = `<span></span><b>${entity.name}</b>`;
      element.onclick = () => onProject(entity.id);
      markersRef.current.push(new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([entity.lng, entity.lat]).addTo(map));
    });
    filteredCompanies.forEach((company) => {
      if (company.lat === undefined || company.lng === undefined) return;
      const element = document.createElement('button');
      const isAdded = addedCompanies.includes(company.id);
      const isMatch = !selectedProject || lineMatches.some((item) => item.company.id === company.id);
      element.className = `map-pin ${isAdded ? 'build-pin added-pin' : 'company-pin'} ${company.isNew ? 'pin-new' : ''} ${selectedCompany?.id === company.id ? 'pin-selected' : ''} ${isMatch ? 'match-pin' : 'dim-pin'}`;
      element.style.setProperty('--sector', sectorColors[company.sector]);
      element.innerHTML = `<span></span><b>${company.name}${isAdded ? ' · BuildCities' : ''}</b>`;
      element.onclick = () => onCompany(company.id);
      markersRef.current.push(new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([company.lng, company.lat]).addTo(map));
    });
  }, [filteredCompanies, filteredEntities, selectedProject, selectedCompany, addedCompanies, onCompany, onProject, view, lineMatches]);

  const screenPoint = (lat: number, lng: number): ScreenPoint | undefined => {
    if (localMapRef.current) { const p = localMapRef.current.project([lng, lat]); return { x: p.x, y: p.y }; }
    if (!mapRoot.current) return undefined;
    return { x: ((lng + 119.95) / 0.25) * mapRoot.current.clientWidth, y: ((39.64 - lat) / 0.23) * mapRoot.current.clientHeight };
  };
  const sourcePoint = selectedProject ? screenPoint(selectedProject.lat, selectedProject.lng) : undefined;

  return <div className={`map-canvas ${token ? 'mapbox-ready' : ''} ${selectedProject ? 'project-selected' : ''} ${view === 'Heatmap' ? 'heatmap-active' : ''}`}>
    <div ref={mapRoot} className="mapbox-root" />
    {!token && <div className="map-unavailable"><MapPin size={13} /> Map unavailable · add MAPBOX_TOKEN to enable the live basemap</div>}
    <div className="fallback-grid" />
    {!token && <div className="fallback-boundary" />}
    {!token && view === 'Network' && filteredEntities.map((entity) => <button key={entity.id} className={`fallback-pin build-pin ${entity.type} ${selectedProject?.id === entity.id ? 'selected-build-pin' : ''} ${selectedProject && selectedProject.id !== entity.id ? 'dim-pin' : ''}`} style={{ left: `${((entity.lng + 119.95) / 0.25) * 100}%`, top: `${((39.64 - entity.lat) / 0.23) * 100}%` }} onClick={() => onProject(entity.id)}><span /><b>{entity.name}</b></button>)}
    {!token && view === 'Network' && filteredCompanies.map((company) => company.lat !== undefined && company.lng !== undefined && <button key={company.id} className={`fallback-pin ${addedCompanies.includes(company.id) ? 'build-pin added-pin' : 'company-pin'} ${company.isNew ? 'pin-new' : ''} ${selectedProject && !lineMatches.some((item) => item.company.id === company.id) ? 'dim-pin' : ''}`} style={{ '--sector': sectorColors[company.sector], left: `${((company.lng + 119.95) / 0.25) * 100}%`, top: `${((39.64 - company.lat) / 0.23) * 100}%` } as React.CSSProperties} onClick={() => onCompany(company.id)}><span /><b>{company.name}</b></button>)}
    {view === 'Heatmap' && token && <ScreenHexOverlay cells={heatCells} mode={heatMode} ramp={heatRamp} selectedCell={selectedCell} onSelect={onSelectCell} mapRef={localMapRef} />}
    {view === 'Heatmap' && lassoActive && <LassoOverlay mapRef={localMapRef} onResult={onLasso} />}
    {view === 'Network' && sourcePoint && <svg className="match-overlay" key={mapTick}>{lineMatches.map(({ match, company }) => { const target = company.lat !== undefined && company.lng !== undefined ? screenPoint(company.lat, company.lng) : undefined; if (!target) return null; const dx = target.x - sourcePoint.x; const dy = target.y - sourcePoint.y; const angle = Math.atan2(dy, dx) * 180 / Math.PI; const midpoint = { x: sourcePoint.x + dx / 2, y: sourcePoint.y + dy / 2 }; return <g key={company.id} className="match-connection"><line x1={sourcePoint.x} y1={sourcePoint.y} x2={target.x} y2={target.y} /><g transform={`translate(${midpoint.x} ${midpoint.y}) rotate(${angle})`}><rect x="-47" y="-10" width="94" height="19" rx="4" /><text textAnchor="middle" y="4">{match.reason}</text></g></g>; })}</svg>}
    <div className="reno-label">Reno + Sparks <small>approximate boundary</small></div>
    {view === 'Network' && <><button className="cluster cluster-a" onClick={onCluster}>6</button><button className="cluster cluster-b" onClick={onCluster}>3</button></>}
    <div className="map-tools"><button onClick={() => localMapRef.current?.zoomIn()}><Plus size={16} /></button><button onClick={() => localMapRef.current?.zoomOut()}><span>−</span></button><button onClick={() => localMapRef.current?.fitBounds([[-119.95, 39.43], [-119.70, 39.63]], { padding: 50 })}><Crosshair size={15} /></button></div>
    <div className="map-bottom-tools"><button onClick={onOpenLasso}><MousePointer2 size={16} /> Lasso</button><button><Layers3 size={16} /></button><button className="close-map"><X size={18} /></button></div>
  </div>;
}

function HeatLegend({ mode, ramp, cells }: { mode: HeatMode; ramp: { min: number; max: number }; cells: HexCell[] }) {
  const stops = 5;
  const labeled = mode === 'gap' ? ['Low', '', '', '', 'High'] : [`${ramp.min}`, '', '', '', `${ramp.max}`];
  const counted = cells.filter((c) => getCellColor(c, mode, ramp) !== null).length;
  const total = cells.length;
  const unplaced = cityData.companies.filter((c) => c.lat === undefined).length;
  return <div className="heat-legend">
    <div className="heat-scale">
      <div className="heat-ramp">{Array.from({ length: stops }).map((_, i) => {
        const t = i / (stops - 1);
        const v = mode === 'gap' ? t : ramp.min + t * (ramp.max - ramp.min || 1);
        const fakeCell: HexCell = { companiesFound: mode === 'buildcities' ? 0 : v, buildcitiesCount: mode === 'buildcities' ? v : 0 } as HexCell;
        const color = getCellColor(fakeCell, mode, { min: mode === 'gap' ? 0 : ramp.min, max: mode === 'gap' ? 1 : ramp.max }) || 'transparent';
        return <span key={i} style={{ background: color }} />;
      })}</div>
      <div className="heat-scale-labels">{labeled.map((l, i) => <span key={i}>{l}</span>)}</div>
    </div>
    <div className="heat-counts"><span>{counted} cells colored</span><span>{total} total</span></div>
    <p className="heat-note">{unplaced} need a location and are not counted.</p>
  </div>;
}

function CellSummaryCard({ cell, onShowCompanies, onClose }: { cell: HexCell; onShowCompanies: () => void; onClose: () => void }) {
  const sectors = Object.entries(cell.sectorCounts).sort((a, b) => b[1] - a[1]);
  const nearbyHubs = cell.entities.filter((e) => e.type === 'hub');
  const nearbyProjects = cell.entities.filter((e) => e.type === 'project');
  return <div className="cell-summary">
    <button className="cell-close" onClick={onClose}><X size={14} /></button>
    <div className="cell-summary-head"><strong>{cell.areaName}</strong><small>hex cell · {cell.companiesFound} found · {cell.buildcitiesCount} BuildCities</small></div>
    <div className="cell-summary-section"><span className="cell-label">Companies by sector</span>{sectors.length ? <div className="cell-sectors">{sectors.map(([s, n]) => <span key={s} className="cell-sector-chip" style={{ '--sector': sectorColors[s as Sector] } as React.CSSProperties}>{s} · {n}</span>)}</div> : <small className="cell-empty">None placed</small>}</div>
    <div className="cell-summary-section"><span className="cell-label">New this run</span><small>{cell.newCount}</small></div>
    <div className="cell-summary-section"><span className="cell-label">Nearby BuildCities</span>{nearbyHubs.length === 0 && nearbyProjects.length === 0 ? <small className="cell-empty">None in this cell</small> : <div className="cell-nearby">{nearbyHubs.map((h) => <span key={h.id}><Building2 size={11} /> {h.name}</span>)}{nearbyProjects.map((p) => <span key={p.id}><FolderKanban size={11} /> {p.name}</span>)}</div>}</div>
    <button className="cell-action" onClick={onShowCompanies}><Wifi size={12} /> Show these companies</button>
  </div>;
}

function LassoSummaryCard({ companies, entities, onClose }: { companies: Company[]; entities: BuildEntity[]; onClose: () => void }) {
  const sectors = companies.reduce<Record<string, number>>((acc, c) => { acc[c.sector] = (acc[c.sector] ?? 0) + 1; return acc; }, {});
  const sectorArr = Object.entries(sectors).sort((a, b) => b[1] - a[1]);
  return <div className="cell-summary lasso-summary-card">
    <button className="cell-close" onClick={onClose}><X size={14} /></button>
    <div className="cell-summary-head"><strong>Lasso area</strong><small>{companies.length} companies · {entities.length} BuildCities</small></div>
    <div className="cell-summary-section"><span className="cell-label">Companies by sector</span>{sectorArr.length ? <div className="cell-sectors">{sectorArr.map(([s, n]) => <span key={s} className="cell-sector-chip" style={{ '--sector': sectorColors[s as Sector] } as React.CSSProperties}>{s} · {n}</span>)}</div> : <small className="cell-empty">None placed</small>}</div>
    <div className="cell-summary-section"><span className="cell-label">BuildCities inside</span>{entities.length === 0 ? <small className="cell-empty">None</small> : <div className="cell-nearby">{entities.map((e) => <span key={e.id}>{e.type === 'hub' ? <Building2 size={11} /> : e.type === 'project' ? <FolderKanban size={11} /> : <CalendarDays size={11} />} {e.name}</span>)}</div>}</div>
    <small className="cell-footnote">Sampled inside your selection</small>
  </div>;
}

function NetworkSidebar({ filteredCompanies, filteredEntities, placedCompanies, shownCount, filters, setFilters, selectedProjectId, selectProject, unplaced, unplacedOpen, setUnplacedOpen }: { filteredCompanies: Company[]; filteredEntities: BuildEntity[]; placedCompanies: Company[]; shownCount: number; filters: Filters; setFilters: (f: Filters) => void; selectedProjectId: string; selectProject: (id: string) => void; unplaced: Company[]; unplacedOpen: boolean; setUnplacedOpen: (v: boolean) => void }) {
  return <>
    <section className="analytics-card intro-card"><div className="card-heading"><h2>In view</h2><MoreHorizontal size={16} /></div><div className="big-stats"><div><strong>{cityData.totals.found}</strong><span>Found across Reno + Sparks</span></div><div><strong>{cityData.totals.new}</strong><span>New to BuildCities</span></div><div><strong>{shownCount}</strong><span>Shown on map</span></div></div><p className="honesty-note">Found in sources · visible subset shown on the map</p></section>
    <section className="analytics-card"><div className="card-heading"><h2>Sector mix</h2><MoreHorizontal size={16} /></div><div className="sector-bars">{sectorList.map((sector) => { const count = filteredCompanies.filter((company) => company.sector === sector).length; return <div className="sector-bar" key={sector}><div><span>{sector}</span><small>{count} shown</small></div><i style={{ '--width': `${Math.max(8, (count / Math.max(1, placedCompanies.length)) * 100)}%`, '--sector': sectorColors[sector] } as React.CSSProperties} /></div>; })}</div></section>
    <section className="analytics-card"><div className="card-heading"><h2>BuildCities in view</h2><span>{filteredEntities.length}</span></div><div className="entity-summary"><span><FolderKanban size={14} /> {filteredEntities.filter((entity) => entity.type === 'project').length} projects</span><span><Building2 size={14} /> {filteredEntities.filter((entity) => entity.type === 'hub').length} hubs</span><span><CalendarDays size={14} /> {filteredEntities.filter((entity) => entity.type === 'event').length} events</span></div>{filteredEntities.filter((entity) => entity.type === 'project').map((entity) => <BuildCard key={entity.id} entity={entity} selected={entity.id === selectedProjectId} onSelect={() => selectProject(entity.id)} />)}</section>
    <section className="analytics-card year-card"><div className="card-heading"><h2>Founded year</h2><span>{filters.minYear === 2000 && filters.maxYear === 2024 ? 'Any year' : `${filters.minYear}–${filters.maxYear}`}</span></div><div className="range-inputs"><input type="range" min="2000" max="2024" value={filters.minYear} onChange={(event) => setFilters({ ...filters, minYear: Math.min(Number(event.target.value), filters.maxYear) })} /><input type="range" min="2000" max="2024" value={filters.maxYear} onChange={(event) => setFilters({ ...filters, maxYear: Math.max(Number(event.target.value), filters.minYear) })} /></div><div className="range-labels"><span>2000</span><span>2024</span></div><p>{filteredCompanies.filter((company) => company.foundedYear).length} have a stated year</p></section>
    <section className="analytics-card unplaced-card"><button className="unplaced-toggle" onClick={() => setUnplacedOpen(!unplacedOpen)}><span><MapPin size={14} /> {unplaced.length} need a location</span><ChevronDown size={14} className={unplacedOpen ? 'rotate' : ''} /></button>{unplacedOpen && <div className="unplaced-tray"><small>Unplaced · not pinned until coordinates are found</small>{unplaced.map((company) => <div key={company.id}><span className="company-ring small" style={{ '--sector': sectorColors[company.sector] } as React.CSSProperties}><span /></span>{company.name}<em>{company.sourceDomain}</em></div>)}</div>}</section>
  </>;
}

function HeatSidebar({ heatMode, topGaps, selectedCellId, onSelectCell }: { heatMode: HeatMode; topGaps: HexCell[]; selectedCellId?: string; onSelectCell: (id: string) => void }) {
  return <>
    <section className="analytics-card"><div className="card-heading"><h2>Areas to look at</h2><MoreHorizontal size={16} /></div><p className="heat-intro">Top gap cells · companies found without matching BuildCities presence. Hypothesis, not demand.</p>{topGaps.length === 0 && <p className="heat-empty">No gap cells meet the threshold yet.</p>}{topGaps.map((cell) => {
      const sectors = Object.entries(cell.sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 2);
      return <button key={cell.id} className={`area-item ${selectedCellId === cell.id ? 'selected' : ''}`} onClick={() => onSelectCell(cell.id)}>
        <div className="area-item-head"><strong>{cell.areaName}</strong><span className="area-gaps">{cell.companiesFound} found · {cell.buildcitiesCount} BuildCities</span></div>
        <div className="area-sectors">{sectors.map(([s, n]) => <span key={s} style={{ '--sector': sectorColors[s as Sector] } as React.CSSProperties}>{s} · {n}</span>)}</div>
      </button>;
    })}</section>
    <section className="analytics-card"><div className="card-heading"><h2>What the colors mean</h2></div>
      <div className="heat-mode-help">
        {heatMode === 'found' && <p>Counts companies found in outside sources within each hex cell. Higher counts mean denser discovery, not greater opportunity.</p>}
        {heatMode === 'buildcities' && <p>Counts BuildCities projects, hubs, and events in each cell. Higher counts mean stronger existing presence.</p>}
        {heatMode === 'gap' && <p>Compares normalized found count against normalized BuildCities count. Positive values mark cells with many found companies but little BuildCities presence. It is a hypothesis, not demand.</p>}
      </div>
    </section>
  </>;
}

function App() {
  const [view, setView] = useState<ViewMode>('Network');
  const [selectedProjectId, setSelectedProjectId] = useState('grid-storage');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [addedCompanies, setAddedCompanies] = useState<string[]>([]);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [lassoOpen, setLassoOpen] = useState(false);
  const [setupSaved, setSetupSaved] = useState(false);
  const [unplacedOpen, setUnplacedOpen] = useState(false);
  const [heatMode, setHeatMode] = useState<HeatMode>('found');
  const [heatSector, setHeatSector] = useState<Sector | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string>();
  const [lassoArea, setLassoArea] = useState<{ companies: Company[]; entities: BuildEntity[] } | null>(null);
  const [cellFilterForNetwork, setCellFilterForNetwork] = useState<HexCell | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);

  const selectedProject = cityData.entities.find((entity) => entity.id === selectedProjectId);
  const selectedCompany = cityData.companies.find((company) => company.id === selectedCompanyId);
  const unplaced = cityData.companies.filter((company) => company.lat === undefined);

  const baseFilteredCompanies = useMemo(() => cityData.companies.filter((company) => (!filters.sectors.length || filters.sectors.includes(company.sector)) && (!filters.areas.length || filters.areas.includes(company.area)) && (!filters.sizes.length || filters.sizes.includes(company.size)) && (!filters.funded || company.isFunded) && (!filters.isNew || company.isNew) && (!company.foundedYear || (company.foundedYear >= filters.minYear && company.foundedYear <= filters.maxYear))), [filters]);
  const filteredCompanies = useMemo(() => {
    if (cellFilterForNetwork) return baseFilteredCompanies.filter((c) => cellFilterForNetwork.companies.some((cc) => cc.id === c.id));
    return baseFilteredCompanies;
  }, [baseFilteredCompanies, cellFilterForNetwork]);
  const filteredEntities = cityData.entities.filter((entity) => !filters.areas.length || filters.areas.includes(entity.area));
  const placedCompanies = baseFilteredCompanies.filter((company) => company.lat !== undefined && company.lng !== undefined);
  const shownCount = placedCompanies.length + filteredEntities.length;
  const filterCount = filters.sectors.length + filters.areas.length + filters.sizes.length + Number(filters.funded) + Number(filters.isNew) + Number(filters.minYear > 2000 || filters.maxYear < 2024);
  const matchReason = selectedCompany ? cityData.matches.find((match) => match.projectId === selectedProjectId && match.companyId === selectedCompany.id)?.reason : undefined;
  const log = (event: 'view' | 'select' | 'useful' | 'not_useful' | 'shortlist' | 'add' | 'share', companyId?: string) => recordCityEvent({ event, city: 'reno-nevada', project: selectedProjectId, companyId, timestamp: new Date().toISOString() });
  useEffect(() => { recordCityEvent({ event: 'view', city: 'reno-nevada', timestamp: new Date().toISOString() }); }, []);
  const selectCompany = (id: string) => { setSelectedCompanyId(id); log('select', id); };
  const selectProject = (id: string) => { setSelectedProjectId(id); setSelectedCompanyId(undefined); log('select'); };
  const addCompany = (id: string) => { setAddedCompanies((current) => current.includes(id) ? current : [...current, id]); log('add', id); };
  const toggleShortlist = (id: string) => { setShortlist((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); log('shortlist', id); };
  const applySearch = (value: string) => { setSearch(value); const normalized = value.toLowerCase(); const area = normalized.includes('sparks') ? 'Sparks' : normalized.includes('washoe') ? 'Washoe County' : normalized.includes('reno') ? 'Reno' : undefined; const sector = sectorList.find((item) => normalized.includes(item.toLowerCase().split(' ')[0])); setFilters((current) => ({ ...current, areas: area ? [area as Area] : current.areas, sectors: sector ? [sector] : current.sectors })); };
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.code === 'Space') { event.preventDefault(); setSearchOpen(true); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
  const clearAll = () => { setFilters(defaultFilters); setSearch(''); setSelectedCompanyId(undefined); setCellFilterForNetwork(null); };

  const heatCompanies = useMemo(() => heatSector ? baseFilteredCompanies.filter((c) => c.sector === heatSector) : baseFilteredCompanies, [baseFilteredCompanies, heatSector]);
  const heatEntities = useMemo(() => heatSector ? filteredEntities.filter((e) => e.type === 'hub') : filteredEntities, [filteredEntities, heatSector]);
  const heatCells = useMemo(() => buildHexGrid(heatCompanies, heatEntities, mapBounds, boundary), [heatCompanies, heatEntities]);
  const heatRamp = useMemo(() => getRampBounds(heatCells), [heatCells]);
  const topGaps = useMemo(() => topGapCells(heatCells, heatRamp, 5), [heatCells, heatRamp]);
  const selectedCell = heatCells.find((c) => c.id === selectedCellId);

  const selectCell = (id: string) => { setSelectedCellId(id); const cell = heatCells.find((c) => c.id === id); if (cell && mapRef.current) mapRef.current.flyTo({ center: [cell.centerLng, cell.centerLat], zoom: 13, duration: 700 }); };
  const handleLasso = (pts: [number, number][]) => {
    const inside = (lat: number, lng: number) => {
      let x = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [yi, xi] = pts[i]; const [yj, xj] = pts[j];
        if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) x = !x;
      }
      return x;
    };
    const companies = baseFilteredCompanies.filter((c) => c.lat !== undefined && c.lng !== undefined && inside(c.lat, c.lng));
    const entities = filteredEntities.filter((e) => inside(e.lat, e.lng));
    setLassoArea({ companies, entities });
    setLassoOpen(false);
  };
  const showCellCompanies = () => {
    if (!selectedCell) return;
    setCellFilterForNetwork(selectedCell);
    setView('Network');
    setSelectedCompanyId(undefined);
  };

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark"><Zap size={18} /><span>BuildCities</span></div><nav className="main-nav"><button className="nav-active">Overview</button><button>Discovery</button><button>Library</button></nav><div className="global-search" onClick={() => setSearchOpen(true)}><Search size={16} /><span>{search || 'Search Reno economy'}</span><span className="shortcut">⌘ + Space</span></div><div className="top-actions"><button className={`filter-button ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}><Filter size={15} /> Filters <b>{filterCount}</b></button><button className="clear-button" onClick={clearAll}>Clear all</button><button className="setup-button" onClick={() => { setSetupSaved(true); window.history.replaceState(null, '', `?city=reno-nevada&view=${view.toLowerCase()}&filters=${filterCount}`); }}><Settings2 size={15} /> {setupSaved ? 'View saved' : 'Set up view'}</button></div></header>
    <div className="workspace"><aside className={`sidebar ${sidebarOpen ? '' : 'sidebar-collapsed'}`}><div className="sample-badge">{cityData.source === 'sample' ? 'SAMPLE DATA' : 'LIVE DATA'}<span>Sources checked {cityData.sampleDate}</span></div><div className="sidebar-toolbar"><button onClick={() => setShowFilters(!showFilters)}><Filter size={14} /> Filters <b>{filterCount}</b></button><span /><button onClick={() => setFilters((current) => ({ ...current, minYear: current.minYear === 2000 ? 2018 : 2000 }))}>Founded year <ChevronDown size={14} /></button></div>{showFilters && <FilterPanel filters={filters} setFilters={setFilters} onClose={() => setShowFilters(false)} />}
      {view === 'Heatmap' ? <HeatSidebar heatMode={heatMode} topGaps={topGaps} selectedCellId={selectedCellId} onSelectCell={selectCell} /> : <NetworkSidebar filteredCompanies={filteredCompanies} filteredEntities={filteredEntities} placedCompanies={placedCompanies} shownCount={shownCount} filters={filters} setFilters={setFilters} selectedProjectId={selectedProjectId} selectProject={selectProject} unplaced={unplaced} unplacedOpen={unplacedOpen} setUnplacedOpen={setUnplacedOpen} />}
      <button className="collapse-sidebar" onClick={() => setSidebarOpen(false)}><ChevronLeft size={15} /></button></aside>{!sidebarOpen && <button className="reopen-sidebar" onClick={() => setSidebarOpen(true)}><ChevronRight size={16} /></button>}
      <section className="map-section">
        <div className="view-switcher"><button className={view === 'Network' ? 'selected' : ''} onClick={() => setView('Network')}><Wifi size={14} /> Network</button><button className={view === 'Heatmap' ? 'selected' : ''} onClick={() => setView('Heatmap')}><Map size={14} /> Heatmap</button></div>
        {view === 'Heatmap' && <div className="heat-mode-switch">{heatModeLabels.map((m) => <button key={m.id} className={heatMode === m.id ? 'selected' : ''} onClick={() => setHeatMode(m.id)}>{m.label}</button>)}</div>}
        {view === 'Heatmap' && <div className="heat-sector-chips"><button className={!heatSector ? 'active' : ''} onClick={() => setHeatSector(null)}>All sectors</button>{sectorList.map((s) => <button key={s} className={heatSector === s ? 'active' : ''} onClick={() => setHeatSector(s)} style={heatSector === s ? ({ '--chip': sectorColors[s] } as React.CSSProperties) : undefined}>{s}</button>)}</div>}
        {view === 'Heatmap' && <div className="coverage-badge"><AlertTriangle size={11} /> Coverage gap · hypothesis, not demand</div>}
        {view === 'Heatmap' ? <HeatLegend mode={heatMode} ramp={heatRamp} cells={heatCells} /> : <div className="map-legend"><span><i className="legend-square" /> BuildCities</span>{sectorList.map((sector) => <span key={sector}><i className="legend-ring" style={{ '--legend-sector': sectorColors[sector] } as React.CSSProperties} /> {sector}</span>)}</div>}
        <MapCanvas view={view} filteredCompanies={filteredCompanies} filteredEntities={filteredEntities} selectedProject={selectedProject} selectedCompany={selectedCompany} onCompany={selectCompany} onProject={selectProject} addedCompanies={addedCompanies} onOpenLasso={() => setLassoOpen(true)} onCluster={() => { const map = document.querySelector('.mapboxgl-map'); if (map) map.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 })); }} heatCells={heatCells} heatMode={heatMode} heatRamp={heatRamp} selectedCell={selectedCellId} onSelectCell={selectCell} onLasso={handleLasso} lassoActive={lassoOpen} mapRef={mapRef} />
        {view === 'Network' && selectedCompany && <div className="floating-company"><CompanyCard company={selectedCompany} selected onSelect={() => setSelectedCompanyId(undefined)} onAdd={() => addCompany(selectedCompany.id)} shortlist={shortlist.includes(selectedCompany.id)} onShortlist={() => toggleShortlist(selectedCompany.id)} matchReason={matchReason} onEvent={(event) => log(event, selectedCompany.id)} /></div>}
        {view === 'Heatmap' && selectedCell && <div className="floating-cell"><CellSummaryCard cell={selectedCell} onShowCompanies={showCellCompanies} onClose={() => setSelectedCellId(undefined)} /></div>}
        {view === 'Heatmap' && lassoArea && <div className="floating-cell floating-lasso"><LassoSummaryCard companies={lassoArea.companies} entities={lassoArea.entities} onClose={() => setLassoArea(null)} /></div>}
        {cellFilterForNetwork && view === 'Network' && <div className="cell-filter-banner"><span>Filtered to cell in {cellFilterForNetwork.areaName} · {cellFilterForNetwork.companies.length} companies</span><button onClick={() => setCellFilterForNetwork(null)}><X size={12} /> Clear</button></div>}
        <div className="map-footer">{cityData.source === 'sample' ? 'Sample data' : 'Live data'} · Sources checked {cityData.sampleDate}</div>
        {view === 'Network' && shortlist.length > 0 && <div className="shortlist-tray"><div><strong>Shortlist · {shortlist.length}</strong><span>Grouped by {selectedProject?.name || 'project'}</span>{shortlist.map((id) => <small key={id}>{cityData.companies.find((company) => company.id === id)?.name}</small>)}</div><button onClick={() => { navigator.clipboard?.writeText(window.location.href); log('share'); }}><Copy size={14} /> Copy share link</button></div>}
      </section></div>
    {searchOpen && <div className="search-modal" onClick={() => setSearchOpen(false)}><div className="search-box" onClick={(event) => event.stopPropagation()}><Search size={18} /><input autoFocus value={search} onChange={(event) => applySearch(event.target.value)} placeholder="Try: energy storage in Sparks" /><button onClick={() => setSearchOpen(false)}>Done</button><small>Simple phrases turn into filters. Sources are always shown on each company.</small></div></div>}
  </main>;
}

function FilterPanel({ filters, setFilters, onClose }: { filters: Filters; setFilters: (filters: Filters) => void; onClose: () => void }) {
  const toggle = <T,>(key: 'sectors' | 'areas' | 'sizes', value: T) => { const values = filters[key] as T[]; setFilters({ ...filters, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] }); };
  return <div className="filter-popover"><div className="filter-title"><strong>Explore filters</strong><button onClick={onClose}><X size={14} /></button></div><label>Sector</label><div className="filter-options">{sectorList.map((sector) => <button key={sector} className={filters.sectors.includes(sector) ? 'filter-active' : ''} onClick={() => toggle('sectors', sector)}>{sector}</button>)}</div><label>Area</label><div className="filter-options">{(['Reno', 'Sparks', 'Washoe County'] as Area[]).map((area) => <button key={area} className={filters.areas.includes(area) ? 'filter-active' : ''} onClick={() => toggle('areas', area)}>{area}</button>)}</div><label>More</label><div className="filter-checks"><button onClick={() => setFilters({ ...filters, funded: !filters.funded })} className={filters.funded ? 'filter-active' : ''}>Funded</button><button onClick={() => setFilters({ ...filters, isNew: !filters.isNew })} className={filters.isNew ? 'filter-active' : ''}>New</button></div><button className="apply-filter" onClick={onClose}>Show visible examples</button></div>;
}

export default App;
