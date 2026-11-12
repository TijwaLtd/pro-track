Agreed on all four points. Here's what changes, then the updated files.

## What changes

**Screens.** Still three main screens. These system screens were missing, and they are now specified:
1. **Splash**
2. **Lock**, which uses the phone's own security (password, PIN or pattern; fingerprint or face too if the phone has it enrolled). There is no separate app PIN.
3. **Lock required**, shown if the phone has no screen lock set, because the app refuses to open without one.
4. **Chat form**, one reusable screen for creating projects, items and payments.
5. **Avatar picker**, shared by the chat form and edit.
6. **Evidence viewer**
7. **Settings sheet**, which now has no PIN options.
8. **Edit sheets**, which are compact flat forms. Chat is for creating, and flat forms are faster for fixing a typo.

**Forms.** Scripted chat, with no AI and no network. One question at a time. The app asks on the left, your answer appears on the right, and the input area below changes to fit each question (text, colour swatches, date chips, keypad, avatar grid, attach buttons). You can tap any earlier answer to change it, and the flow ends with a summary card to confirm.

**Item avatars.** Each item gets an animal or plant picture (`avatar_key`). Projects keep their colour. The avatar sits on a soft tint of the project colour, so items stay recognisable and still look coloured.

**Payments.** No parser. You paste the message and it is stored as-is. Amount and date are typed or picked by you. Duplicate warnings use an exact match on the pasted text, so they still work without a parser.

## AGENTS.md changes

Replace these items in the Hard rules and Stack sections:

```markdown
## Stack changes
- REMOVE app PIN, numpad and PIN hashing. Do NOT store any PIN.
- Lock uses expo-local-authentication with device credential fallback: password/PIN/pattern, plus biometrics if the phone has them enrolled.
- ADD expo-screen-capture (block screenshots/recents preview on the lock-protected screens).
- Forms are scripted chat flows from /design/chat-forms.json, rendered by one `ChatForm` component. No LLM, no network.
- Avatars are bundled SVG assets listed in /design/avatars.json.

## Hard rules changes
- App access requires phone security. On launch and after relock, call getEnrolledLevelAsync(). If SecurityLevel.NONE, show the "lock required" screen and nothing else. Never offer a bypass or a custom PIN.
- Authenticate with authenticateAsync({ disableDeviceFallback: false }) so the phone's password/pattern is accepted. Test on the lowest supported Android version.
- Be honest in docs/UI: the lock gates the UI; it does not encrypt the database.
- No M-Pesa parsing in v1. Store pasted text verbatim in payments.raw_confirmation_text. Do not add parser code or tests; the column and `mpesaParser.ts` stay out of the repo until requested.
- Create flows use ChatForm; edit flows use flat edit sheets.
```

## projects.md changes

Replace sections 3 and 4 and the sample acceptance criteria with these:

```markdown
## 3. Scope changes (v1)
- Access: phone security only (password, PIN, pattern, or enrolled biometrics). Refuse to run if the phone has no screen lock.
- Creating a project, item or payment happens through a friendly step-by-step chat form.
- Items have an animal or plant avatar chosen by the user.
- Payments: paste the message as-is. No parsing. Amount, date and method are chosen by the user.

## 4. Screens
Main: Home, Project Detail, Project Item.
System: Splash, Lock, Lock Required, Chat Form, Avatar Picker, Evidence Viewer, Settings sheet, Edit sheets.

## 6. Acceptance criteria changes
- App cannot be opened without passing the phone's own lock; if the phone has no lock set, only the "lock required" screen shows.
- Creating an item takes at most 6 short steps and the user can change any earlier answer.
- Pasting a message stores it unchanged; pasting the same text twice shows a duplicate warning but allows saving.
- Every item shows its avatar on Home hero, project list rows and item screen.

## 7. Roadmap changes
- Phase 0: scaffold, tokens, DB, avatars asset pipeline.
- Phase 1a: splash, lock, lock-required.
- Phase 1b: ChatForm component + newProject flow, then Home.
- Phase 1c: newItem flow + Project Detail.
- Phase 1d: newPayment flow + evidence + Project Item + mark done.
- Phase 2: reminders, settings, edit sheets.
- Phase 3: export, then Drive backup.
- Later: M-Pesa parser (not in v1).
```

