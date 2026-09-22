# TaskMaster Pro

A task and project management web application focused on offline-first UX, drag-and-drop workflows, analytics and a feature-oriented React architecture.

## Highlights

- Project and task management
- Drag-and-drop task boards
- Analytics and data visualization
- Offline-first storage with synchronization
- Authentication and user settings
- Dark/light themes
- Web Push notifications
- Automated tests and code-quality tooling

## Tech stack

- React 18 + TypeScript
- Redux Toolkit + React Router
- Tailwind CSS
- React DnD + Framer Motion
- Recharts
- Dexie / IndexedDB
- Vite
- Vitest + React Testing Library
- ESLint + Prettier + Husky

## Getting started

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Tests:

```bash
npm test
```

## Architecture

The codebase is organized around application features and domains rather than only technical layers. Shared UI, hooks, services, storage and state-management utilities are separated from feature-specific code.

## Status

Active portfolio project / work in progress.

## License

MIT
