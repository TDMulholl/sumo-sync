# Workflow

## Branches

- `main` always holds working code. No direct commits to `main`.
- New work goes on a branch named by type:
  - `feature/<short-name>` for new features
  - `fix/<short-name>` for bug fixes
  - `docs/<short-name>` for documentation only

## Commits

Short summary line in the present tense, with a type prefix:

```
feat: add move buttons to viewer script
fix: stop viewer clock showing NaN before video loads
docs: add install steps to README
```

## Pull requests

1. Push the branch and open a pull request into `main`.
2. Fill in the pull request template, including how the change was tested.
3. Review the changes, then use **Squash and merge**.
4. Delete the branch after merging.

## Versions

Each script has a `@version` line in its header. Raise it with every change
that reaches `main`:

- `0.1.0` to `0.1.1` for fixes
- `0.1.0` to `0.2.0` for new features

Add a line to `CHANGELOG.md` for each change. When a set of changes is ready,
tag the commit on `main` (for example `v0.2.0`) and create a GitHub release.

## Code style

- Keep code as simple as possible.
- Use plain, descriptive variable names. Avoid single letter names.
- Add plain English comments describing what the code does.
- Comments do not use pronouns and do not address the reader.
