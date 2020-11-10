/*
 * Title:             tab-numbering.js
 * Description:       Numbers your tabs!
 * Created by:        Tuomas Salo
 * Contributions by:  Austin Moore
 * Simple Tab Group compatibility:  Rajpaul Bagga
 */

'use strict';

const browser = window.browser || window.chrome;
const MAX_COUNT = 8; // Max tab that can be accessed this way, apart from special 9 handling as last tab.
const NUMBER_TAG_LEN = 2; // number of characters in the numeric tag

const marker = '\u2063';  // Invisible Separator to act as a marker prefix on titles that have been tagged with a number

const numbers = ['¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
const numToIndex = new Map();
for (let i = 0; i < numbers.length; i++) {
  numToIndex.set(numbers[i], i);
}

// When page navigation happens, we get a title changed event we need to respond to in order to update the number.
// But when we update the number, we also trigger a title changed event. Use this as flag bucket
// to signal to the title-update event handler to skip the update process when it is triggered due to our update.
const tabsWeUpdatedTitle = new Set();

/**
 * Determines if a title has been tagged with a number.
 *
 * @param title {string} Page title to test
 * @returns {boolean} True if the title has been marked
 */
function hasNumberMarker(title) {
  return title.length > NUMBER_TAG_LEN && title[0] === marker;
}

/**
 * Given a title that has been tagged (i.e. {@link #hasNumberMarker} returns true),
 * determine its 0-based index position among visible tabs within the current window.
 *
 * @param title {string} The title to query on
 * @returns {number} The 0-based index of the tab.
 */
function markedIndex(title) {
  return numToIndex.get(title[1]);
}

/**
 * Updates all the provided tabs on the assumption they represent all visible tabs.
 *
 * @param visibleTabs {array} All the currently visible tabs for a window.
 */
function updateTabs(visibleTabs) {
  console.log('updateTabs(); ', visibleTabs);

  updateSomeTabs(visibleTabs, 0);
}

/**
 * Updates some of the provided tabs, all from the provided starting index to the end.
 *
 * @param visibleTabs {array} All the currently visible tabs for a window.
 * @param startIndex {number} The 0-based starting index to update from.
 */
function updateSomeTabs(visibleTabs, startIndex) {
  console.log('updateSomeTabs(); ', startIndex, visibleTabs);

  for (let i = startIndex; i < visibleTabs.length; i++) {
    let tab = visibleTabs[i];
    updateTab(tab, i, visibleTabs.length);
  }
}

/**
 * Update the given tab at the visible, 0-based index provided.
 *
 * @param tab The tab to update.
 * @param tabIndex {number} The 0-based index declaring the tab's position among visible tabs in the window.
 * @param visibleTabCount {number} The total count of visible tabs in the window.
 */
function updateTab(tab, tabIndex, visibleTabCount) {
  const oldTitle = tab.title;
  let newTitle = oldTitle;

  if (!newTitle) {
    console.log('missing title. Bail');
    return;
  }


  // Take out one of these numbers if it already exists in the title
  if (tabIndex >= MAX_COUNT && hasNumberMarker(newTitle)
      && (tabIndex !== visibleTabCount - 1 || newTitle[1] !== numbers[MAX_COUNT])) {
    console.log('  stripping number from title outside of range');
    newTitle = newTitle.substring(NUMBER_TAG_LEN);
  }

  if (tabIndex < MAX_COUNT) {
    if (numbers[tabIndex] === newTitle[1]) {
      console.log('  current title correct: ', oldTitle, '/', newTitle);
      return;
    } else if (hasNumberMarker(newTitle)) {
      console.log('  current title is numbered, but wrong');
      newTitle = marker + numbers[tabIndex] + newTitle.substring(NUMBER_TAG_LEN);
    } else {
      console.log('  current title is not numbered but needs to be');
      newTitle = marker + numbers[tabIndex] + newTitle;
    }
  }
  if (tabIndex >= MAX_COUNT && tabIndex === visibleTabCount - 1) {
    // Special last tab handling as '9'
    if (newTitle[1] !== numbers[MAX_COUNT]) {
      console.log('  marking last tab as 9');
      newTitle = marker + numbers[MAX_COUNT] + newTitle;
    } else {
      return;
    }
  }
  if (oldTitle !== newTitle) {
    console.log('  oldTitle: ', oldTitle, '; newTitle: ', newTitle);
    tabsWeUpdatedTitle.add(tab.id);
    try {
      browser.tabs.executeScript(
        tab.id,
        {
          code: `document.title = ${JSON.stringify(newTitle)};`
        }
      ).then(result => {
        console.log('  title updated to: ', result);
        if (!result[0]) {
          // Error updating title. Typically from system or official Mozilla tabs that can't be touched.
          console.log("title didn't update. Cleaning out tabsWeUpdatedTitle", result[0], tab.id);
          tabsWeUpdatedTitle.delete(tab.id);
        }
      }, error => {
        // still need to clean out this set
        console.log('error updating title. Cleaning out tabsWeUpdatedTitle', error, tab.id);
        tabsWeUpdatedTitle.delete(tab.id);
      });

      // Come along and clean out any stuff that needs to be cleaned out due to weird browser behavior.
      // Having issues where some tabs don't get the update event, but also don't return at all or error at all
      // Need to clean them out to avoid memory leaks.
      setTimeout(() => {
        console.log('remove from tabsWeUpdatedTitle', tab.id, tabsWeUpdatedTitle);
        tabsWeUpdatedTitle.delete(tab.id);
      }, 500);
      console.log(`  Executed: ${tab.id}`);
    } catch (e) {
      console.log('  Tab numbering error:', e);
    }
  } else {
    console.log('  current title correct: ', oldTitle, '/', newTitle);
  }
}

function onError(error) {
  console.log(`Error: ${error}`);
}

/**
 * Find all visible tabs for a given window and update their titles.
 * @param windowId {number} the Window id to scan and update
 */
function updateAllForWindow(windowId) {
  let querying = browser.tabs.query({ hidden: false, windowId: windowId });
  // let querying = browser.tabs.query({ hidden: false, currentWindow: true });
  querying.then(updateTabs, onError);
}

/**
 * Find all visible tabs in all windows and update their titles.
 */
function updateAllWindows() {
  browser.windows.getAll({ windowTypes: ['normal'] }).then((windows) => {
    for (const window of windows) {
      updateAllForWindow(window.id)
    }
  }, onError);
}

// ==================================================================================
// Set up event handlers

// Listen for opening anchors in new tabs
browser.tabs.onCreated.addListener((tab) => {
  console.log('onCreated(); ', tab);
  let querying = browser.tabs.query({ hidden: false, windowId: tab.windowId });
  querying.then(tabs => {
    // figure out position of new tab and update its title and all to the right that might be affected.
    let newTabIndex = indexOfTab(tabs, tab.id);
    if (newTabIndex + 1 === tabs.length) {
      // Was attached to last position, need to update starting with the prior last position so its '9' gets removed
      newTabIndex--;
    }
    updateSomeTabs(tabs, newTabIndex);
  }, onError);
});

// Listen for tabs being attached (moved) from other windows
browser.tabs.onAttached.addListener((tabId, attachInfo) => {
  console.log('onAttached(); ', tabId, attachInfo);
  let querying = browser.tabs.query({ hidden: false, windowId: attachInfo.newWindowId });
  querying.then(tabs => {
    // figure out position of new tab and update its title and all to the right that might be affected.
    let newTabIndex = indexOfTab(tabs, tabId);
    if (newTabIndex + 1 === tabs.length) {
      // Was attached to last position, need to update starting with the prior last position so its '9' gets removed
      newTabIndex--;
    }
    updateSomeTabs(tabs, newTabIndex);
  }, onError);
});

// Listen for tabs getting detached from a window (as it moves to another) so that the remaining tabs get updated
browser.tabs.onDetached.addListener((tabId, detachInfo) => {
  console.log('onDetached(); ', tabId, detachInfo);
  let querying = browser.tabs.query({ hidden: false, windowId: detachInfo.oldWindowId });
  querying.then(async tabs => {
    // (Assume all tabs accessible by number have already been tagged in their title.)
    // If we don't find a tagged position on the departing tab a few lines down, then we know
    // it was in the "dead zone" between 8 and 9 and only need to refresh the last tab.
    let startIndex = MAX_COUNT;
    let tab = await browser.tabs.get(tabId);
    // But if the departing tab did have a number on it, then we know its index and need to update
    // tabs in that position and to the right.
    if (hasNumberMarker(tab.title)) {
      startIndex = markedIndex(tab.title);
    }
    if (startIndex === MAX_COUNT) {
      // Old tab was in the greater than 8 zone. We only need to update the last tab.
      startIndex = tabs.length - 1;
    }
    updateSomeTabs(tabs, startIndex);
  });
});

// Listen for tabs being moved within a window
browser.tabs.onMoved.addListener((tabId, moveInfo) => {
  console.log('onMoved();');
  // We can't know the old index in the visible list of tabs, so we don't know if it was moved to the right or left.
  // Therefore there is no way to limit which tabs are updated if we are to be compatible with hidden tabs.
  // Run through all.
  updateAllForWindow(moveInfo.windowId);
});

// Listen for tabs being removed
browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Check that the tab has been removed every 100ms
  // Firefox fires onRemoved BEFORE it removes the tab
  const checkTabRemoval = () => {
    browser.tabs.query({ hidden: false, windowId: removeInfo.windowId }, tabs => {
      if (tabs.filter(tab => tab.id === tabId).length === 0)
        updateAllForWindow(removeInfo.windowId);
      else
        setTimeout(checkTabRemoval, 100);
    });
  };

  checkTabRemoval();
});

