
# ReMarkable Time Axis: "Smart Zipper" Interaction Spec

## 1. Overview
Implement a "Compact Time Axis" that collapses empty time durations into visual "gaps" (Zipper) to maximize screen density, while allowing intuitive event creation via smart hover and click interactions within these gaps.

## 2. Component Structure

### 2.1 The Timeline Container
- **Layout:** Flex column or Grid.
- **Children:** Alternating sequence of `EventCard` and `TimeGap` components.
- **Logic:**
    - If `Event A.endTime` == `Event B.startTime` (consecutive), render standard margin (e.g., `8px`).
    - If `Event B.startTime` - `Event A.endTime` > `Threshold` (e.g., 30 mins), render a `TimeGap` component between them.

### 2.2 The `TimeGap` Component
This is the core interactive element. It represents the empty space between two events.

**Props:**
- `prevEventEndTime`: timestamp (Date object)
- `nextEventStartTime`: timestamp (Date object)
- `gapDuration`: duration in minutes (derived)

**Visual Elements:**
1.  **Container:** The wrapper div.
2.  **The Axis Line (Left):** The vertical timeline connector.
3.  **The Gap Indicator (Center):** A visual cue showing duration (e.g., "2h 30m Free").
4.  **The Phantom Add Button:** A hidden button that appears on hover to create events.

---

## 3. Interaction States & Styles

### 3.1 State: `DEFAULT` (Idle)
The timeline looks clean and compact. The gap is subtle.

*   **Container:**
    *   `height`: Fixed, small height (e.g., `48px` or `3rem`). **Crucial:** Do not scale height based on duration to preserve compactness.
    *   `cursor`: `default`.
*   **Axis Line (Left):**
    *   `style`: Dashed or Dotted (`border-left: 2px dashed #E5E7EB`).
    *   `opacity`: `0.6` (Subtle).
*   **Gap Indicator (Text):**
    *   `visibility`: Visible.
    *   `content`: Formatted duration (e.g., `2h 30m`).
    *   `style`: Small font, muted color (gray-400), centered vertically.
*   **Phantom Add Button:**
    *   `opacity`: `0`.
    *   `pointer-events`: `none`.

### 3.2 State: `HOVER` (Mouse Enter)
The user intends to interact. Provide visual cues without shifting layout heavily.

*   **Container:**
    *   `background-color`: Very light tint (e.g., `bg-blue-50/30` or `rgba(0,0,0,0.02)`).
    *   `cursor`: `pointer`.
    *   `transition`: `background-color 0.2s ease`.
*   **Axis Line (Left):**
    *   `style`: Solid (`border-left: 2px solid #3B82F6` - Primary Color).
    *   `opacity`: `1.0`.
    *   `transition`: `all 0.2s ease`.
*   **Gap Indicator (Text):**
    *   `opacity`: `0` (Hide to make room for the Add button).
    *   `transform`: `translateY(-5px)` (Subtle exit animation).
*   **Phantom Add Button:**
    *   `opacity`: `1`.
    *   `pointer-events`: `auto`.
    *   `transform`: `scale(1)`.
    *   `content`: "+ New Event".
    *   `position`: Centered in the gap.
    *   `style`: Primary button style (small, pill-shaped).

### 3.3 State: `ACTIVE/CLICKED` (Creation Mode)
User clicks the gap to add an event.

*   **Trigger:** `onClick` on the `TimeGap` container.
*   **Logic:**
    1.  Open "New Event" Modal or Inline Input.
    2.  **Smart Time Inference:**
        *   **Start Time:** Set to `prevEventEndTime` (default to filling the gap from the start).
        *   *Alternative Logic (Mouse Position):* Calculate relative Y position of click within the gap div. If click is in top 50%, start = `prevEventEndTime`. If bottom 50%, start = `nextEventStartTime - 1 hour` (or default duration).
    3.  **Duration:** Default to 1 hour, or `Math.min(1 hour, gapDuration)`.

---

## 4. Detailed Visual Specs (CSS/Tailwind Reference)

### The "Zipper" Line (Visualizing the Gap)
To differentiate the "Gap" line from the normal timeline:
- **Standard Line:** Solid gray (`border-l-2 border-gray-200`).
- **Gap Line (Zipper):** A repeating linear gradient or a dashed border.
  - *CSS Trick:* Use a pseudo-element `::before` on the Gap container to draw the line.
  - *Style:* `border-left: 2px dashed #CBD5E1;`

### The "Time Bubble" (Optional Hover Effect)
When hovering inside the gap, show a floating tooltip following the cursor Y-position that calculates the exact time.
- **Logic:**
  `time = prevEventEndTime + (gapDuration * (mouseY / componentHeight))`
- **Display:** A small tooltip saying e.g., "Create at 14:45".

---

## 5. Implementation Logic (Pseudo-Code)

```javascript
// Pseudo-code for the TimeGap Component

const TimeGap = ({ prevEnd, nextStart }) => {
  const [isHovered, setIsHovered] = useState(false);
  const durationMinutes = differenceInMinutes(nextStart, prevEnd);

  // Don't render gap if time is too short (< 15 mins)
  if (durationMinutes < 15) return <div className="h-4" />; // Just a small margin

  const handleSmartClick = (e) => {
    // Calculate click position percentage (0.0 to 1.0)
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top; 
    const percentage = y / rect.height;
    
    // Determine suggested start time based on click position
    // If clicked top half: suggest start time = prevEnd
    // If clicked bottom half: suggest start time = nextStart - 30mins
    let suggestedStart = percentage < 0.5 
        ? prevEnd 
        : subMinutes(nextStart, 30);

    triggerCreateEventModal({ start: suggestedStart });
  };

  return (
    <div 
      className={`
        relative flex items-center justify-center w-full h-12 
        transition-colors duration-200
        ${isHovered ? 'bg-blue-50/50' : 'bg-transparent'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleSmartClick}
    >
      {/* The Timeline "Zipper" */}
      <div className={`
        absolute left-[20px] h-full border-l-2 
        ${isHovered ? 'border-blue-500 border-solid' : 'border-gray-300 border-dashed'}
      `} />

      {/* Content State Switcher */}
      {isHovered ? (
        <button className="z-10 px-3 py-1 text-xs text-white bg-blue-500 rounded-full shadow-sm animate-fade-in">
          + Add Event
        </button>
      ) : (
        <span className="z-10 px-2 text-xs text-gray-400 bg-white">
          {formatDuration(durationMinutes)} Free
        </span>
      )}
    </div>
  );
};
```

## 6. Edge Cases
1.  **Overnight Gaps:** If a gap spans across midnight (e.g., 11 PM to 9 AM next day), the `Gap Indicator` should read "Overnight (10h)".
2.  **Very Small Gaps (15-30m):** reduce height to `32px`, hide the "+ Add Event" text and just show a "+" icon on hover to save space.
3.  **Very Large Gaps (> 8h):** Keep the height fixed (e.g., `48px`). Do not expand height. The goal is compactness.

