# 🧪 Test Background Tabs - Quick Guide

**Feature:** Open tabs in background with modified clicks  
**Shortcuts:** Middle-click, Cmd+Click (Mac), Ctrl+Click (Windows/Linux)

---

## 🎯 Quick Tests

### Test 1: Middle Mouse Button
1. Go to **Contacts** page
2. **Middle-click** (press mouse wheel) on any contact row
3. **Expected:**
   - ✅ New tab appears in TabBar
   - ✅ You **stay on Contacts** page (don't switch)
   - ✅ Tab is created but not active

### Test 2: Cmd+Click (Mac) / Ctrl+Click (Windows)
1. Go to **Organizations** page
2. Hold **Cmd** (Mac) or **Ctrl** (Windows/Linux)
3. **Click** on any organization row
4. **Expected:**
   - ✅ New tab appears in TabBar
   - ✅ You **stay on Organizations** page
   - ✅ Tab is created but not active

### Test 3: Sidebar Navigation
1. You're on **Dashboard**
2. **Cmd/Ctrl+Click** on "Deals" in sidebar
3. **Expected:**
   - ✅ Deals tab appears in TabBar
   - ✅ You **stay on Dashboard**
   - ✅ Can switch to Deals tab later

### Test 4: Multiple Background Tabs
1. Go to **Contacts** list
2. **Cmd/Ctrl+Click** on 5 different contacts rapidly
3. **Expected:**
   - ✅ 5 tabs appear in TabBar
   - ✅ You **stay on Contacts** list
   - ✅ All tabs are in background
   - ✅ Can review each contact later

### Test 5: Normal Click Still Works
1. Go to any list view
2. **Normal left-click** (no modifiers) on a row
3. **Expected:**
   - ✅ Tab opens AND switches to it (old behavior)
   - ✅ Content area shows the record
   - ✅ Normal workflow unchanged

---

## 📊 Visual Test Matrix

| Action | Location | Expected Result |
|--------|----------|-----------------|
| **Left Click** | Contact row | Opens & Switches ➡️ |
| **Middle Click** | Contact row | Opens in Background 🔕 |
| **Cmd+Click** | Contact row | Opens in Background 🔕 |
| **Ctrl+Click** | Contact row | Opens in Background 🔕 |
| **Left Click** | Sidebar | Opens & Switches ➡️ |
| **Cmd+Click** | Sidebar | Opens in Background 🔕 |

---

## 🎬 Step-by-Step Scenarios

### Scenario A: Research Mode
**Goal:** Queue multiple contacts for review

1. Open **Contacts** page
2. **Cmd/Ctrl+Click** on "John Doe"
   - ✅ Tab created, stay on list
3. **Cmd/Ctrl+Click** on "Jane Smith"
   - ✅ Another tab created, still on list
4. **Cmd/Ctrl+Click** on "Bob Wilson"
   - ✅ Third tab created, still on list
5. Now you have 3 background tabs
6. Click each tab to review contacts one by one

### Scenario B: Compare Records
**Goal:** Open related records for comparison

1. Open a **Contact Detail** page
2. **Cmd/Ctrl+Click** on related organization
   - ✅ Org opens in background
3. **Cmd/Ctrl+Click** on related deal
   - ✅ Deal opens in background
4. You're still on Contact page
5. Switch between tabs to compare

### Scenario C: Quick Reference
**Goal:** Check something without losing current view

1. You're working on **Dashboard**
2. **Cmd/Ctrl+Click** "Calendar" in sidebar
   - ✅ Calendar opens in background
3. You're still on Dashboard
4. Finish Dashboard work
5. Switch to Calendar tab when ready

---

## 🖱️ Mouse Button Guide

### Left Button (0):
- **Normal click:** Open and switch
- **With Cmd/Ctrl:** Open in background

### Middle Button (1):
- **Always:** Open in background
- **No modifier needed**

### Right Button (2):
- **Context menu** (unchanged)

---

## ⌨️ Keyboard Shortcuts

### macOS:
```
Cmd + Click = Background Tab
```

### Windows/Linux:
```
Ctrl + Click = Background Tab
```

### All Platforms:
```
Middle Click = Background Tab
```

---

## 🔍 Console Checks

Open browser console (F12) and look for:

### Normal Click (Foreground):
```
🔵 openTab called: /contacts/123 background: false
✨ Creating new tab: tab_xxx John Doe
✅ openTab complete (foreground), activeTabId: tab_xxx
```

### Modified Click (Background):
```
🔵 openTab called: /contacts/456 background: true
✨ Creating new tab: tab_yyy Jane Smith
✅ openTab complete (background), tab created but not active
```

---

## ✅ Success Indicators

You know it's working when:

### 1. Tab Appears But No Switch
- [ ] New tab visible in TabBar
- [ ] Tab has correct title and icon
- [ ] **Current page doesn't change**
- [ ] Active tab indicator stays on original tab

### 2. Multiple Tabs Queue Up
- [ ] Can open 5+ tabs with Cmd/Ctrl+Click
- [ ] All appear in TabBar
- [ ] Never switch away from current view
- [ ] All tabs accessible via TabBar clicks

### 3. Normal Clicks Unchanged
- [ ] Regular clicks still switch tabs
- [ ] Existing workflow not disrupted
- [ ] No breaking changes

---

## 🌍 Test on Different Platforms

### macOS Users:
- [ ] Cmd+Click on contact → Background tab
- [ ] Cmd+Click on sidebar → Background tab
- [ ] Middle-click → Background tab
- [ ] Normal click → Switches (unchanged)

### Windows Users:
- [ ] Ctrl+Click on contact → Background tab
- [ ] Ctrl+Click on sidebar → Background tab
- [ ] Middle-click → Background tab
- [ ] Normal click → Switches (unchanged)

### Linux Users:
- [ ] Ctrl+Click on contact → Background tab
- [ ] Ctrl+Click on sidebar → Background tab
- [ ] Middle-click → Background tab
- [ ] Normal click → Switches (unchanged)

---

## 🚨 What to Watch For

### ❌ Bad (Report if seen):
- Modified click switches to the new tab
- Middle-click doesn't work
- Normal clicks stop working
- Tab bar becomes unresponsive
- Console errors appear

### ✅ Good (Expected):
- Modified clicks create tabs without switching
- Tab bar shows all new tabs
- Can switch to any tab manually
- Normal clicks work as before
- Smooth, responsive behavior

---

## 💡 Pro Tips

### Power User Workflows:

**1. Queue and Review:**
```
Cmd/Ctrl+Click 10 records
→ All open in background
→ Review each systematically
```

**2. Side-by-Side Comparison:**
```
View Record A
Cmd/Ctrl+Click Record B
Cmd/Ctrl+Click Record C
→ Switch between tabs to compare
```

**3. Branch Exploration:**
```
Working on main view
Cmd/Ctrl+Click related items
→ Explore without losing place
```

**4. Batch Operations:**
```
Browse list
Middle-click items to process
→ Queue up work for later
```

---

## 🎯 Full Test Checklist

### Basic Functionality:
- [ ] Middle-click on contact row
- [ ] Cmd/Ctrl+Click on organization row
- [ ] Cmd/Ctrl+Click on deal row
- [ ] Cmd/Ctrl+Click on import row
- [ ] Cmd/Ctrl+Click on sidebar item
- [ ] Normal click still switches tabs

### Advanced Scenarios:
- [ ] Open 5 background tabs rapidly
- [ ] Mix normal and modified clicks
- [ ] Open same record with modifier twice
- [ ] Switch between foreground and background tabs
- [ ] Close background tabs
- [ ] Reorder tabs (drag and drop)

### Cross-Browser:
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge

---

## 🎉 Expected Benefits

After testing, you should experience:

- ✨ **Faster workflow** - No constant switching
- ✨ **Better multitasking** - Queue multiple items
- ✨ **Context preservation** - Stay on current view
- ✨ **Familiar behavior** - Like browser tabs
- ✨ **Power user efficiency** - Advanced workflows enabled

---

**Try all the tests and enjoy the browser-like tab experience!** 🚀

**Tip:** This feature matches Chrome/Firefox behavior, so if you use those browsers often, the interactions will feel natural!

