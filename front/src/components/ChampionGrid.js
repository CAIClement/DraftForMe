import React from 'react';
import { Grid, Card, CardMedia, CardContent, Typography } from '@mui/material';
import './ChampionGrid.css';

// Mock data for champions
const mockChampions = [
  {
    id: 1,
    name: 'Ahri',
    image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg',
    roles: ['Mage', 'Assassin']
  },
    {
      id: 2,
      name: 'Darius',
      image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Darius_0.jpg',
      roles: ['Fighter', 'Tank']
    },
    {
      id: 3,
      name: 'Lux',
      image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Lux_0.jpg',
      roles: ['Mage', 'Support']
    },

    {
      id: 4,
      name: 'Ezreal',
      image: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ezreal_0.jpg',
      roles: ['Marksman']
    },

];

const ChampionGrid = ({ searchQuery, selectedRole, onChampionSelect }) => {
  const filteredChampions = mockChampions.filter(champion => {
    const matchesSearch = champion.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'All' || champion.roles.includes(selectedRole);
    return matchesSearch && matchesRole;
  });

  return (
    <Grid container spacing={2} className="champion-grid">
      {filteredChampions.map((champion) => (
        <Grid item xs={6} sm={4} md={3} key={champion.id}>
          <Card 
            className="champion-card"
            onClick={() => onChampionSelect(champion)}
          >
            <CardMedia
              component="img"
              height="140"
              image={champion.image}
              alt={champion.name}
            />
            <CardContent>
              <Typography variant="h6" component="div">
                {champion.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {champion.roles.join(', ')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default ChampionGrid; 