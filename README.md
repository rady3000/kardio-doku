# Kardio-Doku

Clinical documentation for cardiology investigations. Prototype for in-house
evaluation; not CE-marked. See `CLAUDE.md` for the rules, `PLAN.md` for the
build plan and `spec/` for the specifications.

## Install (Windows)

Download the installer from the latest successful **Windows build** run on
GitHub (artifact `Kardio-Doku-Setup`) and run it.

## Development

```
npm ci              # install dependencies
npm run typecheck   # TypeScript check
npm test            # unit tests (Vitest)
npm run test:e2e    # end-to-end test in the real app window (Playwright)
npm start           # build and start the app
npm run dist        # build the Windows installer into release/
```

Data lives in the user profile (`%APPDATA%\Kardio-Doku\data\test.db` and
`live.db`). No real patient documents in this repository.