## DATABASE.md amendments

Replace my earlier amendments block with this:

```markdown
## Amendments (v1 decisions)
- projects: ADD `color_key TEXT NOT NULL DEFAULT 'coral'`.
- project_items: ADD `avatar_key TEXT NOT NULL` (key from avatars.json; default picked at random when creating).
  REPLACE `due_at` with `due_date TEXT` (YYYY-MM-DD, floating local) and `due_time TEXT` (HH:mm, nullable).
  Indexes: (project_id, due_date), due_date, (completion_status, due_date).
  `priority` stays in the schema, default 'normal', not shown in v1 UI.
- payments: `transaction_reference` and `counterparty` stay nullable and unused by the v1 UI (reserved for a future parser).
  `raw_confirmation_text` holds the pasted message verbatim.
  Duplicate check: warn when another recorded payment has identical text after trimming and collapsing whitespace. Never block.
- payment_evidence: v1 stores images/pdf/files only. Do not create `pasted_text` evidence rows.
- reminders: `project_item_id` NOT NULL; no project-level reminders in v1.
- Money: minor units (1/100), including KES. UI hides ".00".
- settings: remove any PIN-related keys. Keep lockTimeout, weekStart, defaultReminder.
- Remove the duplicate PROJECTS ||--o{ PROJECT_ITEMS line in the ER diagram.
```

## design/design.json (merge these keys)

```json
{
  "colors": {
    "bubbleApp": "#F1F1F4",
    "bubbleAppText": "#111114",
    "bubbleUserText": "#FFFFFF",
    "splashBackground": "#FF6B6B"
  },
  "components": {
    "chatBubble": {
      "app":  { "bg": "bubbleApp", "text": "bubbleAppText", "radius": { "tl": 6, "tr": 20, "br": 20, "bl": 20 }, "maxWidth": "82%", "typography": "body" },
      "user": { "bg": "activeAccent", "text": "bubbleUserText", "radius": { "tl": 20, "tr": 6, "br": 20, "bl": 20 }, "maxWidth": "82%", "typography": "body", "activeAccentRule": "accent by default; switches to the chosen project colour once a colour is picked" },
      "typing": { "dots": 3, "size": 6, "color": "textTertiary", "durationMs": 450 }
    },
    "quickChip": { "height": 44, "paddingH": 16, "radius": "pill", "bg": "surface", "border": "border", "selected": { "bg": "textPrimary", "text": "#FFFFFF" }, "typography": "label" },
    "avatarTile": { "size": 64, "radius": "lg", "bg": "projectSoftTint", "selected": { "ring": 3, "ringColor": "textPrimary" }, "a11yLabel": "{label}" },
    "avatarBadge": { "sizes": { "list": 48, "hero": 120, "detail": 160 }, "radius": "lg", "bg": "projectSoftTint", "completed": { "saturation": 0.4, "checkBadge": true } }
  },
  "motion": {
    "chat": { "bubbleIn": "slide-up 12px + fade, 220ms", "inputDockSwap": "cross-fade 160ms", "reduceMotion": "no slide, instant" }
  }
}
```

## design/avatars.json (new)

