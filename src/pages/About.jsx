import { Box, Typography, Grid, Card, CardContent, Stack, Avatar, Chip } from '@mui/material'

const team = [
  { name: 'Student Lead', role: 'Embedded & Cloud', color: 'primary' },
  { name: 'AI Engineer', role: 'Model Development', color: 'secondary' },
  { name: 'Hardware Lead', role: 'Mechanical Design', color: 'success' },
  { name: 'Supervisor', role: 'Faculty Advisor', color: 'info' },
]

function About() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box>
        <Typography variant="h3" sx={{ fontWeight: 700 }}>
          Smart IoT-Based Infant Incubator
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Final Year Project – Intelligent NICU monitoring to support neonatal care teams.
        </Typography>
      </Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Why neonatal monitoring matters
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Premature babies rely on incubators for thermoregulation, infection control, and oxygen therapy.
                Manual monitoring can be inconsistent, leading to delays when vitals drift from safe ranges.
                This platform maintains constant IoT telemetry while AI services highlight subtle deterioration early.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                How IoT powers the incubator
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Multi-sensor nodes stream temperature, humidity, SpO₂, heart rate, vibration, and audio data via Firebase.
                Edge controllers actuate heater, fan, humidifier, and alarms automatically and can be overridden remotely through this dashboard.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                AI-enhanced patient safety
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cry detection, infant presence classification, and anomaly detection models interpret streaming data.
                Weekly reports summarize AI insights, ensuring caregivers can brief consultants with actionable narratives.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Research & SDG impact
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aligns with SDG 3 to reduce neonatal mortality, while SDG 9 & 10 emphasise accessible innovation.
                The system is designed for regional hospitals with intermittent staffing.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Team & Supervision
          </Typography>
          <Grid container spacing={3}>
            {team.map((member) => (
              <Grid item xs={12} md={3} key={member.name}>
                <Stack spacing={1} alignItems="center">
                  <Avatar sx={{ width: 72, height: 72 }}>
                    {member.name.split(' ')[0][0]}
                  </Avatar>
                  <Typography variant="subtitle1">{member.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {member.role}
                  </Typography>
                  <Chip label="Placeholder" color={member.color} variant="outlined" />
                </Stack>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  )
}

export default About
