import React, { useState } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Grid,
  Avatar,
  LinearProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  EmojiEvents as TrophyIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const SummonerSearch = ({ onSummonerDataLoaded }) => {
  const [summonerName, setSummonerName] = useState('');
  const [region, setRegion] = useState('na1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summonerData, setSummonerData] = useState(null);
  const [regions] = useState([
    { code: 'na1', name: 'North America' },
    { code: 'euw1', name: 'Europe West' },
    { code: 'eun1', name: 'Europe Nordic & East' },
    { code: 'kr', name: 'Korea' },
    { code: 'br1', name: 'Brazil' },
    { code: 'la1', name: 'Latin America North' },
    { code: 'la2', name: 'Latin America South' },
    { code: 'oc1', name: 'Oceania' },
    { code: 'tr1', name: 'Turkey' },
    { code: 'ru', name: 'Russia' },
    { code: 'jp1', name: 'Japan' }
  ]);

  const searchSummoner = async () => {
    if (!summonerName.trim()) {
      setError('Please enter a summoner name');
      return;
    }

    setLoading(true);
    setError('');
    setSummonerData(null);

    try {
      // Get summoner history and preferences
      const response = await axios.post(`${API_BASE_URL}/summoner/history`, {
        summonerName: summonerName.trim(),
        region: region
      });

      const data = response.data;
      setSummonerData(data);
      
      // Pass the data to parent component for use in recommendations
      onSummonerDataLoaded(data);

    } catch (err) {
      console.error('Error searching summoner:', err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to search summoner. Please check the name and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      searchSummoner();
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      top: '#8B4513',
      jungle: '#228B22',
      mid: '#4169E1',
      adc: '#DC143C',
      support: '#FFD700'
    };
    return colors[role] || '#666';
  };

  const getChampionAvatar = (championName) => {
    return championName ? championName.charAt(0).toUpperCase() : '?';
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
        Summoner Lookup
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Search for your League of Legends summoner to get personalized champion recommendations based on your match history and performance.
      </Typography>

      {/* Search Form */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'flex-end' }}>
        <TextField
          label="Summoner Name"
          variant="outlined"
          value={summonerName}
          onChange={(e) => setSummonerName(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
          sx={{ flexGrow: 1 }}
          placeholder="Enter your summoner name"
        />
        
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Region</InputLabel>
          <Select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            disabled={loading}
            label="Region"
          >
            {regions.map((r) => (
              <MenuItem key={r.code} value={r.code}>
                {r.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Button
          variant="contained"
          onClick={searchSummoner}
          disabled={loading || !summonerName.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
          sx={{ px: 3, py: 1.5 }}
        >
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading Progress */}
      {loading && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Analyzing match history and champion performance...
          </Typography>
          <LinearProgress />
        </Box>
      )}

      {/* Summoner Data Display */}
      {summonerData && (
        <Box>
          {/* Summoner Info */}
          <Card sx={{ mb: 2, bgcolor: 'rgba(63, 81, 181, 0.1)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 48, height: 48 }}>
                  {summonerData.summoner?.name?.charAt(0).toUpperCase() || 'S'}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    {summonerData.summoner?.name || summonerName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Level {summonerData.summoner?.level || 'Unknown'} • {regions.find(r => r.code === region)?.name}
                  </Typography>
                  {summonerData.total_games_analyzed && (
                    <Typography variant="caption" color="text.secondary">
                      {summonerData.total_games_analyzed} recent ranked games analyzed
                    </Typography>
                  )}
                </Box>
                {summonerData.mock_data && (
                  <Chip 
                    label="Demo Mode" 
                    color="warning" 
                    size="small" 
                    sx={{ ml: 'auto' }}
                  />
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Champion Preferences */}
          {summonerData.detailed_preferences && summonerData.detailed_preferences.length > 0 && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <TrophyIcon sx={{ mr: 1, color: 'warning.main' }} />
                  Top Champions
                </Typography>
                <Grid container spacing={2}>
                  {summonerData.detailed_preferences.slice(0, 6).map((pref, index) => (
                    <Grid item xs={12} sm={6} md={4} key={pref.championId}>
                      <Card 
                        variant="outlined" 
                        sx={{ 
                          bgcolor: index === 0 ? 'rgba(255, 193, 7, 0.1)' : 'background.paper',
                          border: index === 0 ? '1px solid #ffc107' : undefined
                        }}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Avatar 
                              sx={{ 
                                bgcolor: getRoleColor(pref.primaryRole),
                                width: 32,
                                height: 32,
                                mr: 1,
                                fontSize: '0.9rem'
                              }}
                            >
                              {getChampionAvatar(pref.championName)}
                            </Avatar>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                {pref.championName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {pref.primaryRole?.toUpperCase()}
                              </Typography>
                            </Box>
                            {index === 0 && (
                              <TrophyIcon sx={{ color: 'warning.main', fontSize: '1rem' }} />
                            )}
                          </Box>
                          
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="caption">
                              {pref.games} games
                            </Typography>
                            <Typography variant="caption" sx={{ color: pref.winRate > 0.6 ? 'success.main' : 'text.secondary' }}>
                              {(pref.winRate * 100).toFixed(0)}% WR
                            </Typography>
                          </Box>
                          
                          <LinearProgress 
                            variant="determinate" 
                            value={pref.winRate * 100} 
                            sx={{ 
                              height: 4,
                              borderRadius: 2,
                              bgcolor: 'rgba(255, 255, 255, 0.1)',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: pref.winRate > 0.6 ? 'success.main' : 'warning.main',
                                borderRadius: 2
                              }
                            }}
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Role Preferences */}
          {summonerData.role_preferences && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <TrendingUpIcon sx={{ mr: 1, color: 'info.main' }} />
                  Role Preferences
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {Object.entries(summonerData.role_preferences)
                    .sort(([,a], [,b]) => b - a)
                    .map(([role, games]) => {
                      const total = Object.values(summonerData.role_preferences).reduce((a, b) => a + b, 0);
                      const percentage = ((games / total) * 100).toFixed(0);
                      return (
                        <Chip
                          key={role}
                          label={`${role.toUpperCase()} (${percentage}%)`}
                          sx={{ 
                            bgcolor: getRoleColor(role),
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      );
                    })}
                </Box>
              </CardContent>
            </Card>
          )}

          {summonerData.mock_data && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Demo Mode:</strong> No Riot API key configured. Using mock data for demonstration. 
                To get real summoner data, configure your Riot API key in the backend.
              </Typography>
            </Alert>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default SummonerSearch; 