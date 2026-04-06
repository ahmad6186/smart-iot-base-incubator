# Smart IoT Base Incubator

A React application built with Vite.

## Getting Started

### Prerequisites

- Node.js (version 18 or higher recommended)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Baby detection Flask service

1. Run your Flask + OpenCV inference service so it exposes an HTTP endpoint that returns the current baby-presence classification.  
   The UI polls `GET /api/presence` and expects JSON like:
   ```json
   {
     "present": true,
     "confidence": 0.94,
     "timestamp": "2024-11-05T12:34:56Z"
   }
   ```
2. Allow CORS on the Flask route so the browser can reach it from the Vite dev server / production origin.
3. Point the frontend to the service by adding the base URL (without the `/api/presence` path) to `.env`:
   ```env
   VITE_DETECTION_API_URL=http://192.168.0.120:5000
   ```
4. Restart `npm run dev`. The `Camera` page now overlays the presence classification while the ESP32 stream plays.

### Build

Create a production build:
```bash
npm run build
```

### Preview

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
├── src/
│   ├── App.jsx          # Main application component
│   ├── App.css          # Application styles
│   ├── main.jsx         # Application entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── vite.config.js       # Vite configuration
└── package.json         # Project dependencies
```

## Firebase Setup

This project uses Firebase for authentication. Follow these steps to set up Firebase:

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

### 2. Enable Authentication

1. In your Firebase project, go to **Authentication** > **Get started**
2. Enable **Email/Password** sign-in method
3. Click **Save**

### 3. Get Your Firebase Configuration

1. Go to **Project Settings** (gear icon) > **General**
2. Scroll down to **Your apps** section
3. Click the **Web** icon (`</>`) to add a web app
4. Register your app (you can skip hosting setup for now)
5. Copy your Firebase configuration object

### 4. Configure Environment Variables

1. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

2. Add your Firebase configuration to `.env`:
```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

3. Replace the placeholder values with your actual Firebase configuration values

### 5. Firebase Services Available

The project includes Firebase services for:
- **Authentication** (`src/firebase/auth.js`) - Sign in, sign up, password reset
- **Firestore** (`src/firebase/config.js`) - Database (ready to use)
- **Storage** (`src/firebase/config.js`) - File storage (ready to use)

### Example: Using Firebase Authentication

```javascript
import { signIn, signUp, logOut } from './firebase/auth'

// Sign in
const result = await signIn(email, password)
if (result.success) {
  console.log('User signed in:', result.user)
}

// Sign up
const signUpResult = await signUp(email, password, displayName)

// Sign out
await logOut()
```

## Technologies

- React 18
- Vite 5
- Material UI
- Firebase (Authentication, Firestore, Storage)
- ESLint
