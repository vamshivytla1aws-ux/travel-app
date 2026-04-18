# SQL migrations

Place ordered `.sql` files here (from GitHub or authored locally). They are applied **once**, in **lexical order** (use prefixes like `001_`, `002_`).

## Apply to PostgreSQL

1. Set database connection in `.env` (see `/.env.example`): `DATABASE_URL` **or** `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGPORT`.

2. Run:

   ```bash
   npm run db:migrate
   ```

3. **Railway:** open your Postgres plugin → copy **connection URL** (or variables). Either:
   - `railway run npm run db:migrate` from your machine with Railway CLI linked, or  
   - Add the same vars locally and run `npm run db:migrate` against the Railway DB URL.

## Baseline schema

For a **new** database, either:

- Run `schema.sql` once (e.g. `psql $DATABASE_URL -f schema.sql`), then use this folder only for **later** changes, or  
- Put your full baseline in `001_baseline.sql` here and run `db:migrate` (do not duplicate with `schema.sql` unless you intend to).

Applied filenames are stored in table **`schema_migrations`**.
