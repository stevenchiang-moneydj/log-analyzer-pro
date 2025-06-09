
import React, { useState } from 'react';
import { GdiUsageDataPoint } from '../types';
import { SpinnerIcon } from './icons';

interface GdiUsageChartProps {
  data: GdiUsageDataPoint[];
  isLoading: boolean;
}

const timeToSeconds = (timeStr: string): number => {
  const parts = timeStr.split(/[:.]/);
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]) + parseInt(parts[3]) / 1000;
};

const GDI_WARNING_THRESHOLD = 8000;
const WARNING_COLOR = "#ef4444"; // Red-500
const NORMAL_COLOR = "#22c55e"; // Green-500 (differentiate from memory chart blue)

const GdiUsageChart: React.FC<GdiUsageChartProps> = ({ data, isLoading }) => {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    contentLines: string[];
    x: number;
    y: number;
  } | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-300">
        <SpinnerIcon className="w-8 h-8 mr-2" />
        <span>Analyzing GDI data...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="p-4 text-center text-gray-400">No GDI usage data found in this log or data is still loading.</div>;
  }

  const padding = { top: 20, right: 60, bottom: 50, left: 60 }; // Adjusted right padding for warning label
  const svgWidth = 800; 
  const svgHeight = 400;
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const firstTimestampSeconds = data.length > 0 ? timeToSeconds(data[0].timestamp) : 0;

  const timeValues = data.map(d => timeToSeconds(d.timestamp) - firstTimestampSeconds);
  const gdiValues = data.map(d => d.gdiCount);

  const minTime = 0; 
  const maxTime = Math.max(...timeValues);
  const minGdi = Math.min(...gdiValues);
  const maxGdi = Math.max(...gdiValues);
  
  const gdiBuffer = (maxGdi - minGdi) * 0.1 || 10; 
  let yMin = Math.max(0, Math.floor(minGdi - gdiBuffer));
  let yMax = Math.ceil(maxGdi + gdiBuffer);

  if (yMax < GDI_WARNING_THRESHOLD + gdiBuffer && (maxGdi >= GDI_WARNING_THRESHOLD * 0.9 || yMax < GDI_WARNING_THRESHOLD)) {
      yMax = GDI_WARNING_THRESHOLD + gdiBuffer;
  }
  if (minGdi > GDI_WARNING_THRESHOLD) {
      yMin = Math.max(0, Math.floor(GDI_WARNING_THRESHOLD - gdiBuffer / 2));
  }
  if (yMin === yMax) { // Prevent division by zero if all values are the same
    yMin = Math.max(0, yMin - 10);
    yMax = yMax + 10;
  }
  if (yMax === 0) yMax = 10; // Handle case where all data is 0


  const getX = (time: number) => padding.left + (maxTime === 0 ? chartWidth / 2 : (time / maxTime) * chartWidth) ;
  const getY = (gdi: number) => padding.top + chartHeight - (yMax === yMin ? chartHeight / 2 : ((gdi - yMin) / (yMax - yMin)) * chartHeight);

  const linePath = data.map((d, i) => {
      const x = getX(timeValues[i]);
      const y = getY(d.gdiCount);
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');

  const numYTicks = 5;
  const yTicks = Array.from({ length: numYTicks + 1 }, (_, i) => {
    const value = yMin + (i / numYTicks) * (yMax - yMin);
    return { value: Math.round(value), y: getY(value) };
  });
  
  const numXTicks = Math.min(10, data.length > 0 ? data.length : 1);
  const xTicks: { value: number; label: string; x: number }[] = [];

  if (data.length > 0) {
    if (data.length === 1) {
        xTicks.push({
            value: timeValues[0],
            label: data[0].originalLogTime,
            x: getX(timeValues[0])
        });
    } else {
        const timeStep = maxTime / Math.max(1, numXTicks -1) ;
        for (let i = 0; i < numXTicks; i++) {
            const timeVal = i * timeStep;
            const closestDataPoint = data.reduce((prev, curr) => {
                return (Math.abs(timeToSeconds(curr.timestamp) - firstTimestampSeconds - timeVal) < Math.abs(timeToSeconds(prev.timestamp) - firstTimestampSeconds - timeVal) ? curr : prev);
            });
            xTicks.push({
                value: timeVal,
                label: closestDataPoint.originalLogTime, 
                x: getX(timeVal)
            });
        }
        const lastDataTime = timeValues[data.length-1];
        if (numXTicks > 1 && !xTicks.find(tick => Math.abs(tick.value - lastDataTime) < timeStep / 2)) {
             if(xTicks.length >= numXTicks && xTicks.length > 0) xTicks.pop(); 
             xTicks.push({ value: lastDataTime, label: data[data.length-1].originalLogTime, x: getX(lastDataTime)});
        }
        const uniqueLabelTicks: typeof xTicks = [];
        const seenLabels = new Set<string>();
        xTicks.sort((a,b) => a.x - b.x).forEach(tick => {
            if(!seenLabels.has(tick.label)){
                uniqueLabelTicks.push(tick);
                seenLabels.add(tick.label);
            }
        });
        if(uniqueLabelTicks.length < 2 && data.length > 1){
            xTicks.length = 0;
            xTicks.push({ value: timeValues[0], label: data[0].originalLogTime, x: getX(timeValues[0])});
            if(data.length > 1) {
                 xTicks.push({ value: timeValues[data.length-1], label: data[data.length-1].originalLogTime, x: getX(timeValues[data.length-1])});
            }
        } else {
            xTicks.length = 0; 
            xTicks.push(...uniqueLabelTicks); 
        }
    }
  }
  
  const tooltipWidth = 130;
  const tooltipHeight = 38;

  const handleMouseOver = (event: React.MouseEvent<SVGCircleElement>, pointData: GdiUsageDataPoint, pointX: number, pointY: number) => {
    let tx = pointX + 15; 
    let ty = pointY - tooltipHeight / 2; 

    if (tx + tooltipWidth > svgWidth - padding.right + 10) { // Add some buffer for tooltip width
      tx = pointX - tooltipWidth - 15; 
    }
    if (ty < padding.top) {
      ty = padding.top + 5; 
    }
    if (ty + tooltipHeight > svgHeight - padding.bottom) {
      ty = svgHeight - padding.bottom - tooltipHeight - 5; 
    }

    setTooltip({
      visible: true,
      contentLines: [
        `Time: ${pointData.originalLogTime}`,
        `GDI: ${pointData.gdiCount}`
      ],
      x: tx,
      y: ty,
    });
  };

  const handleMouseOut = () => {
    setTooltip(null);
  };

  const warningLineY = (GDI_WARNING_THRESHOLD >= yMin && GDI_WARNING_THRESHOLD <= yMax) ? getY(GDI_WARNING_THRESHOLD) : null;

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-inner overflow-x-auto">
      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} aria-labelledby="gdiChartDesc">
        <desc id="gdiChartDesc">A line chart showing GDI usage count on the Y-axis and time on the X-axis. A red dashed line indicates the {GDI_WARNING_THRESHOLD} GDI warning threshold.</desc>
        
        {/* Y Axis Grid Lines and Labels */}
        {yTicks.map((tick, i) => (
          <g key={`y-tick-gdi-${i}`} className="text-gray-500">
            <line
              x1={padding.left}
              y1={tick.y}
              x2={padding.left + chartWidth}
              y2={tick.y}
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
            <text
              x={padding.left - 8}
              y={tick.y + 4} 
              textAnchor="end"
              fontSize="10"
              fill="currentColor"
            >
              {tick.value}
            </text>
          </g>
        ))}

        {/* X Axis Grid Lines and Labels */}
        {xTicks.map((tick, i) => (
          <g key={`x-tick-gdi-${i}`} className="text-gray-500">
             { (i > 0 || tick.x > padding.left + 1) && 
                <line 
                    x1={tick.x} y1={padding.top} 
                    x2={tick.x} y2={padding.top + chartHeight} 
                    stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" 
                />
             }
            <text
              x={tick.x}
              y={padding.top + chartHeight + 20} 
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* Axes Lines */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke="#6b7280" strokeWidth="1" /> {/* Y Axis */}
        <line x1={padding.left} y1={padding.top + chartHeight} x2={padding.left + chartWidth} y2={padding.top + chartHeight} stroke="#6b7280" strokeWidth="1" /> {/* X Axis */}
        
        {/* Warning Line */}
        {warningLineY !== null && (
          <g className="warning-line">
            <line
              x1={padding.left}
              y1={warningLineY}
              x2={padding.left + chartWidth}
              y2={warningLineY}
              stroke={WARNING_COLOR}
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            <text
              x={padding.left + chartWidth + 5} 
              y={warningLineY + 4}
              fontSize="10"
              fill={WARNING_COLOR}
              textAnchor="start"
            >
              {GDI_WARNING_THRESHOLD}
            </text>
          </g>
        )}

        {/* Data Line */}
        {data.length > 1 && <path d={linePath} fill="none" stroke={NORMAL_COLOR} strokeWidth="2" />}

        {/* Data Points */}
        {data.map((d, i) => {
          const pointX = getX(timeValues[i]);
          const pointY = getY(d.gdiCount);
          const pointFillColor = d.gdiCount >= GDI_WARNING_THRESHOLD ? WARNING_COLOR : NORMAL_COLOR;
          return (
            <circle
              key={`gdi-point-${i}`}
              cx={pointX}
              cy={pointY}
              r={data.length < 50 ? 4 : 2.5} 
              fill={pointFillColor}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onMouseOver={(e) => handleMouseOver(e, d, pointX, pointY)}
              onMouseOut={handleMouseOut}
              aria-label={`Time: ${d.originalLogTime}, GDI: ${d.gdiCount}${d.gdiCount >= GDI_WARNING_THRESHOLD ? ' (Warning: High Usage)' : ''}`}
            />
          );
        })}
        
        {/* Axis Labels Text */}
        <text x={padding.left + chartWidth / 2} y={svgHeight - padding.bottom / 2 + 15} textAnchor="middle" fontSize="12" fill="#9ca3af">Time</text>
        <text transform={`translate(${padding.left / 2 - 10}, ${padding.top + chartHeight/2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill="#9ca3af">GDI Count</text>

        {/* Custom Tooltip */}
        {tooltip && tooltip.visible && (
          <g transform={`translate(${tooltip.x}, ${tooltip.y})`} style={{ pointerEvents: 'none' }}>
            <rect
              x="0"
              y="0"
              width={tooltipWidth}
              height={tooltipHeight}
              rx="4"
              ry="4"
              fill="rgba(23, 37, 53, 0.9)" 
              stroke="#4a5568" 
              strokeWidth="1"
            />
            {tooltip.contentLines.map((line, index) => (
              <text
                key={index}
                x={7} 
                y={15 + index * 14} 
                fontSize="10"
                fill="#e2e8f0" 
              >
                {line}
              </text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
};

export default GdiUsageChart;
