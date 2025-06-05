import React, { useState } from 'react';
import { Box, Grid, Paper, Typography, TextField, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ChampionGrid from './ChampionGrid';
import TeamDisplay from './TeamDisplay';
import './DraftInterface.css';

const DraftInterface = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChampions, setSelectedChampions] = useState([]);
  const [selectedRole, setSelectedRole] = useState('All');

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleChampionSelect = (champion) => {
    if (selectedChampions.length < 5) {
      setSelectedChampions([...selectedChampions, champion]);
    }
  };

  const handleChampionRemove = (index) => {
    const newSelection = [...selectedChampions];
    newSelection.splice(index, 1);
    setSelectedChampions(newSelection);
  };

  return (
    <Box className="draft-interface">
      <Grid container spacing={2}>
        {/* Left side - Champion Selection */}
        <Grid item xs={12} md={8}>
          <Paper className="champion-selection" elevation={3}>
            <Box className="search-bar">
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search champions..."
                value={searchQuery}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: (
                    <IconButton>
                      <SearchIcon />
                    </IconButton>
                  ),
                }}
              />
            </Box>
            <ChampionGrid
              searchQuery={searchQuery}
              selectedRole={selectedRole}
              onChampionSelect={handleChampionSelect}
            />
          </Paper>
        </Grid>

        {/* Right side - Team Display */}
        <Grid item xs={12} md={4}>
          <Paper className="team-display" elevation={3}>
            <Typography variant="h6" gutterBottom>
              Your Team
            </Typography>
            <TeamDisplay
              selectedChampions={selectedChampions}
              onChampionRemove={handleChampionRemove}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DraftInterface; 