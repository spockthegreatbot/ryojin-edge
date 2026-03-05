export interface MatchWeather {
  description: string;   // "Heavy Rain", "Clear", "Overcast"
  tempC: number;
  rainMm: number;        // Expected precipitation mm
  windKph: number;
  icon: string;          // emoji: 🌧️ ☀️ ⛅ 🌩️ 🌬️
  goalsImpact: number;   // -0.15 to 0 (negative = fewer goals expected)
  cornersImpact: number; // -0.1 to +0.1
}

// Venue city lookup (API-Sports returns venue name, we map to city)
const VENUE_CITY: Record<string, { lat: number; lon: number }> = {
  "Emirates Stadium": { lat: 51.5549, lon: -0.1084 },
  "Anfield": { lat: 53.4308, lon: -2.9608 },
  "Old Trafford": { lat: 53.4631, lon: -2.2913 },
  "Stamford Bridge": { lat: 51.4816, lon: -0.1910 },
  "Etihad Stadium": { lat: 53.4831, lon: -2.2004 },
  "Tottenham Hotspur Stadium": { lat: 51.6044, lon: -0.0669 },
  "St. James' Park": { lat: 54.9756, lon: -1.6218 },
  "Villa Park": { lat: 52.5090, lon: -1.8847 },
  "London Stadium": { lat: 51.5386, lon: -0.0164 },
  "Goodison Park": { lat: 53.4388, lon: -2.9664 },
  "Falmer Stadium": { lat: 50.8619, lon: -0.0831 },
  "Gtech Community Stadium": { lat: 51.4882, lon: -0.3088 },
  "Selhurst Park": { lat: 51.3984, lon: -0.0858 },
  "Molineux Stadium": { lat: 52.5900, lon: -2.1302 },
  "Goodison": { lat: 53.4388, lon: -2.9664 },
  "King Power Stadium": { lat: 52.6203, lon: -1.1423 },
  "St Mary's Stadium": { lat: 50.9058, lon: -1.3914 },
  "Portman Road": { lat: 52.0553, lon: 1.1450 },
  "City Ground": { lat: 52.9400, lon: -1.1327 },
  "Vitality Stadium": { lat: 50.7352, lon: -1.8384 },
  // UCL venues
  "Santiago Bernabéu": { lat: 40.4531, lon: -3.6883 },
  "Camp Nou": { lat: 41.3809, lon: 2.1228 },
  "Allianz Arena": { lat: 48.2188, lon: 11.6247 },
  "San Siro": { lat: 45.4781, lon: 9.1240 },
  "Parc des Princes": { lat: 48.8414, lon: 2.2530 },
  "Johan Cruyff Arena": { lat: 52.3143, lon: 4.9413 },
  "Wembley": { lat: 51.5560, lon: -0.2796 },
};

export async function getMatchWeather(venueName: string, matchDate: string): Promise<MatchWeather | null> {
  if (!venueName) return null;

  const coords = Object.entries(VENUE_CITY).find(([k]) =>
    venueName.toLowerCase().includes(k.toLowerCase().split(" ")[0])
  )?.[1];

  if (!coords) return null;

  try {
    // Open-Meteo free API — no key required
    const date = matchDate.split("T")[0];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=precipitation_sum,windspeed_10m_max,temperature_2m_max&timezone=auto&start_date=${date}&end_date=${date}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const data = await res.json();
    const rainMm: number = data.daily?.precipitation_sum?.[0] ?? 0;
    const windKph: number = data.daily?.windspeed_10m_max?.[0] ?? 0;
    const tempC: number = data.daily?.temperature_2m_max?.[0] ?? 15;

    // Impact calculations
    let goalsImpact = 0;
    if (rainMm > 5) goalsImpact -= 0.08;
    if (rainMm > 15) goalsImpact -= 0.15;
    if (windKph > 40) goalsImpact -= 0.07;

    let cornersImpact = 0;
    if (rainMm > 5) cornersImpact += 0.05; // defensive play → more corners
    if (windKph > 40) cornersImpact -= 0.08; // bad for set pieces

    const icon = rainMm > 10 ? "🌧️" : rainMm > 2 ? "🌦️" : windKph > 40 ? "🌬️" : tempC < 2 ? "🥶" : "☀️";
    const description = rainMm > 10 ? "Heavy Rain" : rainMm > 2 ? "Light Rain" : windKph > 40 ? "Strong Wind" : "Clear";

    return {
      description,
      tempC: Math.round(tempC),
      rainMm,
      windKph: Math.round(windKph),
      icon,
      goalsImpact,
      cornersImpact,
    };
  } catch {
    return null;
  }
}
