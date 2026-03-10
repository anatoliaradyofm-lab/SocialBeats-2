import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Rect, G, Text as SvgText } from 'react-native-svg';

function LineChart({
  data = [],
  width = 300,
  height = 160,
  lineColor = '#6C5CE7',
  fillColor = 'rgba(108,92,231,0.12)',
  dotColor = '#6C5CE7',
  labelColor = '#888',
  gridColor = '#E5E5E5',
  showGrid = true,
  showDots = true,
  showFill = true,
  showLabels = true,
  showValues = false,
  strokeWidth = 2.5,
  labelKey = 'label',
  valueKey = 'value',
}) {
  if (!data.length) return null;

  const paddingLeft = 32;
  const paddingRight = 12;
  const paddingTop = showValues ? 22 : 12;
  const paddingBottom = showLabels ? 28 : 12;
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const values = data.map(d => d[valueKey] || 0);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  const getX = (i) => paddingLeft + (i / Math.max(data.length - 1, 1)) * chartW;
  const getY = (v) => paddingTop + chartH - ((v - minVal) / range) * chartH;

  const points = data.map((d, i) => ({ x: getX(i), y: getY(d[valueKey] || 0) }));

  let pathD = '';
  points.forEach((p, i) => {
    pathD += i === 0 ? `M${p.x},${p.y}` : ` L${p.x},${p.y}`;
  });

  let fillD = '';
  if (showFill && points.length > 1) {
    fillD = pathD + ` L${points[points.length - 1].x},${paddingTop + chartH} L${points[0].x},${paddingTop + chartH} Z`;
  }

  const gridLines = 4;
  const gridSteps = [];
  for (let i = 0; i <= gridLines; i++) {
    const val = minVal + (range / gridLines) * i;
    gridSteps.push({ y: getY(val), val: Math.round(val) });
  }

  return (
    <Svg width={width} height={height}>
      {showGrid && gridSteps.map((g, i) => (
        <G key={`grid-${i}`}>
          <Line x1={paddingLeft} y1={g.y} x2={paddingLeft + chartW} y2={g.y} stroke={gridColor} strokeWidth={0.5} strokeDasharray="4,4" />
          <SvgText x={paddingLeft - 6} y={g.y + 3} fontSize={9} fill={labelColor} textAnchor="end">{g.val}</SvgText>
        </G>
      ))}

      {showFill && fillD ? <Path d={fillD} fill={fillColor} /> : null}
      {pathD ? <Path d={pathD} stroke={lineColor} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}

      {showDots && points.map((p, i) => (
        <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={3.5} fill="#FFF" stroke={dotColor} strokeWidth={2} />
      ))}

      {showValues && points.map((p, i) => (
        <SvgText key={`val-${i}`} x={p.x} y={p.y - 8} fontSize={9} fill={labelColor} textAnchor="middle">{values[i]}</SvgText>
      ))}

      {showLabels && data.map((d, i) => {
        const show = data.length <= 14 || i % Math.ceil(data.length / 10) === 0 || i === data.length - 1;
        return show ? (
          <SvgText key={`label-${i}`} x={getX(i)} y={height - 6} fontSize={9} fill={labelColor} textAnchor="middle">
            {d[labelKey] || ''}
          </SvgText>
        ) : null;
      })}
    </Svg>
  );
}

