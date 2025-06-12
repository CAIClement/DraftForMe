import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Avatar,
  Chip,
  Stack
} from '@mui/material';
import { Close as CloseIcon, Add as AddIcon } from '@mui/icons-material';

const TeamComposition = ({ title, team, onRemove, maxSize, color }) => {
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
    return championName.charAt(0).toUpperCase();
  };

  const emptySlots = maxSize - team.length;

  return (
    <Box>
      <Typography variant="h6" gutterBottom color={`${color}.main`} sx={{ fontWeight: 'bold' }}>
        {title} ({team.length}/{maxSize})
      </Typography>
      
      <Stack spacing={1}>
        {/* Filled slots */}
        {team.map((champion) => (
          <Card 
            key={champion.id}
            sx={{ 
              bgcolor: color === 'primary' ? 'rgba(63, 81, 181, 0.1)' : 'rgba(245, 0, 87, 0.1)',
              border: `1px solid ${color === 'primary' ? '#3f51b5' : '#f50057'}`,
              transition: 'all 0.2s'
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: getRoleColor(champion.role),
                      width: 36,
                      height: 36,
                      mr: 2,
                      fontSize: '1rem',
                      fontWeight: 'bold'
                    }}
                  >
                    {getChampionAvatar(champion.name)}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      {champion.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {champion.role.toUpperCase()}
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {champion.tags.slice(0, 2).map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: '20px' }}
                      />
                    ))}
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => onRemove(champion.id)}
                    sx={{ color: 'text.secondary' }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
        
        {/* Empty slots */}
        {Array.from({ length: emptySlots }).map((_, index) => (
          <Card 
            key={`empty-${index}`}
            sx={{ 
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              border: '2px dashed rgba(255, 255, 255, 0.2)',
              minHeight: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
              <AddIcon sx={{ mr: 1, opacity: 0.5 }} />
              <Typography variant="body2" sx={{ opacity: 0.7 }}>
                Add Champion
              </Typography>
            </Box>
          </Card>
        ))}
      </Stack>
    </Box>
  );
};

export default TeamComposition; 