# Robust Scrolling System Guide

This document outlines the comprehensive scrolling system implemented in SumiTask to ensure consistent, performant, and accessible scrolling across all components.

## Overview

The robust scrolling system provides:
- **Consistent behavior** across all browsers and devices
- **Performance optimizations** for smooth scrolling
- **Accessibility features** for keyboard navigation and screen readers
- **Mobile optimization** with touch-friendly scrolling
- **Cross-browser compatibility** including Firefox scrollbar styling
- **High contrast mode support** for better visibility

## CSS Classes

### Base Scrollable Classes

#### `.scrollable`
Basic scrollable container with standard height and behavior.

#### `.scrollable-small`
Small scrollable container (max-height: 24rem)
- Used for: Time pickers, small dropdowns, short lists

#### `.scrollable-medium`
Medium scrollable container (max-height: 32rem)
- Used for: Medium-sized content areas, forms with many fields

#### `.scrollable-large`
Large scrollable container (max-height: 70vh)
- Used for: Task lists, main content areas, long forms

#### `.scrollable-table`
Table-specific scrollable container (max-height: 80vh)
- Used for: Data tables, revision lists, task management tables

#### `.modal-scrollable`
Modal-specific scrollable container (max-height: calc(100vh - 8rem))
- Used for: Modal dialogs, popup forms

### Utility Classes

#### Scroll Behavior
- `.scroll-smooth` - Smooth scrolling behavior
- `.scroll-auto` - Instant scrolling behavior

#### Scroll Padding
- `.scroll-padding-top` - Adds top padding for scroll targets
- `.scroll-padding-bottom` - Adds bottom padding for scroll targets

#### Scroll Snap
- `.scroll-snap-y` - Vertical scroll snapping
- `.scroll-snap-start` - Snap to start
- `.scroll-snap-center` - Snap to center
- `.scroll-snap-end` - Snap to end

#### Scroll Margins
- `.scroll-mt-4` - Top scroll margin (1rem)
- `.scroll-mt-8` - Top scroll margin (2rem)
- `.scroll-mb-4` - Bottom scroll margin (1rem)
- `.scroll-mb-8` - Bottom scroll margin (2rem)

## React Components

### ScrollContainer

A reusable React component that provides robust scrolling functionality:

```tsx
import { ScrollContainer } from '../components/common/ScrollContainer';

<ScrollContainer
  size="large"
  maxHeight="500px"
  onScroll={(e) => console.log('Scrolled')}
  scrollToTop={true}
  smooth={true}
  aria-label="Task list"
>
  {/* Your content */}
</ScrollContainer>
```

#### Props

- `size`: 'small' | 'medium' | 'large' | 'table' - Determines the scrollable class
- `maxHeight`: string - Custom max height override
- `onScroll`: function - Scroll event handler
- `scrollToTop`: boolean - Auto-scroll to top
- `scrollToBottom`: boolean - Auto-scroll to bottom
- `smooth`: boolean - Smooth scrolling behavior
- `aria-label`: string - Accessibility label
- `aria-describedby`: string - Accessibility description

### ScrollIndicator

Visual indicator for scrollable content:

```tsx
import { ScrollIndicator } from '../components/common/ScrollContainer';

<ScrollIndicator
  containerRef={scrollRef}
  showTopIndicator={true}
  showBottomIndicator={true}
/>
```

### Utility Hooks

#### useScrollToTop
```tsx
import { useScrollToTop } from '../components/common/ScrollContainer';

const scrollToTop = useScrollToTop(containerRef);
// Call scrollToTop() to scroll to top
```

#### useScrollToBottom
```tsx
import { useScrollToBottom } from '../components/common/ScrollContainer';

const scrollToBottom = useScrollToBottom(containerRef);
// Call scrollToBottom() to scroll to bottom
```

#### useScrollToElement
```tsx
import { useScrollToElement } from '../components/common/ScrollContainer';

const scrollToElement = useScrollToElement(containerRef);
// Call scrollToElement('element-id') to scroll to specific element
```

## Implementation Examples

### Task List (Home Page)
```tsx
<div className="space-y-3 scrollable-large" role="list" aria-label="Today's tasks">
  {tasks.map((task, index) => (
    <TaskItem key={task.id} task={task} index={index} />
  ))}
</div>
```

### Calendar Task List
```tsx
<div className="space-y-2 sm:space-y-3 scrollable-large pr-2">
  {getSortedTasks(getTasksForDate(selectedDate)).map((task, index) => (
    <CalendarTaskItem key={task.id} task={task} index={index} />
  ))}
</div>
```

