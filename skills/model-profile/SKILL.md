---
name: model-profile
description: Activate one of the saved global model profiles (OpenAI, OpenCode Go, Misto, Gratis) when the user asks to switch or set an OpenCode model profile.
---

# Activate an OpenCode model profile

Use this workflow only when the user explicitly asks to activate or switch to one of the saved profiles. Supported names are `OpenAI`, `OpenCode Go`, `Misto`, and `Gratis`.

1. Extract the requested profile name from the user's prompt. If no profile is named, ask which one to activate; do not guess.
2. Run `~/.config/opencode/model-setter/model-setter profiles list` and `... profiles show "NAME"` to confirm the profile exists and inspect its assignments.
3. Run `opencode models` and confirm every model ID in the requested profile, including `small_model`, is currently listed. If any is missing, stop without changing configuration and report the missing IDs. Also compare the currently configured `small_model` and agent models against that catalog: a stale value from before the change can raise `Model unavailable` in new sessions, and the profile itself is not at fault.
4. Activate the profile with `~/.config/opencode/model-setter/model-setter profiles apply "NAME"`. This writes a backup and updates the global agent assignments. Never invoke the generic `apply` or `rollback` commands as part of this workflow.
5. Confirm the apply output says `status: applied`, report the backup path, and verify the resulting profile using `profiles list`.
6. Explain that the current TUI session keeps its already-selected agent/model. Do not kill or forcibly restart the current client: doing so can interrupt this response and lose session work. The background server can be restarted with `opencode service restart`, but this alone does not switch the model already fixed on the current session. Tell the user to exit the TUI normally and launch `opencode` again to start a new session using the profile. Do not claim that restarting only the server changed the current session's model.

Never activate a profile not explicitly named by the user. If the profile is already active, report that and do not make a redundant change.
