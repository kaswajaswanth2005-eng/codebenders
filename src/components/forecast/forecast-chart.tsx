"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "@/lib/financial/money";
import { formatDayMonth, formatDisplayDate } from "@/components/forecast/format";

export type ForecastChartPoint = {
  date: string;
  incomingPaise: number;
  outgoingPaise: number;
  closingCashPaise: number;
};

type ChartRow = { date: string; projected: number; baseline?: number };

interface ForecastChartProps {
  points: ForecastChartPoint[];
  baselinePoints?: ForecastChartPoint[];
  horizonDays: number;
  /** Name of the main line in the legend and tooltip. */
  primaryLabel?: string;
}

function toRupees(paise: number): number {
  return paise / 100;
}

/** Chart values are rupees; convert back to integer paise before formatINR. */
function formatRupees(value: number): string {
  return formatINR(Math.round(value * 100));
}

type DotProps = { cx?: number; cy?: number; payload?: ChartRow };

/** Red marker on every day whose projected closing cash is below zero. */
function NegativeDot(props: DotProps) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload || payload.projected >= 0) {
    return <g />;
  }
  return <circle cx={cx} cy={cy} r={4} fill="#dc2626" stroke="#ffffff" strokeWidth={1} />;
}

export function ForecastChart({
  points,
  baselinePoints,
  horizonDays,
  primaryLabel = "Projected cash",
}: ForecastChartProps) {
  const rows: ChartRow[] = points.map((point, index) => {
    const row: ChartRow = { date: point.date, projected: toRupees(point.closingCashPaise) };
    const base = baselinePoints?.[index];
    if (base !== undefined) {
      row.baseline = toRupees(base.closingCashPaise);
    }
    return row;
  });

  return (
    <div role="img" aria-label={`Projected cash balance over ${horizonDays} days`}>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={rows} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tickFormatter={formatDayMonth} minTickGap={24} tick={{ fontSize: 12 }} />
          <YAxis width={110} tickFormatter={formatRupees} tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={(label) => formatDisplayDate(String(label))}
            formatter={(value) => (typeof value === "number" ? formatRupees(value) : String(value))}
          />
          <Legend />
          <ReferenceLine
            y={0}
            stroke="#dc2626"
            strokeDasharray="4 4"
            label={{ value: "₹0", position: "insideTopLeft", fill: "#dc2626", fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="projected"
            name={primaryLabel}
            stroke="#111827"
            strokeWidth={2}
            dot={NegativeDot}
          />
          {baselinePoints !== undefined ? (
            <Line
              type="monotone"
              dataKey="baseline"
              name="Baseline"
              stroke="#9ca3af"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
