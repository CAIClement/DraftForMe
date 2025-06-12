# DraftForMe - AI-Powered Champion Draft Assistant

A League of Legends draft assistant similar to DraftGap that provides AI-powered champion recommendations based on team compositions, enemy picks, and your play history.

## 🚀 Features

- **AI-Powered Recommendations**: Get intelligent champion suggestions based on multiple factors
- **Team Composition Analysis**: Analyze synergies between your team members
- **Counter Picking**: Identify champions that counter the enemy team
- **Personal History Integration**: Recommendations consider your preferred champions
- **Modern UI**: Clean, responsive interface with dark theme
- **Real-time Updates**: Instant recommendations as you modify team compositions

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **Material-UI (MUI)** - Beautiful, accessible components
- **Axios** - HTTP client for API calls
- **Responsive Design** - Works on desktop and mobile

### Backend
- **Python Flask** - Lightweight web framework
- **Flask-CORS** - Cross-origin resource sharing
- **Pandas & NumPy** - Data manipulation and analysis
- **Scikit-learn** - Machine learning algorithms

## 📦 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- Python 3.8 or higher
- npm or yarn

### Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd back
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   python -m venv venv
   
   # On Windows:
   venv\Scripts\activate
   
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Riot API (Optional but Recommended):**
   - Get your API key from [Riot Developer Portal](https://developer.riotgames.com/)
   - Create a `.env` file in the `back` directory:
   ```bash
   # .env file
   RIOT_API_KEY=your_riot_api_key_here
   RIOT_API_RATE_LIMIT_PER_SECOND=20
   RIOT_API_RATE_LIMIT_PER_MINUTE=100
   CACHE_TYPE=simple
   CACHE_DEFAULT_TIMEOUT=300
   FLASK_ENV=development
   FLASK_DEBUG=True
   ```
   - **Note:** Without an API key, the app will work in demo mode with mock data

5. **Start the Flask server:**
   ```bash
   python app.py
   ```
   
   The backend will run on `http://localhost:5000`

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd front
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the React development server:**
   ```bash
   npm start
   ```
   
   The frontend will run on `http://localhost:3000`

## 🎮 How to Use

1. **Start Both Servers**: Make sure both backend (port 5000) and frontend (port 3000) are running

2. **Search Your Summoner (Optional)**:
   - Enter your League of Legends summoner name and region
   - The app will analyze your recent ranked games and champion performance
   - This provides personalized recommendations based on your actual play history

3. **Build Team Compositions**:
   - Use the Champion Pool section to search and filter champions
   - Click "Ally" to add champions to your team (max 4)
   - Click "Enemy" to add champions to the enemy team (max 5)

4. **Select Your Role**:
   - Choose from Top, Jungle, Mid, ADC, or Support
   - This determines which champions will be recommended

5. **Get AI Recommendations**:
   - Click "Get Recommendations" to receive AI-powered suggestions
   - View detailed reasoning for each recommendation
   - See scores based on synergy, counters, and your play history
   - Recommendations will be enhanced if you've searched your summoner

## 🧠 AI Algorithm

The recommendation system considers multiple factors:

- **Team Synergy**: How well the champion works with your allies
- **Counter Potential**: How effectively the champion counters enemies
- **Personal Preference**: Bonus for champions in your play history
- **Role Optimization**: Champions optimized for the selected role

### Scoring System
- **80-100**: Excellent pick (Green)
- **60-79**: Good pick (Orange)  
- **0-59**: Fair pick (Red)

## 🔧 API Endpoints

### GET `/api/champions`
Returns all available champions with their roles and tags.

### GET `/api/champions/by-role/<role>`
Returns champions filtered by specific role.

### POST `/api/summoner/search`
Search for a summoner by name and region.

### POST `/api/summoner/history`
Get detailed summoner history and champion preferences.

### POST `/api/summoner/current-game`
Get current live game information for a summoner.

### POST `/api/recommend`
Returns AI recommendations based on team compositions.

**Request Body:**
```json
{
  "userHistory": [1, 2, 8, 14],
  "allyTeam": [1, 5],
  "enemyTeam": [3, 7, 12],
  "targetRole": "mid",
  "summonerData": {
    "champion_preferences": [1, 2, 8],
    "detailed_preferences": [...],
    "role_preferences": {...}
  }
}
```

### GET `/api/regions`
Returns available League of Legends regions.

### GET `/api/health`
Health check endpoint.

## 🎨 Customization

### Adding More Champions
Edit the `CHAMPIONS` array in `back/app.py` to add more champions with their roles and tags.

### Modifying Synergies/Counters
Update the `SYNERGIES` and `COUNTERS` dictionaries in `back/app.py` to adjust the recommendation logic.

### UI Theming
Modify the `darkTheme` object in `front/src/App.js` to customize colors and styling.

## 🚀 Deployment

### Backend Deployment
- Use services like Heroku, Railway, or DigitalOcean
- Set environment variables for production
- Use a production WSGI server like Gunicorn

### Frontend Deployment
- Build the React app: `npm run build`
- Deploy to Netlify, Vercel, or any static hosting service
- Update API_BASE_URL to point to your deployed backend

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📝 Future Enhancements

- [ ] Integration with Riot Games API for real champion data
- [ ] Machine learning model training on actual game data
- [ ] User authentication and personal statistics
- [ ] Champion images and detailed information
- [ ] Export draft recommendations
- [ ] Mobile app version

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Inspired by DraftGap and similar draft assistance tools
- Built with modern web technologies
- Champion data structure based on League of Legends

---

**Note**: This is a demonstration project. For production use with real League of Legends data, you would need to integrate with the official Riot Games API and implement proper data management. 