```json
{
  "description": "Animal and plant avatars for project items. Flat vector illustrations, one consistent style, transparent background, no text, bundled locally.",
  "assets": {
    "folder": "assets/avatars/",
    "format": "svg",
    "viewBox": "0 0 512 512",
    "style": "flat shapes, 2-3 colours each, no outlines, centered with 12% padding",
    "licenseNote": "Use a properly licensed or self-made set; record the license in assets/avatars/LICENSE.md",
    "phase0Fallback": "render the emoji below until SVGs are added"
  },
  "render": {
    "container": "avatarBadge on projectSoftTint of the item's project colour",
    "accessibilityLabel": "{label} avatar"
  },
  "groups": [
    {
      "id": "animals",
      "label": "Animals",
      "items": [
        { "key": "lion", "label": "Lion", "emoji": "🦁" },
        { "key": "elephant", "label": "Elephant", "emoji": "🐘" },
        { "key": "giraffe", "label": "Giraffe", "emoji": "🦒" },
        { "key": "zebra", "label": "Zebra", "emoji": "🦓" },
        { "key": "rhino", "label": "Rhino", "emoji": "🦏" },
        { "key": "flamingo", "label": "Flamingo", "emoji": "🦩" },
        { "key": "hippo", "label": "Hippo", "emoji": "🦛" },
        { "key": "cheetah", "label": "Cheetah", "emoji": "🐆" },
        { "key": "tortoise", "label": "Tortoise", "emoji": "🐢" },
        { "key": "owl", "label": "Owl", "emoji": "🦉" },
        { "key": "fox", "label": "Fox", "emoji": "🦊" },
        { "key": "bee", "label": "Bee", "emoji": "🐝" }
      ]
    },
    {
      "id": "plants",
      "label": "Plants",
      "items": [
        { "key": "acacia", "label": "Acacia", "emoji": "🌳" },
        { "key": "baobab", "label": "Baobab", "emoji": "🌴" },
        { "key": "aloe", "label": "Aloe", "emoji": "🪴" },
        { "key": "cactus", "label": "Cactus", "emoji": "🌵" },
        { "key": "sunflower", "label": "Sunflower", "emoji": "🌻" },
        { "key": "tulip", "label": "Tulip", "emoji": "🌷" },
        { "key": "lotus", "label": "Lotus", "emoji": "🪷" },
        { "key": "bamboo", "label": "Bamboo", "emoji": "🎋" },
        { "key": "fern", "label": "Fern", "emoji": "🌿" },
        { "key": "clover", "label": "Clover", "emoji": "🍀" },
        { "key": "mushroom", "label": "Mushroom", "emoji": "🍄" },
        { "key": "seedling", "label": "Seedling", "emoji": "🌱" }
      ]
    }
  ],
  "defaultRule": "on new item pick a random avatar not already used in that project (fallback: any); user can Shuffle or choose",
  "pickerSheet": {
    "name": "avatarPicker",
    "snapPoints": ["60%"],
    "header": { "title": "Pick a buddy", "right": { "type": "iconButton", "icon": "shuffle", "a11yLabel": "Shuffle" } },
    "tabs": ["Animals", "Plants"],
    "grid": { "columns": 4, "gap": 12, "tile": "avatarTile" },
    "onSelect": "return avatar_key to caller and close (chat form continues; edit saves immediately)"
  }
}
```

## design/chat-forms.json (new)

