# Fahrtenbuch - Trip Tracking Application

## Overview
This is a React-based trip tracking application (Fahrtenbuch) that helps drivers manage and track their trips, expenses, and payments. The app uses Google's Gemini AI for intelligent features and includes a customer booking form.

## Project Type
- **Frontend**: React 19 + TypeScript + Vite
- **AI Integration**: Google Gemini AI
- **Styling**: Custom CSS

## Tech Stack
- React 19.1.1
- TypeScript 5.8.2
- Vite 6.2.0
- Google Gemini AI (@google/genai)

## Environment Setup

### Required Secrets
- `GEMINI_API_KEY` - Google Gemini API key for AI features (optional for basic functionality)
  - Get your API key from: https://aistudio.google.com/app/apikey

## Project Structure
```
.
├── index.html          # Main HTML entry point
├── index.tsx           # Main React application
├── index.css           # Application styles
├── vite.config.ts      # Vite configuration (configured for Replit)
├── tsconfig.json       # TypeScript configuration
├── package.json        # Dependencies
└── manifest.json       # PWA manifest
```

## Key Features
1. **Driver Login System** - User authentication for drivers
2. **Trip Management** - Add, edit, and track trips with details like:
   - License plate
   - Start/destination locations
   - Payment type (cash/invoice)
   - Number of drivers
   - Payment collection status
3. **Expense Tracking** - Track and manage expenses
4. **Customer Booking Form** - Customers can request rides via WhatsApp
5. **Boss Cockpit** - Management view for assigned trips
6. **AI-Powered Features** - Using Google Gemini for intelligent processing

## Development

### Running Locally
The app runs on port 5000 and is configured for the Replit environment.

```bash
npm install
npm run dev
```

### Building for Production
```bash
npm run build
npm run preview
```

## Deployment
The app is configured for Replit's autoscale deployment:
- **Build command**: `npm run build`
- **Run command**: `npm run preview`
- **Port**: 5000

## Recent Changes
- **Oct 13, 2025**: Initial Replit environment setup
  - Configured Vite for port 5000 with host 0.0.0.0
  - Added `allowedHosts: true` to allow Replit proxy hosts
  - Added HMR configuration for Replit proxy (clientPort 443)
  - Updated .gitignore for Node.js/Vite projects
  - Set up autoscale deployment configuration

## Notes
- The app includes WhatsApp integration for customer booking requests
- PWA-ready with manifest.json and iOS meta tags
- German language interface (Fahrtenbuch = Trip Log)
