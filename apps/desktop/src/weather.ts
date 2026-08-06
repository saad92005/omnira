export interface CurrentWeather {
  temperatureC: number;
  label: string;
  /** WMO weather code, in case a caller wants a different mapping than `label`. */
  code: number;
  isDay: boolean;
}

/**
 * Open-Meteo (open-meteo.com) — genuinely free, no API key, no signup, and
 * explicitly documented as safe to call directly from browser JS (CORS is
 * enabled). No backend proxy needed, unlike most weather/news APIs. Real
 * data only: if geolocation is denied or the request fails, this resolves
 * to null rather than showing an invented reading.
 */
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

// WMO Weather interpretation codes (open-meteo.com/en/docs#weathervariables).
const WEATHER_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not available"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 10 * 60 * 1000 });
  });
}

export async function getCurrentWeather(): Promise<CurrentWeather | null> {
  try {
    const position = await getPosition();
    const url = new URL(FORECAST_URL);
    url.searchParams.set("latitude", position.coords.latitude.toFixed(4));
    url.searchParams.set("longitude", position.coords.longitude.toFixed(4));
    url.searchParams.set("current", "temperature_2m,weather_code,is_day");
    url.searchParams.set("temperature_unit", "celsius");

    const response = await fetch(url);
    if (!response.ok) return null;

    const body = (await response.json()) as {
      current?: { temperature_2m: number; weather_code: number; is_day: number };
    };
    if (!body.current) return null;

    return {
      temperatureC: Math.round(body.current.temperature_2m),
      code: body.current.weather_code,
      label: WEATHER_LABELS[body.current.weather_code] ?? "Unknown",
      isDay: body.current.is_day === 1,
    };
  } catch {
    // Denied permission, no geolocation support, offline, etc. -- weather is
    // ambient/optional, never worth surfacing as an error to the user.
    return null;
  }
}