```json
{
  "component": "ChatForm",
  "usedFor": ["newProject", "newItem", "newPayment"],
  "notAIPowered": true,
  "presentation": "full-screen modal, slides up",
  "layout": {
    "header": { "left": { "type": "iconButton", "icon": "x", "a11yLabel": "Close", "onPress": "if any answer given: confirm 'Discard this?' else close" }, "center": { "type": "text", "value": "{flow title}", "typography": "label" }, "right": { "type": "iconButton", "icon": "undo", "a11yLabel": "Back one step", "visibleIf": "step > 1" } },
    "messages": { "type": "scroll", "padding": "xl", "gap": "md", "autoScrollToLatest": true, "background": "colors.background" },
    "inputDock": { "type": "keyboard-aware bottom area", "bg": "surface", "radiusTop": "xl", "padding": "lg", "swapsPerStep": true, "elevation": "floating" }
  },
  "rules": [
    "One question per turn, short, friendly, lowercase-leaning, no jargon",
    "Show typing dots ~450ms before each app message (skip when reduce motion is on)",
    "User answer appears as a right-aligned bubble; selecting an avatar or colour shows it as a small visual bubble",
    "Tap any earlier answer bubble to change it; the flow rewinds to that step and keeps later answers that are still valid",
    "Optional steps always show a 'Skip' quick chip",
    "Never ask for something that can be defaulted",
    "Final step is a summary card inside the chat with Confirm button and 'Change something' chip",
    "Draft answers are held in memory only; closing discards them",
    "Haptic light on each answer; success haptic on confirm"
  ],
  "inputTypes": {
    "text": { "dock": "single-line input + send button", "validation": "required unless step.optional" },
    "multiline": { "dock": "multiline input + send button" },
    "colorSwatch": { "dock": "wrap grid of swatchPicker over projectPalette", "liveEffect": "user bubble colour and a mini hero preview update instantly" },
    "avatar": { "dock": "opens inline avatar grid (Animals | Plants tabs) with Shuffle", "source": "design/avatars.json" },
    "chips": { "dock": "row/wrap of quickChip", "single": true },
    "date": { "dock": "quickChips + 'Pick date' opening native date picker" },
    "time": { "dock": "quickChips + 'Pick time' opening native time picker" },
    "money": { "dock": "large amount display with currency + numeric keypad (0-9, ., backspace) + optional quick chips", "storage": "convert to minor units; no floats" },
    "paste": { "dock": "large multiline box + 'Paste from clipboard' button + Skip chip + send", "note": "stores text verbatim, no parsing" },
    "attach": { "dock": "three buttons: Photo, Camera, File + Skip chip + Done once items added", "preview": "thumbnails in a bubble", "multiple": true }
  },
  "flows": {
    "newProject": {
      "title": "New project",
      "steps": [
        { "id": "intro", "app": "hi! let's start a new project.", "type": "none", "auto": true },
        { "id": "name", "app": "what should we call it?", "type": "text", "field": "name", "maxLength": 80, "required": true },
        { "id": "color", "app": "pick a colour for {name}.", "type": "colorSwatch", "field": "color_key", "default": "coral" },
        { "id": "end", "app": "when should it wrap up?", "type": "date", "field": "target_end_date", "chips": ["No date", "End of this month", "Pick a date"], "optional": true },
        { "id": "summary", "app": "all set? here's your project.", "type": "summaryCard", "card": "mini hero in chosen colour with name and target date", "confirm": "Create project", "onConfirm": "insert project + activity log; close; open Project Detail; toast 'project created'" }
      ],
      "firstRun": "intro text becomes 'hi! let's set up your first project.'"
    },
    "newItem": {
      "title": "New item",
      "steps": [
        { "id": "title", "app": "what needs doing?", "type": "text", "field": "title", "maxLength": 120, "required": true },
        { "id": "avatar", "app": "pick a buddy for it.", "type": "avatar", "field": "avatar_key", "default": "random per avatars.json" },
        { "id": "due", "app": "when is it due?", "type": "date", "field": "due_date", "chips": ["Today", "Tomorrow", "This week", "Pick a date", "No date"] },
        { "id": "time", "app": "any specific time?", "type": "time", "field": "due_time", "chips": ["All day", "Morning", "Afternoon", "Pick a time"], "visibleIf": "due_date set", "optional": true },
        { "id": "cost", "app": "does it cost anything?", "type": "chips", "chips": ["No", "Yes"], "field": "has_cost" },
        { "id": "amount", "app": "how much?", "type": "money", "field": "expected_amount", "currency": "project.currency_code", "visibleIf": "has_cost == Yes", "required": true },
        { "id": "reminder", "app": "want a nudge?", "type": "chips", "chips": ["Yes, as usual", "1 hour before", "1 day before", "No thanks"], "field": "reminder", "visibleIf": "due_date set" },
        { "id": "notes", "app": "anything to remember?", "type": "multiline", "field": "description", "optional": true },
        { "id": "summary", "app": "looks good? here's the item.", "type": "summaryCard", "card": "avatar on project tint, title, due, cost", "confirm": "Add item", "onConfirm": "transaction: insert item + activity log + schedule reminder; close; toast 'added'" }
      ],
      "maxQuestionsShown": 6,
      "note": "Conditional steps are skipped, so a simple item is title, buddy, due, cost, nudge."
    },
    "newPayment": {
      "title": "Record payment",
      "steps": [
        { "id": "amount", "app": "how much did you pay?", "type": "money", "field": "amount", "currency": "item.currency_code", "chips": ["Balance {outstanding}"], "chipsVisibleIf": "outstanding > 0", "required": true, "warnIf": "amount > outstanding: 'that's {x} over what's owed, ok?' (allowed)" },
        { "id": "method", "app": "how did you pay?", "type": "chips", "chips": ["M-Pesa", "Cash", "Bank", "Card", "Other"], "field": "method", "default": "M-Pesa" },
        { "id": "message", "app": "paste the M-Pesa message here.", "type": "paste", "field": "raw_confirmation_text", "visibleIf": "method in [M-Pesa, Bank]", "optional": true, "storage": "verbatim, no parsing", "duplicateWarning": "if identical text (trimmed, whitespace collapsed) exists on another recorded payment: 'looks like you've pasted this one before. save anyway?'" },
        { "id": "when", "app": "when was that?", "type": "date", "field": "paid_at", "chips": ["Just now", "Earlier today", "Yesterday", "Pick date & time"] },
        { "id": "evidence", "app": "got a screenshot or receipt?", "type": "attach", "field": "evidence", "optional": true, "storage": "copy to app-private evidence/<paymentId>/, record sha256, mime, size" },
        { "id": "notes", "app": "any note?", "type": "text", "field": "notes", "optional": true },
        { "id": "summary", "app": "ready? here's the payment.", "type": "summaryCard", "card": "amount, method, date, message preview (2 lines), evidence thumbs, new balance", "confirm": "Save payment", "onConfirm": "single transaction: payment + evidence rows + activity log; copy files before commit and clean up on failure; toast 'payment saved'" }
      ]
    }
  },
  "editMode": "Edit actions open compact flat sheets with all fields on one page; ChatForm is only for creating.",
  "a11y": { "liveRegion": "announce each new app message", "inputFocus": "focus moves to the dock input on each step", "keyboardOrder": "chips and buttons reachable in order" }
}
```

