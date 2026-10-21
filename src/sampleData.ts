export type Area = 'Reno' | 'Sparks' | 'Washoe County';
export type Sector = 'Energy storage' | 'Software' | 'Manufacturing' | 'Logistics';
export type Size = '1–10' | '11–50' | '51–200';
export type EntityType = 'project' | 'hub' | 'event';

export type Person = { role: string; name?: string };
export type Company = {
  id: string;
  name: string;
  sector: Sector;
  area: Area;
  size: Size;
  foundedYear?: number;
  isFunded: boolean;
  isNew: boolean;
  sourceDomain: string;
  sourceDate: string;
  roles: Person[];
  evidence?: string;
  lat?: number;
  lng?: number;
};
export type BuildEntity = {
  id: string;
  name: string;
  type: EntityType;
  area: Area;
  lat: number;
  lng: number;
  skills?: string[];
  stage?: string;
};
export type Match = { companyId: string; projectId: string; reason: string };
export type EvidenceRow = { companyId: string; sourceDomain: string; sourceDate: string; summary: string };
export type CityDataOptions = { source?: 'sample' | 'live'; projects?: BuildEntity[]; hubs?: BuildEntity[]; events?: BuildEntity[]; companies?: Company[]; evidenceRows?: EvidenceRow[] };
export type CityData = {
  source: 'sample' | 'live';
  city: string;
  sampleDate: string;
  totals: { members: number; projects: number; challenges: number; hubs: number; events: number; library: number; found: number; new: number };
  entities: BuildEntity[];
  companies: Company[];
  evidenceRows: EvidenceRow[];
  matches: Match[];
};

const companies: Company[] = [
  { id: 'dragonfly-energy', name: 'Dragonfly Energy', sector: 'Energy storage', area: 'Reno', size: '51–200', foundedYear: 2012, isFunded: true, isNew: true, sourceDomain: 'dragonflyenergy.com', sourceDate: 'Oct 18, 2026', roles: [{ role: 'Partnerships lead' }, { role: 'Battery engineer', name: 'Taylor' }], lat: 39.5115, lng: -119.8105 },
  { id: 'sierra-grid-labs', name: 'Sierra Grid Labs', sector: 'Energy storage', area: 'Sparks', size: '11–50', foundedYear: 2021, isFunded: false, isNew: true, sourceDomain: 'example-source.com', sourceDate: 'Oct 17, 2026', roles: [{ role: 'Founder' }], lat: 39.5357, lng: -119.7535 },
  { id: 'truckee-sensor', name: 'Truckee Sensor Co', sector: 'Software', area: 'Reno', size: '11–50', foundedYear: 2018, isFunded: false, isNew: false, sourceDomain: 'example-source.com', sourceDate: 'Oct 16, 2026', roles: [{ role: 'IoT product lead' }], lat: 39.5298, lng: -119.8130 },
  { id: 'comstock-firmware', name: 'Comstock Firmware', sector: 'Software', area: 'Reno', size: '1–10', foundedYear: 2022, isFunded: true, isNew: true, sourceDomain: 'comstock.example', sourceDate: 'Oct 15, 2026', roles: [{ role: 'Embedded systems' }], lat: 39.546, lng: -119.828 },
  { id: 'washoe-machining', name: 'Washoe Machining', sector: 'Manufacturing', area: 'Sparks', size: '11–50', foundedYear: 2008, isFunded: false, isNew: false, sourceDomain: 'example-source.com', sourceDate: 'Oct 14, 2026', roles: [{ role: 'Shop manager' }], lat: 39.552, lng: -119.739 },
  { id: 'silver-state-additive', name: 'Silver State Additive', sector: 'Manufacturing', area: 'Reno', size: '1–10', foundedYear: 2020, isFunded: true, isNew: false, sourceDomain: 'silverstate.example', sourceDate: 'Oct 13, 2026', roles: [{ role: 'Operations lead' }], lat: 39.488, lng: -119.794 },
  { id: 'basin-freight', name: 'Basin Freight Systems', sector: 'Logistics', area: 'Sparks', size: '51–200', foundedYear: 2015, isFunded: false, isNew: false, sourceDomain: 'example-source.com', sourceDate: 'Oct 12, 2026', roles: [{ role: 'Routing analyst' }], lat: 39.566, lng: -119.719 },
  { id: 'high-desert-cold', name: 'High Desert Cold Chain', sector: 'Logistics', area: 'Reno', size: '11–50', foundedYear: 2019, isFunded: true, isNew: true, sourceDomain: 'example-source.com', sourceDate: 'Oct 11, 2026', roles: [{ role: 'Supply chain lead' }], lat: 39.477, lng: -119.842 },
  { id: 'pyramid-data', name: 'Pyramid Data Works', sector: 'Software', area: 'Washoe County', size: '1–10', foundedYear: 2023, isFunded: false, isNew: true, sourceDomain: 'pyramid.example', sourceDate: 'Oct 10, 2026', roles: [{ role: 'Data engineer' }] },
  { id: 'reno-fab', name: 'Reno Fabrication Co-op', sector: 'Manufacturing', area: 'Reno', size: '11–50', foundedYear: 2017, isFunded: false, isNew: false, sourceDomain: 'example-source.com', sourceDate: 'Oct 09, 2026', roles: [{ role: 'Member-owner' }], lat: 39.502, lng: -119.856 },
];

