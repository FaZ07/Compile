// REAL — Open-Meteo. No auth.
import type { LocationData, WeatherData } from "../types";

export async function fetchWeather(loc: LocationData): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
    `&timezone=auto&forecast_days=7`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const d = (await res.json()) as {
    daily: {
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: number[];
      weathercode: number[];
    };
  };
  const max = avg(d.daily.temperature_2m_max);
  const min = avg(d.daily.temperature_2m_min);
  const rain = Math.round(Math.max(...d.daily.precipitation_probability_max));
  const code = d.daily.weathercode[0] ?? 0;
  return {
    summary: `${codeToWord(code)}, ${Math.round(min)}–${Math.round(max)}°C`,
    rain_probability_pct: rain,
    temp_min_c: Math.round(min),
    temp_max_c: Math.round(max),
  };
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);

function codeToWord(c: number): string {
  if (c === 0) return "Clear";
  if ([1, 2, 3].includes(c)) return "Partly cloudy";
  if ([45, 48].includes(c)) return "Foggy";
  if ([51, 53, 55, 61, 63, 65].includes(c)) return "Rain expected";
  if ([71, 73, 75, 77].includes(c)) return "Snow";
  if ([80, 81, 82].includes(c)) return "Showers";
  if ([95, 96, 99].includes(c)) return "Thunderstorms";
  return "Mixed conditions";
}