## design/entry.json (replace the whole file)

```json
{
  "screens": {
    "splash": {
      "route": "app/_layout.tsx (initial gate)",
      "background": "colors.splashBackground",
      "layout": "centered column",
      "elements": [
        { "type": "logoMark", "size": 96, "style": "white rounded square with coral flag/check glyph" },
        { "type": "text", "value": "ProTrack", "typography": "title", "color": "#FFFFFF", "style": "lowercase bold" },
        { "type": "text", "value": "keep your projects close", "typography": "caption", "color": "rgba(255,255,255,0.8)", "transform": "none" }
      ],
      "behavior": {
        "minDurationMs": 800,
        "tasks": ["open DB", "run migrations", "verify foreign keys + integrity", "load settings"],
        "then": "go to lock",
        "onFailure": "show 'Something went wrong' card with Retry and 'Export what I have'; never wipe data automatically"
      },
      "animation": "logo scales 0.9 to 1 with fade (base), tagline fades in 150ms later; reduce motion: static",
      "statusBar": "light"
    },
    "lock": {
      "background": "colors.background",
      "elements": [
        { "type": "logoMark", "size": 64 },
        { "type": "text", "value": "welcome back", "typography": "title" },
        { "type": "text", "value": "unlock with your phone's security", "typography": "body", "color": "textSecondary" },
        { "type": "button", "variant": "primary", "label": "UNLOCK", "action": "authenticate" }
      ],
      "behavior": {
        "onMount": "check getEnrolledLevelAsync(); if NONE go to lockRequired; else call authenticate automatically",
        "authenticate": "LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock ProTrack', disableDeviceFallback: false })",
        "accepts": "phone password, PIN or pattern; biometrics if enrolled on the phone",
        "onSuccess": "go to home (or deep link target if opened from a notification)",
        "onCancelOrFail": "stay on lock; show 'Not unlocked' and keep the UNLOCK button; no custom PIN, no bypass",
        "relock": "when app is backgrounded longer than settings.lockTimeout (default 30s; options Immediately, 30s, 1 min, 5 min)",
        "privacy": ["block screenshots and the recents preview with expo-screen-capture on all screens", "no data is rendered on the lock screen"]
      },
      "states": ["idle", "prompting", "failed (message + retry)"],
      "a11y": "UNLOCK button labelled; prompt text is system-provided"
    },
    "lockRequired": {
      "background": "colors.background",
      "elements": [
        { "type": "illustration", "value": "padlock in coral on soft tint", "size": 120 },
        { "type": "text", "value": "set a phone lock first", "typography": "title" },
        { "type": "text", "value": "ProTrack keeps payment records, so it only opens on phones protected by a password, PIN or pattern.", "typography": "body", "color": "textSecondary", "align": "center" },
        { "type": "button", "variant": "primary", "label": "OPEN PHONE SETTINGS", "action": "Linking.openSettings()" },
        { "type": "button", "variant": "secondary", "label": "I've set it, check again", "action": "re-run getEnrolledLevelAsync()" }
      ],
      "behavior": "re-check automatically on AppState active; when a lock is found, continue to lock screen. No other navigation is possible."
    }
  }
}
```

