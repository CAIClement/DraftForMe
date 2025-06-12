import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  AppBar,
  Toolbar,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Alert
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import ChampionSelector from './components/ChampionSelector';
import RecommendationPanel from './components/RecommendationPanel';
import TeamComposition from './components/TeamComposition';
import SummonerSearch from './components/SummonerSearch';
import axios from 'axios';
import './App.css';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#0a1929',
      paper: '#132f4c',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
  },
});

const API_BASE_URL = 'http://localhost:5000/api';

function App() {
  const [champions, setChampions] = useState([]);
  const [allyTeam, setAllyTeam] = useState([]);
  const [enemyTeam, setEnemyTeam] = useState([]);
  const [userHistory, setUserHistory] = useState([1, 2, 8, 14]); // Mock user history
  const [targetRole, setTargetRole] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summonerData, setSummonerData] = useState(null);

  useEffect(() => {
    fetchChampions();
  }, []);

  const fetchChampions = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/champions`);
      setChampions(response.data);
    } catch (err) {
      setError('Failed to fetch champions. Make sure the backend is running.');
      console.error('Error fetching champions:', err);
    }
  };

  const getRecommendations = async () => {
    if (!targetRole) {
      setError('Please select a role first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/recommend`, {
        userHistory,
        allyTeam: allyTeam.map(champ => champ.id),
        enemyTeam: enemyTeam.map(champ => champ.id),
        targetRole,
        summonerData
      });
      setRecommendations(response.data.recommendations);
    } catch (err) {
      setError('Failed to get recommendations. Make sure the backend is running.');
      console.error('Error getting recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToTeam = (champion, team) => {
    if (team === 'ally' && allyTeam.length < 4) {
      setAllyTeam([...allyTeam, champion]);
    } else if (team === 'enemy' && enemyTeam.length < 5) {
      setEnemyTeam([...enemyTeam, champion]);
    }
  };

  const removeFromTeam = (championId, team) => {
    if (team === 'ally') {
      setAllyTeam(allyTeam.filter(champ => champ.id !== championId));
    } else {
      setEnemyTeam(enemyTeam.filter(champ => champ.id !== championId));
    }
  };

  const roles = ['top', 'jungle', 'mid', 'adc', 'support'];

  const handleSummonerDataLoaded = (data) => {
    setSummonerData(data);
    if (data.champion_preferences) {
      setUserHistory(data.champion_preferences);
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" sx={{ background: 'linear-gradient(45deg, #1e3c72 30%, #2a5298 90%)' }}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
              🎯 DraftForMe
            </Typography>
            <Typography variant="subtitle1" sx={{ opacity: 0.8 }}>
              AI-Powered Champion Recommendations
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Summoner Search */}
            <Grid item xs={12}>
              <SummonerSearch onSummonerDataLoaded={handleSummonerDataLoaded} />
            </Grid>

            {/* Team Compositions */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                  Team Compositions
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TeamComposition
                      title="Your Team"
                      team={allyTeam}
                      onRemove={(id) => removeFromTeam(id, 'ally')}
                      maxSize={4}
                      color="primary"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TeamComposition
                      title="Enemy Team"
                      team={enemyTeam}
                      onRemove={(id) => removeFromTeam(id, 'enemy')}
                      maxSize={5}
                      color="secondary"
                    />
                  </Grid>
                </Grid>
              </Paper>

              {/* Role Selection */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Select Your Role
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {roles.map((role) => (
                    <Chip
                      key={role}
                      label={role.toUpperCase()}
                      onClick={() => setTargetRole(role)}
                      color={targetRole === role ? 'primary' : 'default'}
                      variant={targetRole === role ? 'filled' : 'outlined'}
                      sx={{ textTransform: 'capitalize', fontWeight: 'bold' }}
                    />
                  ))}
                </Box>
                <Button
                  variant="contained"
                  onClick={getRecommendations}
                  disabled={!targetRole || loading}
                  sx={{ mt: 2, px: 4, py: 1 }}
                  size="large"
                >
                  {loading ? 'Getting Recommendations...' : 'Get Recommendations'}
                </Button>
                {loading && <LinearProgress sx={{ mt: 2 }} />}
              </Paper>

              {/* Champion Selector */}
              <ChampionSelector
                champions={champions}
                onAddToTeam={addToTeam}
                allyTeam={allyTeam}
                enemyTeam={enemyTeam}
              />
            </Grid>

            {/* Recommendations Panel */}
            <Grid item xs={12} md={4}>
              <RecommendationPanel
                recommendations={recommendations}
                targetRole={targetRole}
                loading={loading}
              />
            </Grid>
          </Grid>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