### Revision Table
```tsx
<div className="scrollable-table">
  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
    {/* Table content */}
  </table>
</div>
```

### Time Picker Dropdown
```tsx
<div className="scrollable-small">
  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((hour) => (
    <button key={hour} onClick={() => selectHour(hour)}>
      {hour}
    </button>
  ))}
</div>
```

### Modal Content
```tsx
<div className="fixed inset-0 z-50 modal-scrollable">
  <div className="flex items-center justify-center min-h-screen px-4">
    {/* Modal content */}
  </div>
</div>
```

## Browser Support

### Webkit Browsers (Chrome, Safari, Edge)
- Custom scrollbar styling with `::-webkit-scrollbar`
- Smooth scrolling with `-webkit-overflow-scrolling: touch`
- Performance optimizations with `will-change: scroll-position`

### Firefox
- Native scrollbar styling with `scrollbar-width` and `scrollbar-color`
- Smooth scrolling support
- Performance optimizations

### Mobile Browsers
- Touch-friendly scrolling with `-webkit-overflow-scrolling: touch`
- Overscroll behavior control with `overscroll-behavior: contain`
- Smaller scrollbars for better mobile experience

## Accessibility Features

### Keyboard Navigation
- All scrollable containers are focusable with `tabIndex={0}`
- Focus indicators with `:focus-within` pseudo-class
- Proper ARIA labels and descriptions

### Screen Reader Support
- Semantic HTML structure with proper roles
- ARIA labels for scrollable containers
- Descriptive text for scroll indicators

### Reduced Motion Support
- Respects `prefers-reduced-motion` media query
- Disables smooth scrolling when motion is reduced
- Maintains functionality while reducing animations

## Performance Optimizations

### Hardware Acceleration
- GPU acceleration with `transform: translateZ(0)`
- Optimized rendering with `will-change: scroll-position`
- Smooth animations with `scroll-behavior: smooth`

### Memory Management
- Efficient event listeners with proper cleanup
- Debounced scroll handlers for performance
- Optimized re-renders with React best practices

### Mobile Performance
- Touch-optimized scrolling
- Reduced scrollbar size on mobile
- Optimized for mobile hardware

## Best Practices

### When to Use Each Class

1. **`.scrollable-small`** - For short lists, time pickers, small dropdowns
2. **`.scrollable-medium`** - For forms, medium content areas
3. **`.scrollable-large`** - For main content areas, task lists
4. **`.scrollable-table`** - For data tables, complex tabular data
5. **`.modal-scrollable`** - For modal dialogs and popups

### Accessibility Guidelines

1. Always provide `aria-label` for scrollable containers
2. Use semantic HTML elements where possible
3. Ensure keyboard navigation works properly
4. Test with screen readers
5. Respect user's motion preferences

### Performance Guidelines

1. Use appropriate scrollable classes for content size
2. Avoid nesting scrollable containers unnecessarily
3. Clean up event listeners in React components
4. Use `useCallback` for scroll event handlers
5. Consider virtual scrolling for very large lists

## Troubleshooting

### Common Issues

1. **Scroll not working on mobile**
   - Ensure `-webkit-overflow-scrolling: touch` is applied
   - Check for conflicting CSS properties

2. **Scrollbar not visible**
   - Verify scrollbar CSS is not overridden
   - Check if content actually overflows

3. **Performance issues**
   - Reduce scroll event frequency
   - Use `will-change` sparingly
   - Consider virtual scrolling for large lists

4. **Accessibility issues**
   - Ensure proper ARIA labels
   - Test keyboard navigation
   - Verify screen reader compatibility

### Debug Tools

1. **Browser DevTools**
   - Check computed styles for scroll properties
   - Monitor scroll events in Console
   - Test responsive behavior

2. **Accessibility Testing**
   - Use browser accessibility tools
   - Test with screen readers
   - Verify keyboard navigation

## Future Enhancements

### Planned Features

1. **Virtual Scrolling** - For very large lists
2. **Infinite Scroll** - For paginated content
3. **Scroll Restoration** - Remember scroll position
4. **Custom Scrollbars** - More styling options
5. **Scroll Analytics** - Track scroll behavior

### Performance Improvements

1. **Intersection Observer** - For scroll-based animations
2. **Resize Observer** - For responsive scroll containers
3. **Performance Monitoring** - Track scroll performance
4. **Lazy Loading** - Load content on scroll

This robust scrolling system ensures a consistent, performant, and accessible user experience across all devices and browsers. 