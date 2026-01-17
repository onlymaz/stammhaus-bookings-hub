# Implementation Plan: Add Inline Editable Staff Note to Reservation Cards

## Objective
Add an inline editable "Staff Note" section to each reservation card in the day detail panel of the CalendarView, allowing staff to view, add, edit, and save notes directly on the card without opening a separate dialog.

## Current State
- Reservation cards display customer name, phone, status, time, guests, and special requests
- The `notes` field already exists in the database and is fetched
- The `special_requests` field (customer-provided) is displayed with "Note:" label in an accent-colored box
- Staff notes editing currently only works in the ReservationDetailDialog

## Implementation Steps

### Step 1: Add State Management for Inline Note Editing
Add new state variables to CalendarView.tsx:
- `editingNoteId: string | null` - tracks which reservation's note is being edited
- `noteText: string` - holds the current note text being edited
- `isSavingNote: boolean` - tracks save operation status

### Step 2: Create Note Save Handler
Implement `handleSaveNote` function that:
- Updates the `notes` field in the `reservations` table via Supabase
- Shows success/error toast notifications
- Refreshes the reservations list to reflect changes
- Resets the editing state

### Step 3: Update Reservation Card UI
After the guest details section (time and guests), add the Staff Note section with:

**Display Mode (when not editing):**
- If note exists: Show a styled box with "Note:" label and the note text, similar to the special_requests display but with a distinct staff-note styling (cream/yellow background as in your screenshot)
- Include an "Edit" button (pencil icon) that appears on hover
- If no note: Show "Add Note" button that appears on hover

**Edit Mode (when editing this reservation's note):**
- Show a compact textarea with the current note text
- Show "Save" and "Cancel" buttons
- Auto-focus the textarea when entering edit mode

### Step 4: Visual Styling
- Style the Staff Note box distinctly from Special Requests (customer notes)
- Use a warm cream/yellow background similar to your screenshot
- Keep the design compact to fit well in the card layout
- Show edit controls on hover to keep the UI clean

## UI Structure for Each Reservation Card

```
[Customer Name]                    [Status Badge] [Delete]
[Phone Number]

[Time Badge] [Guests Badge]

[Staff Note Section - NEW]
  If has note: "Note: {note text}"  [Edit icon on hover]
  If no note: [+ Add Note button on hover]
  
  If editing:
  [Textarea]
  [Cancel] [Save]

[Special Requests - existing, if any]
  "Request: {special_requests}"
```

## Technical Details
- Use the existing `notes` field from the reservation object
- Call `supabase.from("reservations").update({ notes }).eq("id", reservationId)` to save
- Use `fetchReservations()` to refresh after save
- Import `Edit2`, `Save`, `X` icons from lucide-react
- Use Textarea component for editing

## Files to Modify
- `src/components/dashboard/CalendarView.tsx` - Add inline note editing functionality

## No Database Changes Required
The `notes` field already exists in the reservations table and is properly fetched.
