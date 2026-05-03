# Smart IoT Base Incubator

A React/Vite frontend with a separate Flask backend API. The frontend stays focused on UI
and Firebase sign-in; Firestore reads/writes, admin user provisioning, role checks, and
detection-service proxying are handled by the backend.

## Getting Started

### Prerequisites

- Node.js (version 18 or higher recommended)
- npm or yarn
- Python 3.10+
- Firebase project with Email/Password authentication enabled
- Firebase Admin service account JSON stored outside the repo

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create/update the backend virtualenv and install dependencies:
```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
```

### Environment

Create frontend env from the example:
```bash
cp .env.example .env
```

Fill in the `VITE_FIREBASE_*` values from Firebase project settings and set:
```env
VITE_BACKEND_API_URL=http://localhost:8000
```

Create backend env from the example:
```bash
cp backend/.env.example backend/.env
```

Set one Firebase Admin credential path in `backend/.env`:
```env
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/firebase-service-account.json
```

Do not commit credential JSON files.

To make the first profile an admin when it is first created:
```env
BACKEND_BOOTSTRAP_ADMIN_EMAILS=admin@example.com
```

### Development

Start the backend API:
```bash
npm run dev:backend
```

Start the frontend development server:
```bash
npm run dev:frontend
```

The frontend will be available at `http://localhost:5173`. The backend defaults to
`http://localhost:8000`.

### Backend API

The frontend calls the backend API for application data. Data endpoints require a Firebase
ID token. Admin-only writes also require the user's Firestore profile role to be `Admin`.
The reports endpoint aggregates the `SensorLogs` collection into hourly, daily, weekly, or
monthly buckets and returns chart-ready rows plus summary metrics.

- `GET /api/health`
- `GET|POST /api/users/me`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/<uid>/role`
- `GET /api/incubator/snapshot`
- `GET /api/incubator/live-data`
- `PATCH /api/incubator/live-data`
- `GET /api/incubator/actuators`
- `PATCH /api/incubator/actuators`
- `GET /api/incubator/settings`
- `PATCH /api/incubator/settings`
- `GET /api/incubator/alerts`
- `GET /api/incubator/reports?period=hourly|daily|weekly|monthly`
- `GET /api/presence`

### Baby detection Flask service

1. Run your Flask + OpenCV inference service so it exposes an HTTP endpoint that returns the current baby-presence classification.
   The backend proxies it and normalizes the response for frontend `GET /api/presence`.
   The backend accepts detection JSON like:
   ```json
   {
     "present": true,
     "confidence": 0.94,
     "timestamp": "2024-11-05T12:34:56Z"
   }
   ```
2. Point the backend to the detection route:
   ```env
   DETECTION_SERVICE_URL=http://localhost:5000/status
   ```
3. Restart `npm run dev:backend`. The `Camera` page overlays the presence classification while the ESP32 stream plays.

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
│   ├── main.jsx         # Application entry point
│   └── index.css        # Global styles
├── backend/             # Flask backend API
├── Baby_Detection/      # Existing Flask/OpenCV detection service
├── index.html           # HTML template
├── vite.config.js       # Vite configuration
└── package.json         # Project dependencies
```

## Firebase Setup

This project uses Firebase Auth in the frontend and Firebase Admin SDK in the backend.
Follow these steps to set up Firebase:

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

### 4. Configure Frontend Environment Variables

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

### 5. Backend Firebase Admin Configuration

Create a Firebase Admin service account JSON file from Firebase Project Settings and
store it outside this repository. Point the backend to it with
`GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_CREDENTIALS_PATH`.

The project uses Firebase for:
- **Authentication** (`src/firebase/auth.js`) - sign in, sign up, password reset
- **Backend Auth verification** (`backend/app.py`) - verify Firebase ID tokens
- **Backend Firestore access** (`backend/app.py`) - incubator data, user profiles, roles

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
- Firebase Auth
- Flask backend API
- Firebase Admin SDK
- ESLint
