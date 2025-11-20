# Local-to-Global Scroll Coordination

This document explains the implementation of local-to-global scroll coordination in the SumiTask application.

## Overview

The local-to-global scroll coordination feature allows users to seamlessly transition from scrolling within a local container (like a task list) to scrolling the global page content. When a user reaches the top or bottom of a local scrollable area, the scrolling automatically continues to the global page scroll.

## How It Works

### 1. ScrollContext Provider

The `ScrollContext` manages the global scrolling state and provides methods for local scroll containers to register themselves and trigger global scrolling.

**Key Features:**
- `globalScrollContainer`: Reference to the main content area that acts as the global scroll container
- `registerLocalScroll()`: Registers a local scroll container with a unique ID
- `triggerGlobalScroll()`: Triggers scrolling on the global container
- `isGlobalScrolling`: Flag to prevent recursive scroll triggers

### 2. Enhanced ScrollContainer Component

The `ScrollContainer` component has been enhanced with new props for local-to-global coordination:

**New Props:**
- `enableGlobalScroll`: Boolean to enable local-to-global coordination
- `scrollId`: Unique identifier for the scroll container
- `globalScrollThreshold`: Distance from top/bottom to trigger global scroll (default: 5px)
- `globalScrollAmount`: Amount to scroll globally when triggered (default: 100px)

### 3. Scroll Detection Logic

The system detects when local scrolling should transition to global scrolling:

1. **Scrolling Up**: When user scrolls up and reaches within `globalScrollThreshold` pixels of the top
2. **Scrolling Down**: When user scrolls down and reaches within `globalScrollThreshold` pixels of the bottom

### 4. Visual Feedback

When global scrolling is triggered, visual feedback is provided:
- Subtle box-shadow animation on the local container
- Smooth transition between local and global scrolling
- Different visual cues for scrolling up vs down

## Implementation Examples

### Basic Usage

```tsx
<ScrollContainer 
  size="large" 
  enableGlobalScroll={true}
  scrollId="my-task-list"
  globalScrollThreshold={10}
  globalScrollAmount={100}
>
  {/* Your scrollable content */}
</ScrollContainer>
```

### Advanced Configuration

```tsx
<ScrollContainer 
  size="table" 
  enableGlobalScroll={true}
  scrollId="revision-table"
  globalScrollThreshold={5}
  globalScrollAmount={80}
  className="custom-styles"
>
  {/* Table content */}
</ScrollContainer>
```

## Current Implementation

The feature is currently implemented in:

1. **Home Page** (`frontend/src/pages/Home.tsx`)
   - Task list with `scrollId="home-tasks"`
   - Threshold: 10px, Amount: 100px

2. **Calendar Page** (`frontend/src/pages/Calendar.tsx`)
   - Task list with `scrollId="calendar-tasks"`
   - Threshold: 10px, Amount: 100px

3. **Revision Center** (`frontend/src/pages/RevisionCenter.tsx`)
   - Revision table with `scrollId="revision-table"`
   - Threshold: 10px, Amount: 80px

## CSS Classes

### Global Scroll Coordination
- `.global-scroll-enabled`: Applied to containers with local-to-global coordination
- `.scrolling-up`: Visual feedback when scrolling up to global
- `.scrolling-down`: Visual feedback when scrolling down to global

### Responsive Design
- Mobile-optimized scroll behavior
- Touch-friendly scroll detection
- Reduced motion support for accessibility

## Browser Support

- **Webkit browsers**: Full support with custom scrollbar styling
- **Firefox**: Full support with native scrollbar styling
- **Mobile browsers**: Touch-optimized scrolling with momentum

## Performance Considerations

- Uses `requestAnimationFrame` for smooth animations
- Debounced scroll event handling
- Hardware acceleration with `transform: translateZ(0)`
- Efficient scroll position tracking

## Accessibility Features

- Keyboard navigation support
- Screen reader announcements
- Reduced motion support
- Focus management during scroll transitions

## Troubleshooting

### Common Issues

1. **Global scrolling not triggering**
   - Check if `enableGlobalScroll` is set to `true`
   - Verify the container is wrapped in `ScrollProvider`
   - Ensure `scrollId` is unique

2. **Scroll conflicts**
   - The system prevents recursive triggers with `isGlobalScrolling` flag
   - Check for overlapping scroll containers

3. **Performance issues**
   - Reduce `globalScrollThreshold` for more responsive behavior
   - Adjust `globalScrollAmount` based on content size

### Debug Mode

To debug scroll coordination, check the browser console for:
- Scroll event logs
- Global scroll trigger events
- Container registration messages

## Future Enhancements

1. **Scroll momentum**: Preserve scroll momentum when transitioning
2. **Custom thresholds**: Per-container scroll thresholds
3. **Scroll history**: Remember scroll positions across navigation
4. **Gesture support**: Enhanced touch and mouse wheel handling 