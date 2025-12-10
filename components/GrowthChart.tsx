import React, { useMemo, useState, useRef } from 'react';
import { LMSDataPoint, MetricResult, Sex } from '../types';
import { interpolateLMS, calculateValueFromZ, calculateZScore } from '../services/mathUtils';
import { CDC_HEIGHT_AGE } from '../services/growthData';

interface Props {
    title: string;
    data: LMSDataPoint[];
    userX: number;
    userY: number;
    userMetric?: MetricResult;
    xDomain: [number, number]; // [min, max]
    xLabel: string;
    yLabel: string;
    sex: Sex;
    xDisplayMode?: 'months' | 'years' | 'default';
    mph?: number | null;
    mphRange?: [number, number] | null;
    boneAgeMonths?: number;
}

interface TooltipData {
    x: number;
    y: number;
    title: string;
    lines: string[];
    color?: string;
}

const GrowthChart: React.FC<Props> = ({ 
    title, 
    data, 
    userX, 
    userY, 
    userMetric, 
    xDomain, 
    xLabel, 
    yLabel, 
    sex,
    xDisplayMode = 'default',
    mph,
    mphRange,
    boneAgeMonths
}) => {
    const width = 800;
    const height = 500;
    const padding = { top: 40, right: 50, bottom: 50, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const svgRef = useRef<SVGSVGElement>(null);

    const [tooltip, setTooltip] = useState<TooltipData | null>(null);
    const [hoveredCurve, setHoveredCurve] = useState<number | null>(null);

    // Colors based on Sex (CDC Style)
    // Boys: Blue, Girls: Pink/Red
    const primaryColor = sex === Sex.Male ? '#3b82f6' : '#ec4899'; // Blue-500 vs Pink-500
    const gridMajor = sex === Sex.Male ? '#93c5fd' : '#f9a8d4'; // Blue-300 vs Pink-300
    const gridMinor = sex === Sex.Male ? '#dbeafe' : '#fce7f3'; // Blue-100 vs Pink-100
    const textColor = sex === Sex.Male ? '#1e3a8a' : '#831843'; // Blue-900 vs Pink-900
    
    // MPH Colors
    // Using a Dark Gold/Amber for visibility on white background, while still reading as "Yellow"
    const mphColor = '#CA8A04'; // Yellow-600
    // Dense yellow for shading
    const mphFill = '#FDE047'; // Yellow-300

    // User Data Point Color
    const userColor = '#16a34a'; // Green-600

    // Bone Age Color
    const boneAgeColor = '#9333ea'; // Purple-600

    // Standard CDC/WHO Percentiles
    const percentiles = useMemo(() => [
        { z: -1.881, label: '3rd', name: '3rd Percentile' },
        { z: -1.282, label: '10th', name: '10th Percentile' },
        { z: -0.674, label: '25th', name: '25th Percentile' },
        { z: 0, label: '50th', name: '50th Percentile' },
        { z: 0.674, label: '75th', name: '75th Percentile' },
        { z: 1.282, label: '90th', name: '90th Percentile' },
        { z: 1.881, label: '97th', name: '97th Percentile' },
    ], []);

    // Generate Ticks for Clinical Grid
    const xTicks = useMemo(() => {
        const ticks: { val: number, isMajor: boolean }[] = [];
        if (xDisplayMode === 'months') {
            // Major: Every 3 months, Minor: Every 1 month
            for (let i = Math.ceil(xDomain[0]); i <= Math.floor(xDomain[1]); i++) {
                ticks.push({ val: i, isMajor: i % 3 === 0 || i === xDomain[0] || i === xDomain[1] });
            }
        } else if (xDisplayMode === 'years') {
            // Major: Every year, Minor: Every 3 months (quarter)
            const startMonth = Math.ceil(xDomain[0]);
            const endMonth = Math.floor(xDomain[1]);
            for (let i = startMonth; i <= endMonth; i+=3) {
                 ticks.push({ val: i, isMajor: (i % 12 === 0) });
            }
        } else {
            // Default (Length cm)
            // Major every 5, Minor every 1
            for (let i = Math.ceil(xDomain[0]); i <= Math.floor(xDomain[1]); i++) {
                ticks.push({ val: i, isMajor: i % 5 === 0 });
            }
        }
        return ticks;
    }, [xDisplayMode, xDomain]);

    // Calculate MPH Trajectory Curves
    const mphCurves = useMemo(() => {
        if (!mph || !mphRange) return null;

        // 1. Determine Z-scores at Adult Age (20 years / 240 months)
        // IMPORTANT: We must use the CDC dataset for 2-20 years to determine the adult Z-score,
        // regardless of whether we are currently plotting the WHO (0-24m) or CDC chart.
        const adultAge = 240; 
        const adultRefData = CDC_HEIGHT_AGE[sex];
        const adultLMS = interpolateLMS(adultRefData, adultAge);
        
        const zTarget = calculateZScore(mph, adultLMS);
        const zLower = calculateZScore(mphRange[0], adultLMS);
        const zUpper = calculateZScore(mphRange[1], adultLMS);

        // 2. Generate points for these Z-scores across the current chart domain
        // This effectively projects the adult trajectory backwards onto the current chart (e.g., infant chart)
        const numPoints = 80; 
        const step = (xDomain[1] - xDomain[0]) / (numPoints - 1);
        
        const targetPoints = [];
        const lowerPoints = [];
        const upperPoints = [];

        for (let i = 0; i < numPoints; i++) {
            const x = xDomain[0] + step * i;
            // Use the CURRENT chart data (data prop) to plot the line for this Z-score
            // This ensures the line follows the curve shape of the current standard (WHO or CDC)
            const lms = interpolateLMS(data, x);
            
            targetPoints.push({ x, y: calculateValueFromZ(zTarget, lms) });
            lowerPoints.push({ x, y: calculateValueFromZ(zLower, lms) });
            upperPoints.push({ x, y: calculateValueFromZ(zUpper, lms) });
        }

        return { targetPoints, lowerPoints, upperPoints };
    }, [mph, mphRange, data, xDomain, sex]);

    // Generate Standard Percentile Curves
    const curves = useMemo(() => {
        const numPoints = 80; 
        const step = (xDomain[1] - xDomain[0]) / (numPoints - 1);
        
        let minY = Infinity;
        let maxY = -Infinity;

        // Calculate all lines first to find Y range
        const calculatedLines = percentiles.map(p => {
            const points = [];
            for (let i = 0; i < numPoints; i++) {
                const x = xDomain[0] + step * i;
                const lms = interpolateLMS(data, x);
                const y = calculateValueFromZ(p.z, lms);
                points.push({ x, y });
                
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
            return { ...p, points };
        });

        // Adjust domain to fit User Point
        minY = Math.min(minY, userY);
        maxY = Math.max(maxY, userY);
        
        // If MPH is provided, ensure the Y domain includes the MPH range ONLY if we are near adult age
        // For infants, we don't want to squash the chart to show the adult height (170cm+)
        if (mph && mphRange && xDomain[1] >= 200) {
            minY = Math.min(minY, mphRange[0]);
            maxY = Math.max(maxY, mphRange[1]);
        }

        // Add some padding to Y range
        const yRange = maxY - minY || 1;
        minY = Math.floor(Math.max(0, minY - yRange * 0.1));
        maxY = Math.ceil(maxY + yRange * 0.1);

        // Ensure logical Y ticks (integers)
        if ((maxY - minY) < 10) {
             minY = Math.floor(minY);
             maxY = Math.ceil(maxY);
        }

        return { lines: calculatedLines, yDomain: [minY, maxY] as [number, number] };
    }, [data, xDomain, userY, percentiles, mph, mphRange]);

    const { lines, yDomain } = curves;

    // Y Ticks Generator (Integer steps)
    const yTicks = useMemo(() => {
        const ticks: { val: number, isMajor: boolean }[] = [];
        const range = yDomain[1] - yDomain[0];
        let step = 1;
        if (range > 50) step = 5;
        else if (range > 20) step = 2;

        for (let i = yDomain[0]; i <= yDomain[1]; i++) {
            if (i % step === 0 || (step > 1 && i % 1 === 0)) { // Minor ticks for intermediate
                 ticks.push({ val: i, isMajor: i % step === 0 });
            }
        }
        return ticks;
    }, [yDomain]);

    // Scales
    const getX = (val: number) => ((val - xDomain[0]) / (xDomain[1] - xDomain[0])) * chartWidth + padding.left;
    const getY = (val: number) => chartHeight - ((val - yDomain[0]) / (yDomain[1] - yDomain[0])) * chartHeight + padding.top;
    
    const createPath = (points: {x: number, y: number}[]) => {
        return points.map((pt, i) => 
            `${i === 0 ? 'M' : 'L'} ${getX(pt.x).toFixed(1)} ${getY(pt.y).toFixed(1)}`
        ).join(' ');
    };
    
    const createAreaPath = (pointsUpper: {x: number, y: number}[], pointsLower: {x: number, y: number}[]) => {
        // Forward along upper, backward along lower
        let d = "";
        pointsUpper.forEach((pt, i) => {
            d += `${i === 0 ? 'M' : 'L'} ${getX(pt.x).toFixed(1)} ${getY(pt.y).toFixed(1)} `;
        });
        // Reverse loop for lower
        for (let i = pointsLower.length - 1; i >= 0; i--) {
            d += `L ${getX(pointsLower[i].x).toFixed(1)} ${getY(pointsLower[i].y).toFixed(1)} `;
        }
        d += "Z";
        return d;
    };

    const formatXLabel = (val: number) => {
        if (xDisplayMode === 'years') return (val / 12).toFixed(0);
        return val.toFixed(0);
    };

    // Mouse Interaction
    const invertX = (svgX: number) => {
        const ratio = (svgX - padding.left) / chartWidth;
        return xDomain[0] + ratio * (xDomain[1] - xDomain[0]);
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return;
        const pt = svgRef.current.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
        
        if (svgP.x < padding.left || svgP.x > width - padding.right || svgP.y < padding.top || svgP.y > height - padding.bottom) {
            setTooltip(null);
            setHoveredCurve(null);
            return;
        }

        const cursorValX = invertX(svgP.x);
        const userScreenX = getX(userX);
        const userScreenY = getY(userY);
        const distToUser = Math.hypot(svgP.x - userScreenX, svgP.y - userScreenY);

        // User Point Tooltip
        if (distToUser < 20) {
             setHoveredCurve(null);
             setTooltip({
                 x: userScreenX,
                 y: userScreenY - 15,
                 title: "Patient",
                 color: userColor,
                 lines: [
                     `Age: ${xDisplayMode === 'years' ? (userX/12).toFixed(2) + ' yr' : userX.toFixed(1) + ' mo'}`,
                     `Value: ${userY.toFixed(2)}`,
                     `Z-Score: ${userMetric?.zScore.toFixed(2)}`,
                     `Percentile: ${userMetric?.percentile.toFixed(1)}%`
                 ]
             });
             return;
        }

        // Bone Age Tooltip
        if (boneAgeMonths && boneAgeMonths >= xDomain[0] && boneAgeMonths <= xDomain[1]) {
            const baScreenX = getX(boneAgeMonths);
            const distToBA = Math.hypot(svgP.x - baScreenX, svgP.y - userScreenY);
            if (distToBA < 20) {
                setHoveredCurve(null);
                setTooltip({
                    x: baScreenX,
                    y: userScreenY - 15,
                    title: "Bone Age",
                    color: boneAgeColor,
                    lines: [
                        `Bone Age: ${(boneAgeMonths/12).toFixed(1)} yr`,
                        `Diff: ${(boneAgeMonths/12 - userX/12).toFixed(1)} yr`,
                        `Height: ${userY.toFixed(1)} cm`
                    ]
                });
                return;
            }
        }

        // Curve Tooltip
        let closestDist = 20;
        let closest = null;
        const lmsAtCursor = interpolateLMS(data, cursorValX);
        
        percentiles.forEach(p => {
            const valY = calculateValueFromZ(p.z, lmsAtCursor);
            const sy = getY(valY);
            const dist = Math.abs(svgP.y - sy);
            if (dist < closestDist) {
                closestDist = dist;
                closest = { ...p, valY };
            }
        });

        if (closest) {
            setHoveredCurve(closest.z);
            setTooltip({
                x: svgP.x,
                y: getY(closest.valY),
                title: closest.name,
                color: primaryColor,
                lines: [
                     `Age: ${xDisplayMode === 'years' ? (cursorValX/12).toFixed(2) + ' yr' : cursorValX.toFixed(1) + ' mo'}`,
                     `Value: ${closest.valY.toFixed(2)}`
                ]
            });
        } else {
            setHoveredCurve(null);
            setTooltip(null);
        }
    };

    const isUserVisible = userX >= xDomain[0] && userX <= xDomain[1];
    
    // Check if Bone Age is visible on current chart range
    const isBAVisible = boneAgeMonths !== undefined && boneAgeMonths >= xDomain[0] && boneAgeMonths <= xDomain[1];

    // Show MPH if data available and we have calculated the curves
    const showMPH = mph && mphRange && mphCurves;

    return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
            {/* Chart Header - Clinical Style */}
            <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center">
                 <h3 className="font-bold text-sm md:text-base uppercase tracking-wide" style={{ color: textColor }}>
                    {title}
                 </h3>
                 <div className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-500">
                    CDC/WHO Standard
                 </div>
            </div>

            <div className="relative w-full overflow-x-auto">
                <svg 
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`} 
                    className="min-w-[600px] w-full h-auto select-none cursor-crosshair"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setTooltip(null)}
                >
                    <defs>
                        <filter id="glow-marker" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                        {/* Yellow Hatch for MPH Target Box */}
                        <pattern id="mphHatch" patternUnits="userSpaceOnUse" width="4" height="4">
                            <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke={mphColor} strokeWidth="1" opacity="0.5" />
                        </pattern>
                    </defs>

                    {/* White Background */}
                    <rect x="0" y="0" width={width} height={height} fill="white" />

                    {/* Watermark: Dr. Bashar Ibrahim */}
                    <text 
                        x={padding.left + 15} 
                        y={padding.top + 30} 
                        fontSize="12" 
                        fontWeight="bold" 
                        fontFamily="serif"
                        fontStyle="italic"
                        fill="#000000" 
                        opacity="1" 
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                        Dr. Bashar Ibrahim
                    </text>

                    {/* Major/Minor Grid X */}
                    {xTicks.map((t, i) => (
                        <g key={`grid-x-${i}`}>
                            <line 
                                x1={getX(t.val)} y1={padding.top} 
                                x2={getX(t.val)} y2={height - padding.bottom} 
                                stroke={t.isMajor ? gridMajor : gridMinor} 
                                strokeWidth={t.isMajor ? 1.5 : 0.5}
                            />
                            {t.isMajor && (
                                <text 
                                    x={getX(t.val)} 
                                    y={height - padding.bottom + 15} 
                                    textAnchor="middle" 
                                    fontSize="10" 
                                    fill="#000000"
                                    fontWeight="bold"
                                >
                                    {formatXLabel(t.val)}
                                </text>
                            )}
                        </g>
                    ))}

                    {/* Major/Minor Grid Y */}
                    {yTicks.map((t, i) => (
                        <g key={`grid-y-${i}`}>
                            <line 
                                x1={padding.left} y1={getY(t.val)} 
                                x2={width - padding.right} y2={getY(t.val)} 
                                stroke={t.isMajor ? gridMajor : gridMinor} 
                                strokeWidth={t.isMajor ? 1.5 : 0.5}
                            />
                            {t.isMajor && (
                                <text 
                                    x={padding.left - 8} 
                                    y={getY(t.val) + 4} 
                                    textAnchor="end" 
                                    fontSize="10" 
                                    fill="#000000"
                                    fontWeight="bold"
                                >
                                    {t.val}
                                </text>
                            )}
                        </g>
                    ))}

                    {/* MPH Projection Layers (Draw behind curves but on top of grid) */}
                    {showMPH && mphCurves && (
                        <g>
                            {/* Shaded Target Zone Area - Dense Yellow */}
                            <path 
                                d={createAreaPath(mphCurves.upperPoints, mphCurves.lowerPoints)}
                                fill={mphFill}
                                opacity="0.4" 
                            />
                            
                            {/* Trajectory Lines (Dashed) - Wider YELLOW */}
                            <path d={createPath(mphCurves.upperPoints)} fill="none" stroke={mphColor} strokeWidth="2" strokeDasharray="6 4" opacity="0.9" />
                            <path d={createPath(mphCurves.lowerPoints)} fill="none" stroke={mphColor} strokeWidth="2" strokeDasharray="6 4" opacity="0.9" />
                            {/* Central Target - Thick Yellow */}
                            <path d={createPath(mphCurves.targetPoints)} fill="none" stroke={mphColor} strokeWidth="2.5" strokeDasharray="8 4" opacity="1" />
                        </g>
                    )}

                    {/* Border Box */}
                    <rect 
                        x={padding.left} 
                        y={padding.top} 
                        width={chartWidth} 
                        height={chartHeight} 
                        fill="none" 
                        stroke={textColor} 
                        strokeWidth="2" 
                    />

                    {/* Standard Percentile Curves */}
                    {lines.map((line, i) => {
                        const isHovered = hoveredCurve === line.z;
                        return (
                            <g key={i}>
                                <path 
                                    d={createPath(line.points)} 
                                    fill="none" 
                                    stroke={isHovered ? '#111827' : primaryColor} 
                                    strokeWidth={isHovered ? 2.5 : (line.z === 0 ? 2 : 1)} // Median thicker
                                    opacity={isHovered ? 1 : 0.8}
                                />
                                {/* Line Labels at the end */}
                                <text 
                                    x={width - padding.right + 4} 
                                    y={getY(line.points[line.points.length-1].y) + 3} 
                                    fontSize="9" 
                                    fill={primaryColor}
                                    fontWeight="bold"
                                >
                                    {line.label}
                                </text>
                            </g>
                        );
                    })}

                    {/* Mid-Parental Height Target Marker at Age 20 (if visible) */}
                    {showMPH && mph && mphRange && xDomain[1] >= 240 && (
                        <g>
                            {/* Target Range Band at End */}
                            <rect 
                                x={getX(228)} // Start slightly before 20y
                                y={getY(mphRange[1])}
                                width={getX(240) - getX(228)} 
                                height={Math.abs(getY(mphRange[1]) - getY(mphRange[0]))}
                                fill="url(#mphHatch)"
                                stroke={mphColor}
                                strokeWidth="2"
                            />
                            {/* Mid Line Marker */}
                            <line 
                                x1={getX(228)} 
                                y1={getY(mph)} 
                                x2={getX(240)} 
                                y2={getY(mph)} 
                                stroke={mphColor} 
                                strokeWidth="3" 
                            />
                            <text 
                                x={getX(240) - 5} 
                                y={getY(mph) - 5} 
                                textAnchor="end" 
                                fontSize="10" 
                                fontWeight="bold" 
                                fill={mphColor}
                            >
                                MPH
                            </text>
                            {/* Bounds Labels */}
                            <text x={getX(240) + 4} y={getY(mphRange[1])} fontSize="9" fill={mphColor} fontWeight="bold" dominantBaseline="middle">
                                {mphRange[1].toFixed(0)}
                            </text>
                            <text x={getX(240) + 4} y={getY(mphRange[0])} fontSize="9" fill={mphColor} fontWeight="bold" dominantBaseline="middle">
                                {mphRange[0].toFixed(0)}
                            </text>
                        </g>
                    )}

                    {/* Axis Titles */}
                    <text 
                        x={width / 2} 
                        y={height - 10} 
                        textAnchor="middle" 
                        fontSize="12" 
                        fontWeight="bold" 
                        fill={textColor}
                    >
                        {xLabel}
                    </text>
                    <text 
                        x={15} 
                        y={height / 2} 
                        textAnchor="middle" 
                        transform={`rotate(-90, 15, ${height/2})`} 
                        fontSize="12" 
                        fontWeight="bold" 
                        fill={textColor}
                    >
                        {yLabel}
                    </text>

                    {/* User Point */}
                    {isUserVisible && (
                        <g filter="url(#glow-marker)">
                            {/* Crosshair Lines - Dotted appearance */}
                            <line 
                                x1={padding.left} y1={getY(userY)} 
                                x2={getX(userX)} y2={getY(userY)} 
                                stroke="#000000" 
                                strokeWidth="4" 
                                strokeDasharray="0 8"
                                strokeLinecap="round"
                                opacity="0.6"
                            />
                            <line 
                                x1={getX(userX)} y1={height - padding.bottom} 
                                x2={getX(userX)} y2={getY(userY)} 
                                stroke="#000000" 
                                strokeWidth="4" 
                                strokeDasharray="0 8"
                                strokeLinecap="round"
                                opacity="0.6"
                            />
                            
                            {/* The Dot */}
                            <circle 
                                cx={getX(userX)} 
                                cy={getY(userY)} 
                                r="6" 
                                fill={userColor} 
                                stroke="white" 
                                strokeWidth="2" 
                                className="animate-pulse"
                            />
                        </g>
                    )}

                    {/* Bone Age Visualization */}
                    {isBAVisible && isUserVisible && (
                         <g>
                             {/* Dashed Connecting Line (Chronological Age -> Bone Age) at current height */}
                             <line 
                                x1={getX(userX)} y1={getY(userY)} 
                                x2={getX(boneAgeMonths!)} y2={getY(userY)} 
                                stroke={boneAgeColor} 
                                strokeWidth="2" 
                                strokeDasharray="6 3"
                            />
                            
                            {/* Bone Age Marker - Diamond Shape */}
                            <path 
                                d={`M ${getX(boneAgeMonths!)} ${getY(userY) - 6} L ${getX(boneAgeMonths!) + 6} ${getY(userY)} L ${getX(boneAgeMonths!)} ${getY(userY) + 6} L ${getX(boneAgeMonths!) - 6} ${getY(userY)} Z`}
                                fill={boneAgeColor}
                                stroke="white"
                                strokeWidth="1.5"
                            />
                            
                            {/* Label */}
                            <text 
                                x={getX(boneAgeMonths!)} 
                                y={getY(userY) - 10} 
                                textAnchor="middle" 
                                fontSize="10" 
                                fontWeight="bold" 
                                fill={boneAgeColor}
                            >
                                BA
                            </text>
                         </g>
                    )}

                    {/* Tooltip */}
                    {tooltip && (
                        <g transform={`translate(${tooltip.x}, ${tooltip.y})`} style={{ pointerEvents: 'none' }}>
                            <rect 
                                x="-140" 
                                y={-(60 + (tooltip.lines.length * 28))} 
                                width="280" 
                                height={60 + (tooltip.lines.length * 28)} 
                                rx="12" 
                                fill="rgba(255, 255, 255, 0.98)" 
                                stroke={tooltip.color} 
                                strokeWidth="2"
                                filter="drop-shadow(0 8px 16px rgba(0,0,0,0.2))"
                            />
                            <text 
                                x="0" 
                                y={-(60 + (tooltip.lines.length * 28)) + 35} 
                                textAnchor="middle" 
                                fontWeight="bold" 
                                fontSize="22" 
                                fill="#334155"
                            >
                                {tooltip.title}
                            </text>
                            <line 
                                x1="-120" 
                                y1={-(60 + (tooltip.lines.length * 28)) + 48} 
                                x2="120" 
                                y2={-(60 + (tooltip.lines.length * 28)) + 48} 
                                stroke="#e2e8f0" 
                                strokeWidth="2" 
                            />
                            {tooltip.lines.map((line, i) => (
                                <text 
                                    key={i} 
                                    x="0" 
                                    y={-(60 + (tooltip.lines.length * 28)) + 75 + (i * 28)} 
                                    textAnchor="middle" 
                                    fontSize="20" 
                                    fill="#475569"
                                    fontWeight="500"
                                >
                                    {line}
                                </text>
                            ))}
                        </g>
                    )}
                </svg>
            </div>
        </div>
    );
};

export default GrowthChart;