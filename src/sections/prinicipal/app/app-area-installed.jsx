import { useState, useCallback } from 'react';

import Card from '@mui/material/Card';
import { useTheme } from '@mui/material/styles';
import CardHeader from '@mui/material/CardHeader';

import { fNumber, fShortenNumber } from 'src/utils/format-number';

import { Chart, useChart, ChartSelect, ChartLegends } from 'src/components/chart';

// ----------------------------------------------------------------------

export function AppAreaInstalled({ title, subheader, chart, sx, ...other }) {
  const theme = useTheme();
  const hasMultipleSeries = chart.series.length > 1;
  const [selectedSeries, setSelectedSeries] = useState(chart.series[0]?.name || '');

  const chartColors = chart.colors ?? [
    theme.palette.primary.dark,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.success.main,
  ];

  const chartOptions = useChart({
    chart: { stacked: true },
    colors: chartColors,
    stroke: { width: 0 },
    xaxis: { categories: chart.categories },
    tooltip: { y: { formatter: (value) => fNumber(value) } },
    plotOptions: { bar: { columnWidth: '40%' } },
    ...chart.options,
  });

  const handleChangeSeries = useCallback((newValue) => {
    setSelectedSeries(newValue);
  }, []);

  const currentSeries = chart.series.find((i) => i.name === selectedSeries);
  const legendValues = currentSeries?.data.map((item) =>
    fShortenNumber(item.data.reduce((total, value) => total + value, 0))
  );

  return (
    <Card sx={sx} {...other}>
      <CardHeader
        title={title}
        subheader={subheader}
        action={
          hasMultipleSeries ? (
            <ChartSelect
              options={chart.series.map((item) => item.name)}
              value={selectedSeries}
              onChange={handleChangeSeries}
            />
          ) : null
        }
        sx={{ mb: 3 }}
      />

      <ChartLegends
        colors={chartOptions?.colors}
        labels={chart.series[0].data.map((item) => item.name)}
        values={legendValues}
        sx={{ px: 3, gap: 3 }}
      />

      <Chart
        key={selectedSeries}
        type="bar"
        series={currentSeries?.data}
        options={chartOptions}
        slotProps={{ loading: { p: 2.5 } }}
        sx={{
          pl: 1,
          py: 2.5,
          pr: 2.5,
          height: 320,
        }}
      />
    </Card>
  );
}
