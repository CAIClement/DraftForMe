import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Chip,
  LinearProgress,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  Star as StarIcon
} from '@mui/icons-material';

const RecommendationPanel = ({ recommendations, targetRole, loading }) => {
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

  const getScoreColor = (score) => {
    if (score >= 80) return '#4caf50'; // Green
    if (score >= 60) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Fair';
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <PsychologyIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">AI Recommendations</Typography>
        </Box>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Analyzing team compositions...
          </Typography>
          <LinearProgress />
        </Box>
      </Paper>
    );
  }

  if (!recommendations.length) {
    return (
      <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <PsychologyIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">AI Recommendations</Typography>
        </Box>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            {targetRole 
              ? `Select team compositions and click "Get Recommendations" to see AI suggestions for ${targetRole.toUpperCase()}`
              : 'Select a role to get AI-powered champion recommendations'
            }
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <PsychologyIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6">AI Recommendations</Typography>
      </Box>
      
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 3 }}>
        Best picks for {targetRole.toUpperCase()} role
      </Typography>

      <Stack spacing={2}>
        {recommendations.map((rec, index) => (
          <Card 
            key={rec.champion.id}
            sx={{ 
              position: 'relative',
              border: index === 0 ? '2px solid #4caf50' : '1px solid rgba(255, 255, 255, 0.12)',
              bgcolor: index === 0 ? 'rgba(76, 175, 80, 0.05)' : 'background.paper',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: 3
              }
            }}
          >
            {index === 0 && (
              <Box 
                sx={{ 
                  position: 'absolute',
                  top: -1,
                  right: 8,
                  bgcolor: '#4caf50',
                  color: 'white',
                  px: 1,
                  py: 0.5,
                  borderRadius: '0 0 8px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5
                }}
              >
                <StarIcon sx={{ fontSize: '0.8rem' }} />
                BEST PICK
              </Box>
            )}
            
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: getRoleColor(rec.champion.role),
                    width: 40,
                    height: 40,
                    mr: 2,
                    fontSize: '1.1rem',
                    fontWeight: 'bold'
                  }}
                >
                  {getChampionAvatar(rec.champion.name)}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    {rec.champion.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {rec.champion.tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: '18px' }}
                      />
                    ))}
                  </Box>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: getScoreColor(rec.score),
                      fontWeight: 'bold'
                    }}
                  >
                    {Math.round(rec.score)}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: getScoreColor(rec.score),
                      fontWeight: 'bold'
                    }}
                  >
                    {getScoreLabel(rec.score)}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 1 }} />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Why this pick?
                </Typography>
                <List dense sx={{ py: 0 }}>
                  {rec.reasoning.map((reason, reasonIndex) => (
                    <ListItem key={reasonIndex} sx={{ py: 0.5, px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <CheckCircleIcon 
                          sx={{ 
                            fontSize: '1rem', 
                            color: 'success.main' 
                          }} 
                        />
                      </ListItemIcon>
                      <ListItemText 
                        primary={reason}
                        primaryTypographyProps={{
                          variant: 'body2',
                          sx: { fontSize: '0.85rem' }
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>

              <Box sx={{ mt: 2 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={rec.score} 
                  sx={{ 
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: getScoreColor(rec.score),
                      borderRadius: 3
                    }
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(63, 81, 181, 0.1)', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
          <TrendingUpIcon sx={{ fontSize: '1rem', mr: 0.5 }} />
          Recommendations based on team synergy, counters, and your play history
        </Typography>
      </Box>
    </Paper>
  );
};

export default RecommendationPanel; 