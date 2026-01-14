# Event Ticketing Platform

A modern event ticketing platform built with Next.js, Shadcn UI, and Supabase. Businesses can create profiles, manage events, and sell tickets through their custom-branded pages.

## Features

- **Business Profiles**: Create and manage business profiles with custom URLs
- **Event Management**: Create, edit, and manage events with ticket inventory
- **Ticket Sales**: Sell tickets and track customer information
- **Custom URLs**: Each business gets a unique customer-facing URL (e.g., `/your-business-name`)
- **Responsive Design**: Built with Shadcn UI components and Tailwind CSS
- **Real-time Updates**: Powered by Supabase for real-time data synchronization

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [Supabase](https://supabase.com/)
- **Language**: TypeScript

## Project Structure

```
├── app/
│   ├── dashboard/          # Business dashboard pages
│   ├── [businessSlug]/     # Customer-facing business pages
│   └── page.tsx            # Landing page
├── components/
│   ├── ui/                 # Shadcn UI components
│   ├── dashboard/          # Dashboard-specific components
│   └── public/             # Public-facing components
├── lib/
│   ├── supabase/           # Supabase client configuration
│   ├── types/              # TypeScript type definitions
│   ├── db/                 # Database query functions
│   └── utils.ts            # Utility functions
└── supabase-schema.sql     # Database schema definition
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account and project

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up Supabase:

   - Create a new project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Run the SQL schema from `supabase-schema.sql` in the Supabase SQL Editor

3. Configure environment variables:

   - Copy `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Database Setup

The database schema includes three main tables:

- **businesses**: Store business profiles and custom URLs
- **events**: Manage events with ticket inventory and pricing
- **tickets**: Track ticket sales and customer information

Run the `supabase-schema.sql` file in your Supabase SQL Editor to create all necessary tables, indexes, and Row Level Security (RLS) policies.

## Database Backups

This repo includes scripts to create/restore Postgres dumps (no secrets are committed).

1. In Supabase, copy your Postgres connection string from **Project Settings → Database → Connection string**.
2. Export it locally and run the backup script:

```bash
export SUPABASE_DB_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres"
./scripts/db-backup.sh --public-only
```

Backups are written to `backups/` (gitignored). To restore a dump:

```bash
export SUPABASE_DB_URL="postgresql://..."
./scripts/db-restore.sh --file backups/venuestack_public_full_YYYYmmdd_HHMMSS.dump
```

## Key Features to Implement

### Dashboard
- Business profile creation and editing
- Event CRUD operations
- Ticket management and tracking
- Analytics and reporting

### Public Pages
- Dynamic business pages at `/[businessSlug]`
- Event listing and details
- Ticket purchase flow
- Customer information collection

## Development Roadmap

- [ ] Implement business profile CRUD
- [ ] Add event management functionality
- [ ] Create ticket purchase flow
- [ ] Add authentication and user management
- [ ] Implement payment processing
- [ ] Add email notifications
- [ ] Create admin analytics dashboard
- [ ] Add search and filtering
- [ ] Implement QR code ticket generation
- [ ] Add ticket validation system

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Contributing

This is a new project! Contributions and suggestions are welcome.

## License

MIT