function BarChart({
  data = [],
  width = 300,
  height = 140,
  barColor = '#6C5CE7',
  labelColor = '#888',
  gridColor = '#E5E5E5',
  showGrid = true,
  showLabels = true,
  showValues = true,
  barRadius = 4,
  labelKey = 'label',
  valueKey = 'value',
  barColorFn,
}) {
  if (!data.length) return null;

  const paddingLeft = 28;
  const paddingRight = 8;
  const paddingTop = showValues ? 18 : 8;
  const paddingBottom = showLabels ? 26 : 8;
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const values = data.map(d => d[valueKey] || 0);
  const maxVal = Math.max(...values, 1);

  const barGap = 6;
  const barW = Math.max((chartW - barGap * data.length) / data.length, 4);

  return (
    <Svg width={width} height={height}>
      {showGrid && [0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = paddingTop + chartH * (1 - pct);
        return (
          <Line key={`g-${i}`} x1={paddingLeft} y1={y} x2={paddingLeft + chartW} y2={y} stroke={gridColor} strokeWidth={0.5} strokeDasharray="4,4" />
        );
      })}

      {data.map((d, i) => {
        const v = d[valueKey] || 0;
        const barH = Math.max((v / maxVal) * chartH, 2);
        const x = paddingLeft + barGap / 2 + i * (barW + barGap);
        const y = paddingTop + chartH - barH;
        const color = barColorFn ? barColorFn(d, i) : barColor;

        return (
          <G key={`bar-${i}`}>
            <Rect x={x} y={y} width={barW} height={barH} rx={barRadius} ry={barRadius} fill={color} opacity={0.6 + (v / maxVal) * 0.4} />
            {showValues && v > 0 && (
              <SvgText x={x + barW / 2} y={y - 4} fontSize={8} fill={labelColor} textAnchor="middle">{v}</SvgText>
            )}
            {showLabels && (
              <SvgText x={x + barW / 2} y={height - 6} fontSize={8} fill={labelColor} textAnchor="middle">{(d[labelKey] || '').substring(0, 4)}</SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

function HorizontalBarChart({
  data = [],
  width = 300,
  height,
  barColor = '#6C5CE7',
  labelColor = '#888',
  bgColor = '#F0F0F0',
  barHeight = 20,
  gap = 8,
  labelKey = 'label',
  valueKey = 'value',
  showPercentage = true,
  barColorFn,
}) {
  if (!data.length) return null;

  const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const totalH = height || data.length * (barHeight + gap) + gap;

  return (
    <View style={{ width, height: totalH }}>
      {data.map((d, i) => {
        const v = d[valueKey] || 0;
        const pct = (v / maxVal) * 100;
        const color = barColorFn ? barColorFn(d, i) : barColor;
        return (
          <View key={i} style={{ marginBottom: gap }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
              <Text style={{ fontSize: 12, color: labelColor, fontWeight: '500' }}>{d[labelKey] || ''}</Text>
              <Text style={{ fontSize: 11, color: labelColor }}>{showPercentage && d.percentage != null ? `${d.percentage}%` : v}</Text>
            </View>
            <View style={{ height: barHeight, borderRadius: barHeight / 2, backgroundColor: bgColor, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${Math.max(pct, 2)}%`, borderRadius: barHeight / 2, backgroundColor: color }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function DonutChart({
  data = [],
  size = 120,
  strokeWidth = 16,
  centerLabel = '',
  centerValue = '',
  labelColor = '#888',
  colors = ['#6C5CE7', '#00CECE', '#FF6B6B', '#F59E0B', '#10B981', '#EC4899'],
}) {
  if (!data.length) return null;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((s, d) => s + (d.value || 0), 0) || 1;
  const cx = size / 2;
  const cy = size / 2;

  let accumulated = 0;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {data.map((d, i) => {
            const pct = (d.value || 0) / total;
            const dashLen = pct * circumference;
            const dashGap = circumference - dashLen;
            const offset = -accumulated * circumference + circumference * 0.25;
            accumulated += pct;
            return (
              <Circle
                key={i}
                cx={cx} cy={cy} r={radius}
                stroke={colors[i % colors.length]}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${dashLen} ${dashGap}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
        {(centerLabel || centerValue) && (
          <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: labelColor }}>{centerValue}</Text>
            {centerLabel ? <Text style={{ fontSize: 10, color: labelColor }}>{centerLabel}</Text> : null}
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 }}>
        {data.map((d, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[i % colors.length] }} />
            <Text style={{ fontSize: 10, color: labelColor }}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export { LineChart, BarChart, HorizontalBarChart, DonutChart };
