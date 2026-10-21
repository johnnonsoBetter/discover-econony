export type CityEvent = {
  event: 'view' | 'select' | 'useful' | 'not_useful' | 'shortlist' | 'add' | 'share';
  city: string;
  project?: string;
  companyId?: string;
  timestamp: string;
};

const STORAGE_KEY = 'buildcities-reno-event-log';

export function recordCityEvent(event: CityEvent): void {
  const existing = readCityEvents();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, event]));
}

export function readCityEvents(): CityEvent[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as CityEvent[] : [];
  } catch {
    return [];
  }
}
