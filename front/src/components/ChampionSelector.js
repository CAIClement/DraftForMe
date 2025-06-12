import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  Box,
  Chip,
  Avatar
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

const ChampionSelector = ({ champions, onAddToTeam, allyTeam, enemyTeam }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  const roles = ['top', 'jungle', 'mid', 'adc', 'support'];

  const filteredChampions = champions.filter(champion => {
    const matchesSearch = champion.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !selectedRole || champion.role === selectedRole;
    const notInTeams = !allyTeam.some(c => c.id === champion.id) && 
                      !enemyTeam.some(c => c.id === champion.id);
    return matchesSearch && matchesRole && notInTeams;
  });

  const getChampionAvatar = (championName) => {
    // In a real app, you'd have champion images
    return championName.charAt(0).toUpperCase();
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

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Champion Pool
      </Typography>
      
      {/* Search and Filter */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Search Champions"
          variant="outlined"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
        />
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label="All"
            onClick={() => setSelectedRole('')}
            color={selectedRole === '' ? 'primary' : 'default'}
            variant={selectedRole === '' ? 'filled' : 'outlined'}
          />
          {roles.map((role) => (
            <Chip
              key={role}
              label={role.toUpperCase()}
              onClick={() => setSelectedRole(role)}
              color={selectedRole === role ? 'primary' : 'default'}
              variant={selectedRole === role ? 'filled' : 'outlined'}
              sx={{ textTransform: 'capitalize' }}
            />
          ))}
        </Box>
      </Box>

      {/* Champions Grid */}
      <Grid container spacing={2} sx={{ maxHeight: '400px', overflow: 'auto' }}>
        {filteredChampions.map((champion) => (
          <Grid item xs={12} sm={6} md={4} key={champion.id}>
            <Card 
              sx={{ 
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 4
                }
              }}
            >
              <CardContent sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: getRoleColor(champion.role),
                      width: 32,
                      height: 32,
                      mr: 1,
                      fontSize: '0.9rem'
                    }}
                  >
                    {getChampionAvatar(champion.name)}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                      {champion.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {champion.role.toUpperCase()}
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {champion.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: '20px' }}
                    />
                  ))}
                </Box>
              </CardContent>
              
              <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => onAddToTeam(champion, 'ally')}
                  disabled={allyTeam.length >= 4}
                  color="primary"
                >
                  Ally
                </Button>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => onAddToTeam(champion, 'enemy')}
                  disabled={enemyTeam.length >= 5}
                  color="secondary"
                >
                  Enemy
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredChampions.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">
            No champions found matching your criteria
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default ChampionSelector; 