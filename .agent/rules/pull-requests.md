# Git Workflow & Pull Request Rule

## Rule: Always Create a Branch & Pull Request For Every Push
1. **Never commit directly to `main`**:
   - Every feature, fix, or update must be developed on a dedicated git branch (`feat/<name>`, `fix/<name>`, `task/<ticket-number>-<name>`).
2. **Push to Origin Branch**:
   - Push the topic branch to `origin`:
     ```bash
     git push -u origin <branch-name>
     ```
3. **Open a Pull Request**:
   - Immediately create a Pull Request against `main` using GitHub CLI:
     ```bash
     gh pr create --base main --head <branch-name> --title "..." --body "..."
     ```
   - Reference the ticket/issue number (e.g. `Resolves #...`).
   - Summarize the objective, key changes, and verification steps.