## design/sheets.json (new)

```json
{
  "sheets": {
    "settings": {
      "title": "Settings",
      "snapPoints": ["60%"],
      "items": [
        { "label": "Lock after", "type": "select", "options": ["Immediately", "30 seconds", "1 minute", "5 minutes"], "default": "30 seconds" },
        { "label": "Week starts on", "type": "segmented", "options": ["Mon", "Sun"], "default": "Mon" },
        { "label": "Default reminder", "type": "select", "options": ["At due time", "1 hour before", "1 day before"], "default": "1 hour before" },
        { "label": "Export backup", "type": "action", "note": "Creates a zip of data and evidence you can save or share" },
        { "label": "About", "type": "info", "value": "version and schema version" }
      ],
      "removed": ["Change PIN"]
    },
    "evidenceViewer": {
      "presentation": "full-screen modal, dark background",
      "header": { "left": "close", "center": "{n} of {total}", "right": "share" },
      "image": "pinch-zoom, double-tap zoom",
      "pdf": "open with system viewer",
      "missingFile": "centered 'File missing' message with what is known (name, date); no crash",
      "footer": { "meta": "filename · size · added {date}", "action": "Remove evidence (confirm; logs the action; warns if the payment would have none left)" }
    },
    "avatarPicker": { "spec": "design/avatars.json#pickerSheet" },
    "editProject": {
      "title": "Edit project",
      "fields": ["name", "colour (swatches)", "description", "start date", "target end", "status"],
      "actions": { "primary": "Save", "secondary": "Cancel" }
    },
    "editItem": {
      "title": "Edit item",
      "fields": ["title", "avatar (opens avatarPicker)", "due date", "time", "cost", "reminder", "notes", "priority"],
      "warnings": ["changing cost on an item with payments shows the new balance before saving"],
      "actions": { "primary": "Save", "secondary": "Cancel" }
    },
    "editPayment": {
      "title": "Edit payment",
      "fields": ["amount", "method", "date", "message (verbatim)", "reference (optional)", "notes"],
      "note": "edits are logged in activity_logs; voiding is a separate action with a required reason"
    }
  }
}
```

## Patches to the three screen files

**design/home.json**

Replace `heroCard.slide.content.centre` with the avatar and title together:

