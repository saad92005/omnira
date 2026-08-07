import type { ReactNode } from "react";

/**
 * A small real sparkline of the next few hours' forecast temperature, from
 * Open-Meteo's own hourly array (see weather.ts) — plotted as-is, nothing
 * smoothed, interpolated, or invented client-side.
 */
export function WeatherTrend({ hourlyTemperaturesC }: { hourlyTemperaturesC: number[] }): ReactNode {
  if (hourlyTemperaturesC.length < 2) return null;

  const width = 220;
  const height = 40;
  const min = Math.min(...hourlyTemperaturesC);
  const max = Math.max(...hourlyTemperaturesC);
  const range = Math.max(1, max - min);
  const stepX = width / (hourlyTemperaturesC.length - 1);

  const points = hourlyTemperaturesC.map((t, i) => {
    const x = i * stepX;
    const y = height - ((t - min) / range) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      className="omnira-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Forecast trend: ${hourlyTemperaturesC.join("°, ")}°C over the next few hours`}
    >
      <polyline points={points.join(" ")} className="omnira-sparkline__line" fill="none" />
      <polyline
        points={`0,${height} ${points.join(" ")} ${width},${height}`}
        className="omnira-sparkline__fill"
      />
    </svg>
  );
}