const entities: BuildEntity[] = [
  { id: 'grid-storage', name: 'Grid Storage Pilot', type: 'project', area: 'Reno', lat: 39.511, lng: -119.810, skills: ['battery storage', 'power electronics'], stage: 'pilot' },
  { id: 'sensor-network', name: 'Downtown Sensor Network', type: 'project', area: 'Reno', lat: 39.529, lng: -119.814, skills: ['IoT', 'embedded software'], stage: 'ideation' },
  { id: 'prototype-lab', name: 'Rapid Prototype Lab', type: 'project', area: 'Reno', lat: 39.515, lng: -119.832, skills: ['CNC', 'additive manufacturing'], stage: 'building' },
  { id: 'routing-study', name: 'Warehouse Routing Study', type: 'project', area: 'Sparks', lat: 39.535, lng: -119.753, skills: ['logistics', 'data analysis'], stage: 'scaling' },
  { id: 'food-hub', name: 'Local Food Hub', type: 'project', area: 'Sparks', lat: 39.534, lng: -119.754, skills: ['cold storage', 'distribution'], stage: 'ideation' },
  { id: 'midtown-maker', name: 'Midtown Maker Space', type: 'hub', area: 'Reno', lat: 39.511, lng: -119.810 },
  { id: 'downtown-hub', name: 'Downtown Innovation Hub', type: 'hub', area: 'Reno', lat: 39.529, lng: -119.814 },
  { id: 'sparks-workshop', name: 'Sparks Workshop', type: 'hub', area: 'Sparks', lat: 39.535, lng: -119.753 },
  { id: 'founders-night', name: 'Founders Night', type: 'event', area: 'Reno', lat: 39.530, lng: -119.815 },
  { id: 'hardware-demo', name: 'Hardware Demo Day', type: 'event', area: 'Reno', lat: 39.512, lng: -119.809 },
  { id: 'community-build', name: 'Community Build Day', type: 'event', area: 'Sparks', lat: 39.534, lng: -119.754 },
];

const matches: Match[] = [
  { projectId: 'grid-storage', companyId: 'dragonfly-energy', reason: 'Shares: battery storage' },
  { projectId: 'grid-storage', companyId: 'sierra-grid-labs', reason: 'Shares: power electronics' },
  { projectId: 'sensor-network', companyId: 'truckee-sensor', reason: 'Shares: IoT' },
  { projectId: 'sensor-network', companyId: 'comstock-firmware', reason: 'Shares: embedded software' },
  { projectId: 'prototype-lab', companyId: 'washoe-machining', reason: 'Shares: CNC capacity' },
  { projectId: 'prototype-lab', companyId: 'silver-state-additive', reason: 'Shares: additive manufacturing' },
  { projectId: 'routing-study', companyId: 'basin-freight', reason: 'Shares: logistics' },
  { projectId: 'routing-study', companyId: 'pyramid-data', reason: 'Shares: data analysis' },
  { projectId: 'food-hub', companyId: 'high-desert-cold', reason: 'Shares: cold storage' },
  { projectId: 'food-hub', companyId: 'reno-fab', reason: 'Shares: local distribution' },
];

export function getCityData(city: 'reno-nevada', options: CityDataOptions = {}): CityData {
  if (city !== 'reno-nevada') throw new Error('Unsupported city');
  const sourceCompanies = options.companies ?? companies;
  const sourceEntities = options.projects || options.hubs || options.events ? [...(options.projects ?? entities.filter((entity) => entity.type === 'project')), ...(options.hubs ?? entities.filter((entity) => entity.type === 'hub')), ...(options.events ?? entities.filter((entity) => entity.type === 'event'))] : entities;
  const evidenceRows = options.evidenceRows ?? sourceCompanies.map((company) => ({ companyId: company.id, sourceDomain: company.sourceDomain, sourceDate: company.sourceDate, summary: `Public source listing references ${company.sector.toLowerCase()} work in ${company.area}.` }));
  return { source: options.source ?? 'sample', city: 'Reno, Nevada', sampleDate: 'October 19, 2026', totals: { members: 41, projects: 11, challenges: 6, hubs: 3, events: 3, library: 6, found: 235, new: 92 }, entities: sourceEntities, companies: sourceCompanies, evidenceRows, matches };
}
