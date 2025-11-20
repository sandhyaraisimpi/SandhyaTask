# PDF Export Troubleshooting Guide

## Common Issues and Solutions

### 1. Import/Module Errors

**Issue**: `jsPDF is not a constructor` or similar import errors
**Solution**: 
- The import has been updated to use `import { jsPDF } from 'jspdf'`
- autoTable is now imported as `import 'jspdf-autotable'`

### 2. Browser Compatibility

**Issue**: PDF export doesn't work in certain browsers
**Solutions**:
- Ensure you're using a modern browser (Chrome, Firefox, Safari, Edge)
- Check if JavaScript is enabled
- Try disabling browser extensions that might interfere

### 3. Console Errors

**To debug**:
1. Open browser developer tools (F12)
2. Go to Console tab
3. Click the PDF export button
4. Look for any error messages

**Common console messages to look for**:
- `PDF export function called with X tasks` - Function is being called
- `PDF document created successfully` - jsPDF is working
- `Saving PDF with filename: ...` - About to save
- `PDF saved successfully` - Export completed

### 4. File Download Issues

**Issue**: PDF doesn't download automatically
**Solutions**:
- Check browser download settings
- Ensure popup blockers are disabled
- Check if downloads are allowed for the site

### 5. Empty or Corrupted PDF

**Issue**: PDF downloads but is empty or corrupted
**Solutions**:
- Check if there are tasks to export
- Verify the tasks array is not empty
- Check console for any errors during PDF generation

## Debugging Steps

### Step 1: Check Console Logs
1. Open browser developer tools
2. Navigate to Task Manager
3. Click Export → PDF Format
4. Check console for debug messages

### Step 2: Verify Data
1. Ensure there are tasks in the Task Manager
2. Check if the tasks have the required fields (title, dueDate, etc.)

### Step 3: Test with Different Browsers
1. Try Chrome, Firefox, Safari, or Edge
2. Check if the issue is browser-specific

### Step 4: Check Network Tab
1. Open developer tools → Network tab
2. Click PDF export
3. Look for any failed requests or errors

## Error Messages and Solutions

### "Failed to export PDF: jsPDF is not a constructor"
- **Cause**: Import issue with jsPDF
- **Solution**: Import has been fixed to use `{ jsPDF }`

### "Failed to export PDF: autoTable is not a function"
- **Cause**: autoTable import issue
- **Solution**: Import has been fixed to use `import 'jspdf-autotable'`

### "Failed to export PDF: Cannot read property 'autoTable'"
- **Cause**: autoTable not properly attached to jsPDF
- **Solution**: Using `(pdf as any).autoTable()` to bypass TypeScript issues

### "Failed to export PDF: Unknown error"
- **Cause**: Generic error during PDF generation
- **Solution**: Check console for more detailed error messages

## Testing the PDF Export

### Manual Test
1. Navigate to http://localhost:3001/tasks
2. Ensure there are some tasks in the list
3. Click the "Export" button
4. Select "PDF Format"
5. Check if PDF downloads successfully

### Expected Behavior
- PDF should download automatically
- Filename should be: `sumitask-report-YYYY-MM-DD.pdf`
- PDF should contain task information and analytics

## If Issues Persist

1. **Check Dependencies**: Ensure `jspdf` and `jspdf-autotable` are installed
2. **Clear Cache**: Clear browser cache and reload
3. **Restart Dev Server**: Stop and restart the development server
4. **Check File Permissions**: Ensure the app can write to download directory

## Contact Support

If you continue to experience issues:
1. Note the exact error message
2. Check browser console for additional details
3. Try the export in a different browser
4. Provide the error details for further assistance 

## Available Export Locations

### Task Manager Page
- **Location**: Full Task Manager interface
- **Features**: Export modal with PDF, CSV, and JSON options
- **Use Case**: Comprehensive task management and reporting

### Home Page
- **Location**: Main dashboard/home screen
- **Features**: Direct PDF export button
- **Use Case**: Quick PDF export of current tasks 