// Listen for tab updates to titles (i.e. page link navigation)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabsWeUpdatedTitle.has(tabId)) {
    // This event was fired because we updated the title. Don't run through the update check a second time.
    tabsWeUpdatedTitle.delete(tabId);
    console.log("onUpdatedTitle(skip); ", tabsWeUpdatedTitle);
    return;
  }
  let querying = browser.tabs.query({ hidden: false, windowId: tab.windowId });
  querying.then(tabs => {
      let tabIndex = indexOfTab(tabs, tabId);
      console.log('onUpdatedTitle(); ', tabIndex, tabs.length);
      // Update just this tab
      updateTab(tab, tabIndex, tabs.length);
    },
    onError);
}, { properties: ['title'] });

let hideUpdateInProgress = false;

// Listen for tabs getting (un)hidden, e.g. due to Simple Tab Groups extension.
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('onUpdatedHidden();');
  // When switching tab groups, a lot of these events are fired. Ignore all but the first, and then delay update for
  // half a second -- plenty of time for the group switch to finish, but still a human reasonable update delay.
  if (hideUpdateInProgress) {
    return;
  }
  hideUpdateInProgress = true;
  // because we don't know if a tab was moved by Simple Tab Groups or the
  // active group was changed, we need to just blast through everything
  setTimeout(() => {
      updateAllForWindow(tab.windowId);
      hideUpdateInProgress = false;
    },
    500);
}, { properties: ['hidden'] });

/**
 * Get the index of tabId in the list of tabs.
 *
 * @param tabs {array} List of tabs to scan
 * @param tabId {number} Id of tab to find.
 * @returns {number} Index of tab with tabId in tabs
 */
function indexOfTab(tabs, tabId) {
  let tabIndex = 0;
  for (let i = 0; i < tabs.length; i++) {
    if (tabs[i].id === tabId) {
      tabIndex = i;
      break;
    }
  }
  return tabIndex;
}

/**
 * When a user bookmarks a page with the number indicator, the default bookmark title is the page title.
 * Strip the number indicator off the title if it is there when the bookmark is added.
 */
browser.bookmarks.onCreated.addListener((bookmarkId, bookmarkInfo) => {
  if (hasNumberMarker(bookmarkInfo.title)) {
    browser.bookmarks.update(bookmarkId, { title: bookmarkInfo.title.substring(NUMBER_TAG_LEN) });
  }
})

console.log('startup!');
updateAllWindows();
