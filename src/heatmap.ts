import type { BuildEntity, Company, Sector } from './sampleData';

export type HeatMode = 'found' | 'buildcities' | 'gap';

export type SectorCounts = Partial<Record<Sector, number>>;

export type HexCell = {
  id: string;
  row: number;
  col: number;
  centerLat: number;
  centerLng: number;
  vertices: [number, number][];
  companiesFound: number;
  newCount: number;
  buildcitiesCount: number;
  sectorCounts: SectorCounts;
  companies: Company[];
  entities: BuildEntity[];
  areaName: string;
};

const CELL_KM = 1.5;
const EARTH_RADIUS_KM = 6371;
const DEG = Math.PI / 180;

function hexCellSizeAtLat(lat: number): { latStep: number; lngStep: number } {
  const latRad = lat * DEG;
  const kmPerDegLat = (2 * Math.PI * EARTH_RADIUS_KM) / 360;
  const kmPerDegLng = kmPerDegLat * Math.cos(latRad);
  const heightKm = CELL_KM * Math.sqrt(3);
  const widthKm = CELL_KM * 2;
  return {
    latStep: heightKm / kmPerDegLat,
    lngStep: (widthKm * 0.75) / kmPerDegLng,
  };
}

function pointInPolygon(lat: number, lng: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function nearestAreaName(lat: number, lng: number, entities: BuildEntity[], companies: Company[]): string {
  let best = 'Reno–Sparks area';
  let bestDist = Infinity;
  for (const e of entities) {
    const d = (e.lat - lat) ** 2 + (e.lng - lng) ** 2;
    if (d < bestDist) { bestDist = d; best = e.area; }
  }
  for (const c of companies) {
    if (c.lat === undefined || c.lng === undefined) continue;
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestDist) { bestDist = d; best = c.area; }
  }
  return best;
}

export function buildHexGrid(
  companies: Company[],
  entities: BuildEntity[],
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  boundary: [number, number][],
): HexCell[] {
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const { latStep, lngStep } = hexCellSizeAtLat(midLat);
  const cells: HexCell[] = [];
  const padLat = latStep;
  const padLng = lngStep;
  const startRow = Math.floor((bounds.minLat - padLat) / latStep);
  const endRow = Math.ceil((bounds.maxLat + padLat) / latStep);
  const startCol = Math.floor((bounds.minLng - padLng) / lngStep);
  const endCol = Math.ceil((bounds.maxLng + padLng) / lngStep);

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const centerLat = row * latStep;
      const centerLng = col * lngStep + (row % 2 ? lngStep / 2 : 0);
      const verts: [number, number][] = [];
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI / 3) * k + Math.PI / 6;
        const dLat = (CELL_KM / EARTH_RADIUS_KM) * (180 / Math.PI) * Math.cos(ang);
        const dLng = (CELL_KM / (EARTH_RADIUS_KM * Math.cos(centerLat * DEG))) * (180 / Math.PI) * Math.sin(ang);
        verts.push([centerLat + dLat, centerLng + dLng]);
      }
      const inBoundary = pointInPolygon(centerLat, centerLng, boundary);
      if (!inBoundary) {
        if (!pointInPolygon(verts[0][0], verts[0][1], boundary) && !pointInPolygon(verts[3][0], verts[3][1], boundary)) {
          continue;
        }
      }
      const cellCompanies = companies.filter((c) => c.lat !== undefined && c.lng !== undefined && pointInPolygon(c.lat, c.lng, verts));
      const cellEntities = entities.filter((e) => pointInPolygon(e.lat, e.lng, verts));
      const sectorCounts: SectorCounts = {};
      for (const c of cellCompanies) {
        sectorCounts[c.sector] = (sectorCounts[c.sector] ?? 0) + 1;
      }
      const newCount = cellCompanies.filter((c) => c.isNew).length;
      cells.push({
        id: `hex-${row}-${col}`,
        row,
        col,
        centerLat,
        centerLng,
        vertices: verts,
        companiesFound: cellCompanies.length,
        newCount,
        buildcitiesCount: cellEntities.length,
        sectorCounts,
        companies: cellCompanies,
        entities: cellEntities,
        areaName: nearestAreaName(centerLat, centerLng, entities, companies),
      });
    }
  }
  return cells;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function rampColor(range: { min: number; max: number }, value: number): string {
  const t = clamp01((value - range.min) / (range.max - range.min || 1));
  const stops = [
    [48, 52, 54],
    [89, 76, 42],
    [168, 142, 52],
    [232, 214, 92],
    [242, 232, 92],
  ];
  const seg = t * (stops.length - 1);
  const i = Math.min(Math.floor(seg), stops.length - 2);
  const f = seg - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function normalizedFound(cell: HexCell, r: { min: number; max: number }): number {
  return clamp01((cell.companiesFound - r.min) / (r.max - r.min || 1));
}
function normalizedBuild(cell: HexCell, r: { min: number; max: number }): number {
  return clamp01((cell.buildcitiesCount - r.min) / (r.max - r.min || 1));
}

export function getCellColor(cell: HexCell, mode: HeatMode, ramp: { min: number; max: number }): string | null {
  if (cell.companiesFound + cell.buildcitiesCount < 3) return null;
  if (mode === 'found') {
    if (cell.companiesFound === 0) return null;
    return rampColor(ramp, cell.companiesFound);
  }
  if (mode === 'buildcities') {
    if (cell.buildcitiesCount === 0) return null;
    return rampColor(ramp, cell.buildcitiesCount);
  }
  const gap = normalizedFound(cell, ramp) - normalizedBuild(cell, ramp);
  if (gap <= 0) return null;
  return rampColor({ min: 0, max: 1 }, gap);
}

export function getRampBounds(cells: HexCell[]): { min: number; max: number } {
  let max = 0;
  for (const c of cells) {
    max = Math.max(max, c.companiesFound, c.buildcitiesCount);
  }
  return { min: 0, max: Math.max(max, 1) };
}

export function topGapCells(cells: HexCell[], ramp: { min: number; max: number }, limit = 5): HexCell[] {
  return cells
    .filter((c) => c.companiesFound + c.buildcitiesCount >= 3)
    .map((c) => ({ c, gap: normalizedFound(c, ramp) - normalizedBuild(c, ramp) }))
    .filter((x) => x.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, limit)
    .map((x) => x.c);
}
