import { Card, CardContent, Typography, Slider, Stack, TextField, Button, InputAdornment } from '@mui/material'
import { useEffect, useState } from 'react'

function SetpointControl({ label, unit, value, range = [0, 100], onSave, disabled = false }) {
  const [setpoint, setSetpoint] = useState(value ?? range[0])
  const [minRange, maxRange] = range

  useEffect(() => {
    setSetpoint(value ?? range[0])
  }, [value, range])

  const handleSave = () => {
    if (disabled) return
    onSave(setpoint)
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {label} Setpoint
          </Typography>
          <Slider
            value={Number(setpoint)}
            min={minRange}
            max={maxRange}
            step={0.1}
            valueLabelDisplay="auto"
            onChange={(_, newValue) => setSetpoint(newValue)}
            disabled={disabled}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label="Target"
              value={setpoint}
              onChange={(e) => setSetpoint(e.target.value)}
              type="number"
              size="small"
              InputProps={{
                endAdornment: unit ? <InputAdornment position="end">{unit}</InputAdornment> : null,
              }}
              disabled={disabled}
            />
            <Button variant="contained" onClick={handleSave} disabled={disabled}>
              Save
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default SetpointControl
