# Workspace Rules

- Use PowerShell-compatible commands in this repository. Prefer `rg` for searching files or contents; fall back to `Select-String` or `Get-ChildItem` when needed.
- Do not run Unix-only command forms such as `grep`, `awk`, `sed`, `chmod`, `chown`, `export VAR=value`, or `rm -rf` directly in PowerShell. Translate them to PowerShell or cross-platform equivalents.
- Do not perform Git or GitHub write actions unless the user explicitly asks for them. Inspection commands such as `git status`, `git diff`, `git log`, `git show`, and `gh pr view` are allowed.
- Do not stage, commit, push, pull, merge, rebase, reset, tag, or modify GitHub issues, pull requests, secrets, releases, or project boards without explicit user approval.
- Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
