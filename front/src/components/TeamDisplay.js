import React from 'react';
import { Box, Card, CardMedia, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import './TeamDisplay.css';

const TeamDisplay = ({ selectedChampions, onChampionRemove }) => {
  return (
    <Box className="team-display-container">
      {selectedChampions.map((champion, index) => (
        <Card key={index} className="team-champion-card">
          <Box className="champion-image-container">
            <CardMedia
              component="img"
              image={champion.image}
              alt={champion.name}
              className="champion-image"
            />
            <IconButton
              className="remove-button"
              onClick={() => onChampionRemove(index)}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
          <Typography variant="subtitle1" className="champion-name">
            {champion.name}
          </Typography>
        </Card>
      ))}
      {Array(5 - selectedChampions.length).fill(null).map((_, index) => (
        <Card key={`empty-${index}`} className="empty-slot">
          <Typography variant="body2" color="text.secondary">
            Empty Slot
          </Typography>
        </Card>
      ))}
    </Box>
  );
};

export default TeamDisplay; 