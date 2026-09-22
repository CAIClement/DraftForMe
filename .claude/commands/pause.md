---
description: Checkpoint the current work into .claude/work/current.md before stopping.
---

Write (overwrite) `.claude/work/current.md` with the current branch's state, in the format the file's comment shows:

```
## <branch name>
Started: <date work started, best guess from git log if unknown>
Spec: <path, if any>
Plan: <path, if any>

- What's done
- What's next
- Anything blocking
```

If there's genuinely nothing in progress (clean tree, on `main`), write back the empty "Nothing in progress." state instead of inventing content. This is what `/point` reads next time and what the session-start hook surfaces automatically.
