# Manager Dashboard

Manager Dashboard is a modern, collaborative web application for managing clients, bots, and team activities. Built with React, Vite, TypeScript, and Tailwind CSS, it features real-time collaboration, bot management, voice input/output, and integration with Supabase for backend and storage.

## Features

- **Bot Management**: Create, edit, delete, and manage bots for different clients. Attach scripts, audio, and manage bot status (active, paused, stopped).
- **Voice Features**: Use browser-based speech recognition for voice input and text-to-speech for bot scripts. No API keys or paid services required.
- **Audio Upload**: Upload and attach audio files to bots, with storage handled by Supabase.
- **Client Management**: Organize bots and activities by client.
- **Team Collaboration**: (Planned/Optional) Real-time collaboration features for teams.
- **Modern UI**: Built with Tailwind CSS and a component-based architecture for a responsive, user-friendly experience.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend/Storage**: Supabase
- **UI Components**: Custom and third-party React components

## Getting Started

1. **Install dependencies**
   ```sh
   npm install
   ```
2. **Start the development server**
   ```sh
   npm run dev
   ```
3. **Configure Supabase**
   - Update the Supabase credentials in `src/integrations/supabase/` as needed.

## Folder Structure

- `src/components/` — UI and feature components (BotManagement, FileManager, KanbanBoard, etc.)
- `src/pages/` — Main app pages
- `src/context/` — React context for state management
- `src/hooks/` — Custom React hooks
- `src/lib/` — Utility functions
- `supabase/` — Supabase configuration and SQL scripts

## Requirements
- Node.js 16+
- npm
- Supabase account (for backend and storage)

## License
MIT

---
For more details, see the code and comments in each component.
