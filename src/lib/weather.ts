// Open-Meteo: free, no key. Coordinates are rounded to ~1 km before leaving the server.

export type Weather = {
  tempC: number; feelsC: number; code: number; label: string; icon: string;
  rain: boolean; humidity: number; windKph: number; isDay: boolean; place?: string;
};
export type DayForecast = { date: string; maxC: number; minC: number; code: number; label: string; icon: string; rainChance: number };

const CODES: Record<number, [string, string]> = {
  0: ['Clear', '☀️'], 1: ['Mostly clear', '🌤'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫'], 48: ['Fog', '🌫'], 51: ['Light drizzle', '🌦'], 53: ['Drizzle', '🌦'], 55: ['Heavy drizzle', '🌧'],
  61: ['Light rain', '🌦'], 63: ['Rain', '🌧'], 65: ['Heavy rain', '🌧'], 71: ['Light snow', '🌨'], 73: ['Snow', '🌨'],
  75: ['Heavy snow', '❄️'], 80: ['Showers', '🌦'], 81: ['Showers', '🌧'], 82: ['Violent showers', '⛈'], 95: ['Thunderstorm', '⛈'],
  96: ['Thunderstorm', '⛈'], 99: ['Thunderstorm', '⛈'],
};
export const describe = (code: number) => CODES[code] ?? ['—', '🌡'];
const isRain = (code: number) => (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
const round = (n: number) => Math.round(n * 100) / 100;

export async function currentWeather(lat: number, lon: number): Promise<Weather> {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', String(round(lat)));
  u.searchParams.set('longitude', String(round(lon)));
  u.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m,is_day,precipitation');
  const res = await fetch(u, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error('weather unavailable');
  const c = (await res.json()).current;
  const [label, icon] = describe(c.weather_code);
  return {
    tempC: c.temperature_2m, feelsC: c.apparent_temperature, code: c.weather_code, label, icon,
    rain: isRain(c.weather_code) || c.precipitation > 0.2, humidity: c.relative_humidity_2m, windKph: c.wind_speed_10m, isDay: !!c.is_day,
  };
}

/** Daily forecast for up to 16 days ahead; days outside that window are omitted. */
export async function forecast(lat: number, lon: number, start: string, end: string): Promise<DayForecast[]> {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', String(round(lat)));
  u.searchParams.set('longitude', String(round(lon)));
  u.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
  u.searchParams.set('timezone', 'auto');
  u.searchParams.set('forecast_days', '16');
  const res = await fetch(u, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return [];
  const d = (await res.json()).daily;
  return (d.time as string[]).map((date, i) => {
    const [label, icon] = describe(d.weather_code[i]);
    return { date, maxC: d.temperature_2m_max[i], minC: d.temperature_2m_min[i], code: d.weather_code[i], label, icon, rainChance: d.precipitation_probability_max[i] ?? 0 };
  }).filter(x => x.date >= start && x.date <= end);
}

export async function geocode(name: string) {
  const u = new URL('https://geocoding-api.open-meteo.com/v1/search');
  u.searchParams.set('name', name);
  u.searchParams.set('count', '5');
  const res = await fetch(u, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return [];
  const j = await res.json();
  return ((j.results ?? []) as { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[])
    .map(r => ({ name: [r.name, r.admin1, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude }));
}
