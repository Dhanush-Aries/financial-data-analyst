"use client";

import { useRef, useCallback } from "react";
import { Download } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface ChartConfig {
  type: "line" | "bar" | "pie" | "area" | "scatter" | "radar";
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  description?: string;
}

interface ChartRendererProps {
  config: ChartConfig;
}

const CHART_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(160, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(280, 65%, 60%)",
  "hsl(340, 75%, 55%)",
  "hsl(180, 70%, 50%)",
  "hsl(60, 70%, 50%)",
  "hsl(120, 60%, 45%)",
];

function formatValue(value: unknown): string {
  if (typeof value === "number") {
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
    return value.toFixed(2).replace(/\.?0+$/, "");
  }
  return String(value ?? "");
}

export default function ChartRenderer({ config }: ChartRendererProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  const exportAsPNG = useCallback(async () => {
    if (!chartRef.current) return;

    try {
      // Use html-to-image for PNG export
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(chartRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `${config.title.replace(/\s+/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [config.title]);

  const renderChart = () => {
    const commonProps = {
      data: config.data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    switch (config.type) {
      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey={config.xKey}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => String(v).slice(0, 10)}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatValue} />
            <Tooltip formatter={(v) => formatValue(v)} />
            <Legend />
            <Line
              type="monotone"
              dataKey={config.yKey}
              stroke={CHART_COLORS[0]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        );

      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey={config.xKey}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => String(v).slice(0, 10)}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatValue} />
            <Tooltip formatter={(v) => formatValue(v)} />
            <Legend />
            <Bar dataKey={config.yKey} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        );

      case "area":
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey={config.xKey}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => String(v).slice(0, 10)}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatValue} />
            <Tooltip formatter={(v) => formatValue(v)} />
            <Legend />
            <Area
              type="monotone"
              dataKey={config.yKey}
              stroke={CHART_COLORS[0]}
              fill={CHART_COLORS[0]}
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </AreaChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={config.data}
              dataKey={config.yKey || "value"}
              nameKey={config.xKey || "name"}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) =>
                `${String(name).slice(0, 12)} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {config.data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatValue(v)} />
            <Legend />
          </PieChart>
        );

      case "scatter":
        return (
          <ScatterChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="x"
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={formatValue}
            />
            <YAxis
              dataKey="y"
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={formatValue}
            />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v) => formatValue(v)} />
            <Scatter data={config.data} fill={CHART_COLORS[0]} />
          </ScatterChart>
        );

      case "radar":
        return (
          <RadarChart cx="50%" cy="50%" outerRadius={100} data={config.data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fontSize: 10 }} />
            <Radar
              name={config.yKey || "Value"}
              dataKey={config.yKey || "A"}
              stroke={CHART_COLORS[0]}
              fill={CHART_COLORS[0]}
              fillOpacity={0.3}
            />
            <Legend />
            <Tooltip formatter={(v) => formatValue(v)} />
          </RadarChart>
        );

      default:
        return <div className="text-muted-foreground text-sm">Unknown chart type</div>;
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground text-sm">{config.title}</h3>
          {config.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
          )}
        </div>
        <button
          onClick={exportAsPNG}
          className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted/50 transition-colors"
          title="Export as PNG"
        >
          <Download className="h-3 w-3" />
          PNG
        </button>
      </div>

      <div ref={chartRef} className="bg-white p-2 rounded-lg">
        <ResponsiveContainer width="100%" height={280}>
          {renderChart() as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
