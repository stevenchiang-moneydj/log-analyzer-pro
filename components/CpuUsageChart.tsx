import React, { useState, useMemo } from 'react';
import { CpuUsageDataPoint } from '../types';
import { SpinnerIcon } from './icons';

interface CpuUsageChartProps {
  data: CpuUsageDataPoint[];
  isLoading: boolean;
  startTimestamps?: string[];
}

const timeToSeconds = (timeStr: string): number => {
  const parts = timeStr.split(/[:.]/);
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]) + parseInt(parts[3]) / 1000;
};

const CPU_WARNING_THRESHOLD_PERCENT = 90;
const WARNING_COLOR = "#ef4444"; // Red-500
const MAIN_CPU_COLOR = "#22c55e"; // Green-500
const TOTAL_CPU_COLOR = "#f97316"; // Orange-500
const DELAY_MS_COLOR = "#8b5cf6"; // Violet-500

const CpuUsageChart: React.FC<CpuUsageChartProps> = ({ data, isLoading, startTimestamps = [] }) => {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    contentLines: string[];
    x: number;
    y: number;
  } | null>(null);

  const chartId = useMemo(() => `cpu-chart-${Math.random().toString(36).substring(7)}`, []);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-300">
        <SpinnerIcon className="w-8 h-8 mr-2" />
        <span>Analyzing CPU data...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="p-4 text-center text-gray-400">No CPU usage data found in this log or data is still loading.</div>;
  }

  const padding = { top: 30, right: 70, bottom: 70, left: 60 }; // Increased bottom for legend, right for Y2 axis
  const svgWidth = 800; 
  const svgHeight = 450; // Increased height for legend
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const firstTimestampSeconds = data.length > 0 ? timeToSeconds(data[0].timestamp) : 0;

  const timeValues = data.map(d => timeToSeconds(d.timestamp) - firstTimestampSeconds);
  const mainCpuValues = data.map(d => d.mainCpuPercent);
  const totalCpuValues = data.map(d => d.totalCpuPercent);
  const delayMsValues = data.map(d => d.delayMs);

  const maxTime = Math.max(...timeValues);

  // CPU Y-axis (0-100%, but can go higher if data exceeds)
  const yCpuMin = 0;
  const yCpuMax = Math.max(100, Math.ceil(Math.max(...mainCpuValues, ...totalCpuValues) / 10) * 10 + 5);

  // DelayMS Y-axis (dynamic)
  const minDelayMs = Math.min(...delayMsValues);
  const maxDelayMs = Math.max(...delayMsValues);
  const delayMsBuffer = (maxDelayMs - minDelayMs) * 0.1 || 10;
  const yDelayMsMin = Math.max(0, Math.floor(minDelayMs - delayMsBuffer));
  const yDelayMsMax = Math.ceil(maxDelayMs + delayMsBuffer) || 10; // Ensure not 0 if all data is 0

  const getX = (time: number) => padding.left + (maxTime === 0 ? chartWidth / 2 : (time / maxTime) * chartWidth);
  
  const getYCpu = (percent: number) => padding.top + chartHeight - ((percent - yCpuMin) / (yCpuMax - yCpuMin)) * chartHeight;
  const getYDelayMs = (delay: number) => padding.top + chartHeight - (yDelayMsMax === yDelayMsMin ? chartHeight / 2 : ((delay - yDelayMsMin) / (yDelayMsMax - yDelayMsMin)) * chartHeight);

  const createLinePath = (values: number[], getYCoord: (val: number) => number) => 
    data.map((d, i) => {
        const x = getX(timeValues[i]);
        const y = getYCoord(values[i]);
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
      }).join(' ');

  const mainCpuLinePath = createLinePath(mainCpuValues, getYCpu);
  const totalCpuLinePath = createLinePath(totalCpuValues, getYCpu);
  const delayMsLinePath = createLinePath(delayMsValues, getYDelayMs);

  // Y-CPU Ticks
  const numYCpuTicks = 5;
  const yCpuTicks = Array.from({ length: numYCpuTicks + 1 }, (_, i) => {
    const value = yCpuMin + (i / numYCpuTicks) * (yCpuMax - yCpuMin);
    return { value: Math.round(value), y: getYCpu(value) };
  });

  // Y-DelayMS Ticks
  const numYDelayMsTicks = 5;
  const yDelayMsTicks = Array.from({ length: numYDelayMsTicks + 1 }, (_, i) => {
    const value = yDelayMsMin + (i / numYDelayMsTicks) * (yDelayMsMax - yDelayMsMin);
    return { value: Math.round(value), y: getYDelayMs(value) };
  });
  
  // X Ticks (simplified from MemoryUsageChart)
  const numXTicks = Math.min(10, data.length > 1 ? 5 : 1); // Fewer ticks for clarity
  const xTicks: { value: number; label: string; x: number }[] = [];
   if (data.length > 0) {
    if (data.length === 1) {
        xTicks.push({ value: timeValues[0], label: data[0].originalLogTime, x: getX(timeValues[0])});
    } else {
        const indices = new Set<number>();
        for(let i=0; i < numXTicks; i++) {
            indices.add(Math.floor(i * (data.length-1) / (numXTicks-1)));
        }
        indices.add(data.length-1); // Ensure last point is a tick
        Array.from(indices).sort((a,b)=>a-b).forEach(idx => {
            xTicks.push({ value: timeValues[idx], label: data[idx].originalLogTime, x: getX(timeValues[idx])});
        });
    }
  }
  
  const tooltipWidth = 150; // Wider for more data
  const tooltipHeight = 60; // Taller for more lines

  const handleMouseOver = (_event: React.MouseEvent<SVGCircleElement>, pointData: CpuUsageDataPoint, pointX: number, pointY: number) => {
    let tx = pointX + 15; 
    let ty = pointY - tooltipHeight / 2; 

    if (tx + tooltipWidth > svgWidth - padding.right) tx = pointX - tooltipWidth - 15; 
    if (ty < padding.top) ty = padding.top + 5; 
    if (ty + tooltipHeight > svgHeight - padding.bottom) ty = svgHeight - padding.bottom - tooltipHeight - 5; 

    setTooltip({
      visible: true,
      contentLines: [
        `Time: ${pointData.originalLogTime}`,
        `Main CPU: ${pointData.mainCpuPercent.toFixed(1)}%`,
        `Total CPU: ${pointData.totalCpuPercent.toFixed(1)}%`,
        `Delay: ${pointData.delayMs}ms`
      ],
      x: tx,
      y: ty,
    });
  };

  const handleMouseOut = () => setTooltip(null);

  const cpuWarningLineY = (CPU_WARNING_THRESHOLD_PERCENT >= yCpuMin && CPU_WARNING_THRESHOLD_PERCENT <= yCpuMax) ? getYCpu(CPU_WARNING_THRESHOLD_PERCENT) : null;
  
  const legendItems = [
    { label: "Main CPU", color: MAIN_CPU_COLOR },
    { label: "Total CPU", color: TOTAL_CPU_COLOR },
    { label: "DelayMS", color: DELAY_MS_COLOR },
  ];

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-inner overflow-x-auto">
      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} aria-labelledby={`${chartId}-desc`} role="graphics-document">
        <title id={`${chartId}-title`}>CPU Usage and DelayMS Chart</title>
        <desc id={`${chartId}-desc`}>
          A line chart showing Main CPU % (green), Total CPU % (orange) on the left Y-axis (0-{yCpuMax}%), and DelayMS (purple) on the right Y-axis ({yDelayMsMin}-{yDelayMsMax}ms).
          Time is on the X-axis. A red dashed line indicates the {CPU_WARNING_THRESHOLD_PERCENT}% CPU warning threshold.
        </desc>
        {/* 啟動時間標示線 */}
        {startTimestamps && startTimestamps.map((ts, idx) => {
          const tsSec = timeToSeconds(ts) - firstTimestampSeconds;
          const x = getX(tsSec);
          return (
            <g key={`start-line-${idx}`}> 
              <line x1={x} y1={padding.top} x2={x} y2={padding.top + chartHeight} stroke="#f59e42" strokeWidth="2.5" strokeDasharray="6,2" />
              <text x={x + 4} y={padding.top + 18} fontSize="12" fill="#f59e42" fontWeight="bold">
                啟動
              </text>
            </g>
          );
        })}

        {/* Y CPU Axis Grid Lines and Labels */}
        {yCpuTicks.map((tick, i) => (
          <g key={`y-cpu-tick-${i}`} className="text-gray-500">
            <line x1={padding.left} y1={tick.y} x2={padding.left + chartWidth} y2={tick.y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" />
            <text x={padding.left - 8} y={tick.y + 4} textAnchor="end" fontSize="10" fill="currentColor">{tick.value}%</text>
          </g>
        ))}

        {/* Y DelayMS Axis Grid Lines and Labels */}
        {yDelayMsTicks.map((tick, i) => (
          <g key={`y-delayms-tick-${i}`} className="text-gray-500">
            {/* Don't draw grid lines for the second Y axis to avoid clutter, only labels */}
            <text x={padding.left + chartWidth + 8} y={tick.y + 4} textAnchor="start" fontSize="10" fill="currentColor">{tick.value}ms</text>
          </g>
        ))}

        {/* X Axis Grid Lines and Labels */}
        {xTicks.map((tick, i) => (
          <g key={`x-tick-${i}`} className="text-gray-500">
             <line x1={tick.x} y1={padding.top} x2={tick.x} y2={padding.top + chartHeight} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" />
            <text x={tick.x} y={padding.top + chartHeight + 20} textAnchor="middle" fontSize="10" fill="currentColor">{tick.label}</text>
          </g>
        ))}

        {/* Axes Lines */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke="#6b7280" strokeWidth="1" /> {/* Y-CPU Axis */}
        <line x1={padding.left + chartWidth} y1={padding.top} x2={padding.left + chartWidth} y2={padding.top + chartHeight} stroke="#6b7280" strokeWidth="1" /> {/* Y-DelayMS Axis */}
        <line x1={padding.left} y1={padding.top + chartHeight} x2={padding.left + chartWidth} y2={padding.top + chartHeight} stroke="#6b7280" strokeWidth="1" /> {/* X Axis */}
        
        {/* CPU Warning Line */}
        {cpuWarningLineY !== null && (
          <g className="warning-line">
            <line x1={padding.left} y1={cpuWarningLineY} x2={padding.left + chartWidth} y2={cpuWarningLineY} stroke={WARNING_COLOR} strokeWidth="1.5" strokeDasharray="4,4" />
            <text x={padding.left - 8} y={cpuWarningLineY - 5} fontSize="10" fill={WARNING_COLOR} textAnchor="end" fontWeight="bold">{CPU_WARNING_THRESHOLD_PERCENT}%</text>
          </g>
        )}

        {/* Data Lines */}
        {data.length > 1 && <path d={mainCpuLinePath} fill="none" stroke={MAIN_CPU_COLOR} strokeWidth="2" />}
        {data.length > 1 && <path d={totalCpuLinePath} fill="none" stroke={TOTAL_CPU_COLOR} strokeWidth="2" />}
        {data.length > 1 && <path d={delayMsLinePath} fill="none" stroke={DELAY_MS_COLOR} strokeWidth="2" />}

        {/* Data Points */}
        {data.map((d, i) => {
          const pointX = getX(timeValues[i]);
          // Main CPU points
          const mainCpuY = getYCpu(d.mainCpuPercent);
          const mainCpuFill = d.mainCpuPercent >= CPU_WARNING_THRESHOLD_PERCENT ? WARNING_COLOR : MAIN_CPU_COLOR;
          // Total CPU points
          const totalCpuY = getYCpu(d.totalCpuPercent);
          const totalCpuFill = d.totalCpuPercent >= CPU_WARNING_THRESHOLD_PERCENT ? WARNING_COLOR : TOTAL_CPU_COLOR;
          // DelayMS points
          const delayMsY = getYDelayMs(d.delayMs);

          return (
            <React.Fragment key={`point-group-${i}`}>
              <circle
                cx={pointX} cy={mainCpuY} r={data.length < 50 ? 4 : 2.5} fill={mainCpuFill}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onMouseOver={(e) => handleMouseOver(e, d, pointX, mainCpuY)} onMouseOut={handleMouseOut}
                aria-label={`Time: ${d.originalLogTime}, Main CPU: ${d.mainCpuPercent.toFixed(1)}%`}
              />
              <circle
                cx={pointX} cy={totalCpuY} r={data.length < 50 ? 4 : 2.5} fill={totalCpuFill}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onMouseOver={(e) => handleMouseOver(e, d, pointX, totalCpuY)} onMouseOut={handleMouseOut}
                aria-label={`Time: ${d.originalLogTime}, Total CPU: ${d.totalCpuPercent.toFixed(1)}%`}
              />
              <circle
                cx={pointX} cy={delayMsY} r={data.length < 50 ? 4 : 2.5} fill={DELAY_MS_COLOR}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onMouseOver={(e) => handleMouseOver(e, d, pointX, delayMsY)} onMouseOut={handleMouseOut}
                aria-label={`Time: ${d.originalLogTime}, DelayMS: ${d.delayMs}ms`}
              />
            </React.Fragment>
          );
        })}
        
        {/* Axis Labels Text */}
        <text x={padding.left + chartWidth / 2} y={svgHeight - padding.bottom / 2 + 10 } textAnchor="middle" fontSize="12" fill="#9ca3af">Time</text>
        <text transform={`translate(${padding.left / 2 - 10}, ${padding.top + chartHeight/2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill="#9ca3af">CPU Usage (%)</text>
        <text transform={`translate(${svgWidth - padding.right / 2 + 15}, ${padding.top + chartHeight/2}) rotate(90)`} textAnchor="middle" fontSize="12" fill="#9ca3af">Delay (ms)</text>

        {/* Legend */}
        <g transform={`translate(${padding.left}, ${svgHeight - padding.bottom + 40})`} role="list" aria-labelledby={`${chartId}-legend-title`}>
          <title id={`${chartId}-legend-title`}>Chart Legend</title>
          {legendItems.map((item, index) => (
            <g key={item.label} transform={`translate(${index * 120}, 0)`} role="listitem">
              <rect x="0" y="-10" width="10" height="10" fill={item.color} />
              <text x="15" y="0" fontSize="12" fill="#cbd5e1">{item.label}</text>
            </g>
          ))}
        </g>

        {/* Custom Tooltip */}
        {tooltip && tooltip.visible && (
          <g transform={`translate(${tooltip.x}, ${tooltip.y})`} style={{ pointerEvents: 'none' }} role="tooltip">
            <rect x="0" y="0" width={tooltipWidth} height={tooltipHeight} rx="4" ry="4" fill="rgba(23, 37, 53, 0.9)" stroke="#4a5568" strokeWidth="1"/>
            {tooltip.contentLines.map((line, index) => (
              <text key={index} x={7} y={15 + index * 13} fontSize="10" fill="#e2e8f0">{line}</text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
};

export default CpuUsageChart;
