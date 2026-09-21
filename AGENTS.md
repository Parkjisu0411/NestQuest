# NestQuest local credentials

- The user chose local key configuration embedded in a personal APK. Preserve this design; do not reintroduce mandatory on-device key entry.
- Never read, print, search, attach, or send the contents of `.env`, `.env.*` (except the blank `.env.example`), signing keystores, or key-bearing build artifacts (`dist/`, Android copied web assets, APK/AAB). Do not inspect process environment values. This is a working rule, not an OS access-control boundary.
- It is permitted to run the normal dev/build process to consume the local configuration and `npm run keys:check` to report presence only. Do not print credential values, substrings, hashes or request URLs containing them. The user enters actual keys locally, not in chat.
- Scope source searches to `src/`, `scripts/`, `docs/` and explicitly named non-secret config files. Exclude private env files and generated build assets from diffs or searches.
- Unit tests use synthetic credentials and responses. Temporary files created by tests with synthetic credentials are allowed; never use or print the user's real values for assertions.
- Keys are not part of user backups. Personal builds contain retrievable credentials and must not be described as secret-free. Share source and the blank template; other users build with their own keys.
