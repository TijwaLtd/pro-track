# PROJECT.md — Personal Project Control Centre

## 1. Product summary

A private, local-first mobile application for one person to register projects, organize milestones/items, track upcoming deadlines, record costs and partial payments, retain M-Pesa messages/receipts as payment evidence, and mark work complete.

The app should feel like a personal project schedule and bookkeeping record—not a team project-management suite.

## 2. Product principles

1. Local-first and offline-capable.
2. Minimalist, visual design faithfully based on the supplied event-app reference screenshots.
3. Exactly three primary application screens.
4. One coherent reusable form system for all create/edit workflows.
5. Reliable financial records and retained payment evidence.
6. Clear separation between payment and completion.
7. Easy export/backup, with Google Drive as a future extension.

## 3. Scope and platform

- Initial target: Android.
- Architecture should remain portable to iOS where practical.
- Preferred implementation: React Native, Expo, TypeScript, SQLite.
- No server or cloud dependency in the initial release.
- Default currency: KES. Store currency code explicitly to allow future multi-currency support.

## 4. Information architecture: exactly three primary screens

### 4.1 Home

Purpose: answer “What needs my attention?”

Visual composition, following the first reference screenshot:
- Soft neutral app canvas and prominent white rounded main surface.
- Compact header with app title/date and restrained utility actions.
- Horizontal date selector.
- Large featured card for the most relevant upcoming project item.
- Featured card may show project name, item title, due date/urgency, cost and payment state when relevant.
- Below the featured card: project list with project name, progress and concise status.
- Clear coral “Add Project” action.
- Compact financial snapshot may show planned/paid/outstanding totals, but must not dominate the page.
- Empty state when no projects or upcoming items exist.

Featured-item priority:
1. Overdue open items.
2. Open items due today.
3. Next upcoming open item.
4. If none exist, show a useful no-upcoming state and optionally the next scheduled future item.

Date selector:
- Selecting a date filters/highlights items due on that date.
- The selected date must be visually obvious but restrained.
- Do not imply that an item is due on the selected date if it is not.

Project list:
- Each project opens Project Details.
- Show progress based on completed items / applicable total items, with clearly defined treatment for archived/cancelled items.
- Project creation uses the shared ProjectForm.

### 4.2 Project Details

Purpose: answer “What needs to happen in this project?”

Visual composition, following the second reference screenshot:
- White rounded content surface, minimal header and strong typographic hierarchy.
- Project title, concise description, status and dates.
- Compact financial overview: estimated total, paid total and outstanding amount.
- Clean vertical list of project items/milestones.
- Each row shows item name, due date where present, amount or payment cue where relevant, and status.
- Coral primary action to add an item.
- Tapping a row opens Item Details.
- Project edit/archive actions should be accessible without clutter.

Project fields:
- name (required)
- description (optional)
- start date (optional)
- target end date (optional)
- status: active, on_hold, completed, archived
- currency code (default KES)
- created/updated timestamps

Project item fields:
- title (required)
- description (optional)
- due date/time (optional)
- expected amount (optional; zero-cost items are valid)
- currency code
- completion state: open, in_progress, completed, cancelled
- optional priority
- created/updated timestamps

### 4.3 Item Details

Purpose: answer “What is this item, what will it cost, what have I paid, and is it complete?”

Visual composition, following the third reference screenshot:
- White rounded detail surface.
- Clear item title and project context.
- Due date and status.
- Expected cost, amount paid and remaining balance.
- Payment history with dates and amounts.
- Payment evidence previews/links.
- Notes/activity history.
- Strong coral completion action inspired by the reference “BUY TICKETS” button.
- Completion requires confirmation by default.
- Edit item and add payment actions should be clear but secondary to the primary completion action.

Item completion and payment are independent:
- An item can be fully paid but not completed.
- An item can be completed but still have an outstanding balance.
- An item can be partially paid and in progress.
- Completing an item must not automatically mark it paid.
- Paying an item must not automatically mark it completed.

### 4.4 Entry experiences (not primary screens)

- Splash: short, restrained brand entry using purple identity and app mark/name. Avoid long animations.
- App lock: PIN entry and optional device biometric unlock.
- These are not additional primary app destinations.

## 5. Reusable form system (mandatory)

Build one shared form design system and reuse it across domain forms. Do not implement forms as unrelated one-off screens.

