import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import { useTheme, alpha as hexAlpha } from '@mui/material/styles';

import { fData } from 'src/utils/format-number';

import { Chart, useChart, ChartSelect } from 'src/components/chart';

// ----------------------------------------------------------------------

export function FileDataActivity({ title, subheader, chart, sx, ...other }) {
  const theme = useTheme();

  const firstSeriesName = chart.series?.[0]?.name || '';

  const [selectedSeries, setSelectedSeries] = useState(firstSeriesName);

  const currentSeries = chart.series.find((i) => i.name === selectedSeries) || chart.series[0];
  const currentValueType = currentSeries?.valueType || chart.valueType;

  const chartColors = chart.colors ?? [
    theme.palette.primary.main,
    theme.palette.error.main,
    theme.palette.warning.main,
    hexAlpha(theme.palette.grey[500], 0.48),
  ];

  const chartOptions = useChart({
    chart: { stacked: true },
    colors: chartColors,
    stroke: { width: 0 },
    legend: { show: true },
    xaxis: { categories: currentSeries?.categories },
    tooltip: {
      y: {
        formatter: (value) =>
          currentValueType === 'count' ? value.toLocaleString('es-DO') : fData(value),
      },
    },
    ...chart.options,
  });

  useEffect(() => {
    if (!chart.series.some((i) => i.name === selectedSeries)) {
      setSelectedSeries(firstSeriesName);
    }
  }, [chart.series, firstSeriesName, selectedSeries]);

  const handleChangeSeries = useCallback((newValue) => {
    setSelectedSeries(newValue);
  }, []);

  return (
    <Card sx={sx} {...other}>
      <CardHeader
        title={title}
        subheader={subheader}
        action={
          <ChartSelect
            options={chart.series.map((i) => i.name)}
            value={selectedSeries}
            onChange={handleChangeSeries}
          />
        }
      />

      <Chart
        type="bar"
        series={currentSeries?.data}
        options={chartOptions}
        slotProps={{ loading: { p: 2.5 } }}
        sx={{
          pl: 1,
          py: 2.5,
          pr: 2.5,
          height: 370,
        }}
      />
    </Card>
  );
}