```json
"centre": {
  "type": "column-center",
  "children": [
    { "type": "avatarBadge", "size": 120, "source": "item.avatar_key", "bg": "rgba(255,255,255,0.22)" },
    { "type": "text", "value": "{item.title}", "typography": "title", "align": "center", "color": "onColor", "maxLines": 2 }
  ]
}
```

Make these edits too:

- Set `heroCard.card.height` to 280.
- In `projectList.row.thumbnail`, keep the project colour tile. It represents the project, so it takes no avatar.
- Replace `emptyState.action` with `{ "label": "Start my first project", "opens": "chatForm:newProject" }`, and use the same for `emptyHero.action`.
- Delete the whole `sheets.newProjectSheet` block, and change `bottomBar.items[1].action` to `"openChatForm:newProject"`.
- Delete `sheets.settingsSheet` and use `sheets.json#settings`.

**design/project-detail.json**

Replace `sections[itemList].row.leading` and `swipe`:

```json
"leading": {
  "type": "avatarBadge",
  "size": 48,
  "source": "item.avatar_key",
  "bg": "projectSoftTint",
  "completedStyle": "desaturated with small check badge"
},
"swipe": { "right": "Mark done / Reopen", "left": "Archive item (confirm)" },
"quickToggleRules": [
  "Swipe-right completes through the same prompt as the item screen when a balance is outstanding"
]
```

Make these edits too:

- Delete `sheets.addItemSheet`. Change `fab.action` to `"openChatForm:newItem"`, and make the empty-state action the same.
- Add `"openEditItem"` to the row long-press menu, which uses `sheets.json#editItem`.

**design/project-item.json**

Replace `hero`:

```json
"hero": {
  "height": 240,
  "background": "project.color",
  "art": "decorativeArt large, behind avatar",
  "radiusBottom": "xl",
  "avatar": { "type": "avatarBadge", "size": 160, "source": "item.avatar_key", "position": "center", "onPress": "open avatarPicker (saves immediately)", "a11yLabel": "Change avatar" },
  "overlay": [
    { "type": "iconButton", "icon": "arrow-left", "position": "top-left", "a11yLabel": "Back" },
    { "type": "iconButton", "icon": "more-horizontal", "position": "top-right", "menu": ["Edit item", "Cancel item", "Archive item"] }
  ],
  "chip": { "text": "{project.name}", "position": "bottom-left", "bg": "rgba(255,255,255,0.25)", "color": "onColor" }
}
```

In `paymentsSection`:

- Change the header action to `"openChatForm:newPayment"`.
- Replace `paymentCard.middle` with this:

```json
"middle": [
  { "type": "text", "value": "{paid_at formatted}", "typography": "caption", "color": "textSecondary" }
],
"message": {
  "type": "collapsibleText",
  "title": "M-Pesa message",
  "value": "{raw_confirmation_text}",
  "collapsedLines": 2,
  "actions": ["Copy"],
  "visibleIf": "raw_confirmation_text"
}
```

- Replace `duplicateWarning` with `"duplicateWarning": "chip 'Same message as another payment' when raw text matches another recorded payment"`.
- In `evidence`, change item tiles to image and file only (no pasted-text tiles), and set `onPress` to `sheets.json#evidenceViewer`.

Make these edits too:

- Delete `sheets.addPaymentSheet`. Keep `sheets.voidPaymentSheet`.
- Change the `Edit` menu action on payment cards to `sheets.json#editPayment`.
- In the "Add payment" prompt from `onPressOpen`, set `opens` to `"chatForm:newPayment"`.

## Next step in Claude Code

Start with this: *"Read AGENTS.md, projects.md, DATABASE.md and everything in /design. Implement Phase 0 and Phase 1a (splash, lock, lock-required). Stop and summarise before starting the ChatForm."*

I'd build the splash and lock first and test them on your actual phone with each lock type (pattern, PIN, password). That confirms the gate behaves the way you expect before anything else sits behind it.