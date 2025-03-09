# YouTube Channel Grouping & Video Aggregation Tool

A modern web application that allows you to organize YouTube channels into custom groups and view all their latest videos in one place. Never miss an upload from your favorite creators again!

![YouTube Channel Grouping Tool](https://via.placeholder.com/800x400?text=YouTube+Channel+Grouping+Tool)

## 🌟 Features

- **Channel Group Management**:
  - Create multiple groups to organize your favorite YouTube channels
  - Add, edit, and remove channels from any group
  - Manage groups with an intuitive drag-and-drop interface

- **Video Aggregation**:
  - View latest videos from all channels in a selected group
  - Filter videos by upload date:
    - Latest (last 24 hours)
    - Last 3 days
    - Last 7 days
    - All videos
  - Sort videos by date or view count

- **User-Friendly Interface**:
  - Modern, responsive design works on desktop and mobile
  - Smooth animations and transitions
  - Easy navigation between groups and settings

- **YouTube API Integration**:
  - Search for channels by name or URL
  - Add channels using various URL formats (@username, channel/ID, c/customname)
  - Automatic API key fallback system for reliability

- **Data Persistence**:
  - Local storage of groups and channels using IndexedDB
  - No server-side storage required - your data stays on your device

## 🛠️ Technologies Used

- **Frontend**: Next.js with TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Database**: IndexedDB (via Dexie.js)
- **API**: YouTube Data API v3

## 📋 Prerequisites

Before you install this application, make sure you have the following:

- Node.js (v14 or later)
- npm (v6 or later) or yarn (v1.22 or later)
- A YouTube Data API key ([Get one here](https://developers.google.com/youtube/v3/getting-started))

## 🔑 Getting a YouTube API Key

Follow these detailed steps to obtain your YouTube Data API key:

### 1. Create a Google Account

If you don't already have one, [create a Google Account](https://accounts.google.com/signup).

### 2. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on "Select a project" at the top of the page
3. Click "NEW PROJECT" in the popup window
4. Enter a project name (e.g., "YouTube Channel Tool")
5. Click "CREATE"
6. Wait for the project to be created, then select it

### 3. Enable the YouTube Data API v3

1. In the left sidebar, navigate to "APIs & Services" > "Library"
2. Search for "YouTube Data API v3"
3. Click on the API in the search results
4. Click "ENABLE"

### 4. Create API Key

1. In the left sidebar, navigate to "APIs & Services" > "Credentials"
2. Click "CREATE CREDENTIALS" at the top of the page
3. Select "API key" from the dropdown
4. Your new API key will be displayed. Copy it to a secure location.

### 5. (Optional but Recommended) Restrict the API Key

1. In the credentials page, find your API key and click the edit icon (pencil)
2. Under "API restrictions," select "Restrict key"
3. Check "YouTube Data API v3" from the dropdown
4. Click "SAVE"

Now you have a YouTube API key ready to use with this application!

## 🚀 Installation

Follow these detailed steps to get the application running on your local machine:

### 1. Clone the repository

```bash
# Create a directory for the project
mkdir youtube-channel-tool
cd youtube-channel-tool

# Clone the repository
git clone https://github.com/vsvppsToolsByVishnu/yt-group-viewer .
```

### 2. Install dependencies

Since you're downloading the project without node_modules, you'll need to install all dependencies from scratch:

```bash
# Install Next.js and core dependencies
npm install next@latest react@latest react-dom@latest

# Install TypeScript and type definitions
npm install typescript @types/react @types/node @types/react-dom

# Install UI and styling libraries
npm install tailwindcss postcss autoprefixer
npm install framer-motion
npm install react-icons
npm install clsx class-variance-authority

# Install database libraries
npm install dexie dexie-react-hooks
npm install better-sqlite3
npm install sql.js

# Install utility libraries
npm install axios
npm install use-debounce
npm install uuid @types/uuid
```

Initialize Tailwind CSS:

```bash
# Initialize Tailwind CSS configuration
npx tailwindcss init -p
```

### 4. Build the application

```bash
# Using npx
npx next build
# OR using yarn
yarn build
```

### 5. Start the application

```bash
# Using npm
npx next start

# OR using yarn
yarn start
```

### 6. View the application

Open your browser and navigate to: [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

The application is organized using a modern Next.js App Router structure:

```
src/
├── app/                        # Main application code
│   ├── api/                    # API routes
│   │   ├── db/                 # Database API endpoints
│   │   │   └── route.ts        # Database operations handler
│   │   └── export/             # Export functionality
│   │       └── route.ts        # Export handler
│   ├── api-keys/               # API key management page
│   │   └── page.tsx            # API keys page component
│   ├── channels/               # Channel management
│   │   └── [groupId]/          # Dynamic route for group
│   │       └── page.tsx        # Channel management page
│   ├── components/             # Reusable components
│   │   ├── APIKeyErrorHelper.tsx
│   │   ├── APIKeyWarning.tsx
│   │   ├── ChannelSearch.tsx
│   │   ├── FilterBar.tsx
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── VideoCard.tsx
│   │   └── VideoGrid.tsx
│   ├── context/                # React context providers
│   │   ├── APIKeyContext.tsx   # API key management context
│   │   └── GroupContext.tsx    # Group management context 
│   ├── db/                     # Database utilities
│   │   ├── database.ts         # IndexedDB setup
│   │   ├── sqliteDB.ts         # SQLite operations
│   │   └── sqliteSetup.ts      # SQLite configuration
│   ├── services/               # Service utilities
│   │   ├── dbService.ts        # Database service
│   │   └── youtubeService.ts   # YouTube API service
│   ├── settings/               # Settings page
│   │   └── page.tsx            # Settings component
│   ├── types/                  # TypeScript type definitions
│   │   └── index.ts            # Types for the app
│   ├── favicon.ico             # Favicon
│   ├── globals.css             # Global CSS
│   ├── layout.tsx              # Root layout component
│   └── page.tsx                # Home page component
├── public/                     # Static assets
├── .env.local                  # Environment variables (create this)
├── next.config.js              # Next.js configuration
├── package.json                # Dependencies and scripts
├── postcss.config.js           # PostCSS configuration
├── tailwind.config.js          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```

## 💻 Development Mode

If you want to run the application in development mode with hot reloading for making changes:

### 1. Start the development server

```bash
# Using npm
npx next dev

# OR using yarn
yarn dev
```

### 2. View the application in development mode

Open your browser and navigate to: [http://localhost:3000](http://localhost:3000)

Any changes you make to the code will automatically reload the page.

### 3. API Development Environment

If you want to test different API endpoints:

```bash
# Create a .env.development.local file
touch .env.development.local

# Add your development YouTube API key
# NEXT_PUBLIC_YOUTUBE_API_KEY=your_development_api_key
```

### 4. Linting and Type Checking

```bash
# Install ESLint and related dependencies if not already included
npm install eslint eslint-config-next --save-dev

# Run linting
npx eslint .

# Run type checking
npx tsc --noEmit
```

### 5. Common Development Issues

#### SQLite3 Installation Issues

If you encounter SQLite3 installation problems:

```bash
# For Windows
npm install --global --production windows-build-tools
npm config set python python2.7
npm install better-sqlite3

# For Mac
brew install sqlite3
npm install better-sqlite3

# For Linux
sudo apt-get install sqlite3 libsqlite3-dev
npm install better-sqlite3
```

#### Next.js API Routes Not Working

Make sure your API routes are in the correct location:

```
src/
  app/
    api/
      db/
        route.ts
```

#### Environment Variables Not Loading

Verify your environment variables are correctly named and restart your development server:

```bash
# Stop the server (Ctrl+C)
# Then restart
npx next dev
```

## 🎮 Usage Guide

### Setting Up Your API Key

1. Navigate to the **API Keys** page
2. Click the "Add API Key" button
3. Enter a name and your YouTube Data API key
4. Click "Save"

### Creating a Group

1. Click the "+" button in the sidebar
2. Enter a name for your group
3. Click "Create"

### Adding Channels to a Group

1. Select a group from the sidebar
2. Click "Manage Channels"
3. Search for channels by name or paste a YouTube channel URL
4. Click "Add" button for each channel you want to add
5. Go back to the dashboard to see videos from all channels in the group

### Filtering and Sorting Videos

1. Use the filter dropdown to select time range:
   - Latest (24 hours)
   - Last 3 Days
   - Last 7 Days
   - All Videos
2. Use the sort dropdown to order by:
   - Upload Date (newest first)
   - View Count (highest first)

### Managing Your Groups

1. Hover over a group name in the sidebar
2. Click the edit icon to rename the group
3. Click the delete icon to remove the group (will not delete channels)

## 🚧 Troubleshooting

### API Key Issues

If you see an error message about API keys:

1. Make sure you have added at least one valid YouTube Data API key
2. Check that your API key has the YouTube Data API v3 enabled
3. Verify that you haven't exceeded your daily quota
4. Try adding a secondary API key for backup

### Videos Not Loading

1. Ensure the channels in your group have public videos
2. Check your internet connection
3. Try clearing the cache in the app settings
4. Refresh the page

### IndexedDB Issues

If you experience database-related issues:

1. Open your browser's developer tools (F12 or Ctrl+Shift+I)
2. Go to the Application tab
3. Under Storage, select IndexedDB
4. Check if databases are listed
5. You can delete the database to reset the application if needed

### Browser Compatibility

This application works best in modern browsers. If you encounter issues:

1. Update your browser to the latest version
2. Try a different browser (Chrome, Firefox, Edge)
3. Ensure JavaScript is enabled
4. Clear your browser cache and cookies

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Dexie.js](https://dexie.org/)
- [YouTube Data API](https://developers.google.com/youtube/v3)