Shared components:
- AppForm: consistent layout, keyboard handling, submit lifecycle.
- FormSection: section heading and grouped fields.
- FormField: label, helper, required indicator, validation error.
- TextInput and MultilineInput.
- DateTimeField.
- MoneyInput with currency.
- SelectField / StatusSelector.
- AttachmentPicker and EvidencePreview.
- FormActions with consistent cancel/save placement.
- Shared validation, disabled, loading, success and error states.

Domain forms:
- ProjectForm: create and edit.
- ProjectItemForm: create and edit.
- PaymentForm: add/edit payment record and attach evidence.
- ReminderForm: configure reminder where needed.

Reuse rules:
- Create and edit must use the same domain form with initial values.
- Keep field order, spacing, label style, error placement, keyboard behaviour and action placement consistent.
- Only fields and validation rules should vary by domain.
- Avoid one giant form containing fields unrelated to the current entity.
- Use the same form components in modal/sheet or full-page presentation as appropriate, without changing their visual system.

## 6. Payment and bookkeeping behaviour

Each project item may have zero or more payment records.

Payment fields:
- amount
- currency code
- payment date/time
- payment method/source (M-Pesa, cash, bank, card, other)
- transaction reference/code (optional)
- raw confirmation message (optional)
- notes (optional)
- created/updated timestamps

Payment evidence:
- A payment may have multiple attachments.
- Support pasted M-Pesa confirmation text.
- Support importing screenshots, images, PDFs or other appropriate receipt documents, subject to platform picker support.
- Keep attachments locally in app-private storage.
- Show evidence within the related payment record on Item Details.
- Preserve evidence if the app is offline.
- Do not attempt automatic M-Pesa SMS inbox scraping in the initial release. The user explicitly adds/pastes the message or selects an image/document.

Financial rules:
- Amount paid = sum of recorded, non-voided payments for the item.
- Outstanding balance = expected amount minus amount paid; show zero balance when paid amount meets/exceeds expected amount, while preserving overpayment as a visible value/state.
- Payment status: unpaid, partially_paid, paid, overpaid, not_applicable.
- Completion status is separate.
- Financial totals on Project Details aggregate item values and payment records using consistent currency rules.
- Do not aggregate different currencies into a misleading single total. If multi-currency records are enabled, show separate totals by currency.

## 7. Reminders and notifications

- Local notifications only in initial release.
- Remind for upcoming deadlines and payment-related due dates.
- Allow advance reminder offsets and/or a chosen reminder date/time.
- Allow reminders to be disabled per item.
- Reconcile scheduled OS notifications with persisted reminder records.
- Request notification permission contextually and explain why it is needed.
- Handle permission denial gracefully; the app must still work.
- A reminder should identify project and item, not expose sensitive payment evidence in notification text.

## 8. Authentication and privacy

- App PIN lock.
- Optional native device biometric unlock (fingerprint/face where supported).
- Lock on background and configurable inactivity timeout.
- Store PIN verification material securely; never store plaintext PIN.
- Keep database and evidence in app-private storage.
- No remote transmission in initial release.

## 9. Local backup and future Google Drive

Initial release:
- Provide a reliable local export and restore mechanism.
- Backup includes SQLite database, attachments, manifest, version information and integrity checks.
- Validate a backup before restoring.
- Warn before restore replaces local data.
- Test restore on a clean installation and after interrupted backup.

Future:
- Google Drive backup/restore can be added behind a backup provider interface.
- Begin with one-way backup and restore.
- Do not build live two-way sync or conflict resolution in initial release.

## 10. Non-functional requirements

- Offline operation for all core workflows.
- Fast launch and responsive scrolling.
- Accessible labels, touch targets, contrast and screen-reader semantics.
- Keyboard-safe forms.
- Graceful empty/error/loading states.
- No dead controls.
- Data integrity and backup reliability take priority over decorative animation.

## 11. Acceptance criteria

The initial release is not complete until:
1. User can create, edit, archive and view projects locally.
2. User can create, edit, view and complete project items.
3. Home highlights the most relevant upcoming/overdue item correctly.
4. Date selector filters/highlights the selected date correctly.
5. User can add multiple partial payments to an item.
6. User can paste an M-Pesa message and attach receipt screenshots/documents.
7. Payment history and evidence remain linked to the correct item and payment.
8. Payment state and completion state remain independent.
9. User can receive local deadline/payment reminders when permission is granted.
10. PIN and optional native biometrics protect app access.
11. App works offline after installation.
12. Local backup and restore preserve database relationships and attachments.
13. Financial calculations, migrations and key flows are covered by tests.
14. The three primary screens visually follow the supplied references and no unapproved primary screens have been added.
15. All create/edit forms use the shared form system.
