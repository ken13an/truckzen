# Prompt 007 -- Technician Time Clock on RO Lines

## Priority: HIGH
## Estimated time: 30-45 minutes
## Depends on: Prompt 004 (RO lines)

---

## What To Do

1. Read .truckzen/TASKS/CC_RULES.md first.
3. Read .truckzen/TASKS/BRAND_GUIDE.md for all UI styling rules (colors, fonts, spacing, components).

## Build These

### 1. Clock In/Out on RO Lines

Update the RO Detail page (Tab 2: Complaint Lines). Each complaint line card now has:

- "Clock In" button (green) -- visible when tech is NOT clocked into this line
- "Clock Out" button (red, with live timer showing elapsed time) -- visible when tech IS clocked in
- A tech can only be clocked into ONE line at a time across the entire shop. If they clock into a new line, auto-clock-out of the previous one.

**Clock In logic:**
- Check if tech has an open time_entry (clock_out IS NULL) anywhere
- If yes: close that entry first (set clock_out = now, calculate hours_worked)
- Create new time_entry: tech_id, repair_order_id, repair_order_line_id, clock_in = now
- Update RO line status to 'in_progress' if it was 'open'

**Clock Out logic:**
- Find open time_entry for this tech + line
- Set clock_out = now
- Calculate hours_worked = EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600
- Update repair_order_lines.actual_hours (sum of all time entries for this line)
- Recalculate labor_total = actual_hours * labor_rate

### 2. Live Timer Component: src/components/LiveTimer.tsx

- Shows elapsed time since clock_in in HH:MM:SS format
- Updates every second using setInterval
- Green pulsing dot to indicate actively clocked in

### 3. Tech Dashboard Widget

Create src/components/TechActiveJob.tsx -- a card that shows:
- "You are currently clocked into: RO-01005, Line 2: Front brake replacement"
- Live timer
- "Clock Out" button
- This card appears at the top of any page for the logged-in technician

### 4. Time Log Tab Update

Update RO Detail Tab 4 (Time Log) to be fully functional:
- Shows all time entries for this RO
- Columns: Tech, Line #, Clock In, Clock Out, Hours, Type
- Open entries show live timer instead of clock out time
- Total hours at the bottom

### 5. API Routes

**src/app/api/time-entries/clock-in/route.ts**
- POST: { repair_order_line_id }
- Auto-closes any open entry for this tech
- Creates new entry

**src/app/api/time-entries/clock-out/route.ts**
- POST: { time_entry_id } or just close the current open entry for this tech
- Calculates hours, updates RO line

**src/app/api/time-entries/active/route.ts**
- GET: returns the current open time entry for the logged-in tech (if any)

## Verification
- Clock in creates a time_entry record
- Clock out calculates hours correctly
- Auto-close works when clocking into a different line
- Live timer displays and updates
- RO line actual_hours updates after clock out
- Time log tab shows all entries

## After Task
Update .truckzen/DONE/ files per CC_RULES.md. Git commit and push.
