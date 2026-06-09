import { Box, Button, InputAdornment, Slider, Stack, TextField, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { panelSx } from '../common/surfaceStyles'

const toInputValue = (value, fallback) =>
  value === null || value === undefined ? String(fallback) : String(value)

const parseInputNumber = (value) => {
  if (value === '') return Number.NaN
  return Number(value)
}

function TemperatureRangeControl({
  minValue,
  maxValue,
  unit,
  bounds = [0, 100],
  onSave,
  disabled = false,
}) {
  const [minTemp, setMinTemp] = useState(toInputValue(minValue, bounds[0]))
  const [maxTemp, setMaxTemp] = useState(toInputValue(maxValue, bounds[1]))
  const [minBound, maxBound] = bounds

  useEffect(() => {
    setMinTemp(toInputValue(minValue, minBound))
    setMaxTemp(toInputValue(maxValue, maxBound))
  }, [minValue, maxValue, minBound, maxBound])

  const minNumber = parseInputNumber(minTemp)
  const maxNumber = parseInputNumber(maxTemp)
  const hasFiniteBounds = Number.isFinite(minNumber) && Number.isFinite(maxNumber)
  const isOrdered = hasFiniteBounds && minNumber <= maxNumber
  const saveDisabled = disabled || !isOrdered

  const sliderBounds = useMemo(
    () => {
      const numericValues = [minNumber, maxNumber].filter(Number.isFinite)
      return [Math.min(minBound, ...numericValues), Math.max(maxBound, ...numericValues)]
    },
    [maxBound, maxNumber, minBound, minNumber]
  )

  const sliderValue = useMemo(() => {
    const fallbackMin = sliderBounds[0]
    const fallbackMax = sliderBounds[1]
    const nextValue = [
      Number.isFinite(minNumber) ? minNumber : fallbackMin,
      Number.isFinite(maxNumber) ? maxNumber : fallbackMax,
    ]
    return nextValue[0] <= nextValue[1] ? nextValue : [nextValue[1], nextValue[0]]
  }, [maxNumber, minNumber, sliderBounds])

  const handleSliderChange = (_, newValue) => {
    if (!Array.isArray(newValue)) return
    setMinTemp(String(newValue[0]))
    setMaxTemp(String(newValue[1]))
  }

  const handleSave = () => {
    if (saveDisabled) return
    onSave({ minTemp: minNumber, maxTemp: maxNumber })
  }

  return (
    <Box sx={{ ...panelSx, borderRadius: 1, p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Temperature Limits
        </Typography>
        <Slider
          value={sliderValue}
          min={sliderBounds[0]}
          max={sliderBounds[1]}
          step={0.1}
          valueLabelDisplay="auto"
          onChange={handleSliderChange}
          disabled={disabled}
          disableSwap
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
          <TextField
            label="minTemp"
            value={minTemp}
            onChange={(event) => setMinTemp(event.target.value)}
            type="number"
            size="small"
            error={hasFiniteBounds && minNumber > maxNumber}
            InputProps={{
              endAdornment: unit ? <InputAdornment position="end">{unit}</InputAdornment> : null,
            }}
            disabled={disabled}
          />
          <TextField
            label="maxTemp"
            value={maxTemp}
            onChange={(event) => setMaxTemp(event.target.value)}
            type="number"
            size="small"
            error={hasFiniteBounds && minNumber > maxNumber}
            InputProps={{
              endAdornment: unit ? <InputAdornment position="end">{unit}</InputAdornment> : null,
            }}
            disabled={disabled}
          />
          <Button variant="contained" onClick={handleSave} disabled={saveDisabled}>
            Save
          </Button>
        </Stack>
        {!isOrdered && (
          <Typography variant="caption" color="error">
            minTemp must be less than or equal to maxTemp.
          </Typography>
        )}
      </Stack>
    </Box>
  )
}

export default TemperatureRangeControl
