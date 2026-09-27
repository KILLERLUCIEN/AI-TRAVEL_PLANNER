# ✈️ TripPilot AI — Travel Planner

A polished full-stack AI travel planner built with HTML, CSS, JavaScript, Node.js and Express.

## Features

- AI-generated day-by-day itineraries
- AI travel assistant with conversation history
- Demo mode when no API key is configured
- Destination suggestion cards
- Budget, trip style, travellers and activity preferences
- Responsive glassmorphism UI
- Client + server validation
- Custom 404 and 500 error pages
- Loading states, toast notifications and smooth UI
- API key kept on the server
- No database required

## Run locally

1. Install Node.js 20+.
2. Open this project folder in a terminal.
3. Install packages:

   `npm install`

4. Copy `.env.example` to `.env`.
5. Add your API key to `.env`.
6. Start:

   `npm start`

7. Open `http://localhost:3000`

### Demo mode

If `OPENAI_API_KEY` is empty, the site automatically uses built-in demo replies. This lets you present and test the project without an API key.

## API endpoints

- `GET /api/health`
- `POST /api/plan`
- `POST /api/chat`

## Project structure

travel-planner-ai/
├── public/
│   ├── index.html
│   ├── 404.html
│   ├── 500.html
│   ├── styles.css
│   └── app.js
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js

## Important

The AI output is a planning aid, not a live booking system. Check current opening hours, prices, entry rules, transport schedules and local advisories before travelling.
