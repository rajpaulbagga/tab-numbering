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

const invisibleSep = '\u2063';  // Invisible Separator
const marker = invisibleSep;

const numbers = ['¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
const numToIndex = new Map();
for (let i = 0; i < numbers.length; i++) {
  numToIndex.set(numbers[i], i);
}

function hasNumberMarker(value) {
  return value.length > NUMBER_TAG_LEN && value[0] === marker;
}
function markedIndex(value) {
  return numToIndex.get(value[1]);
}

/*
 * Function:     update
 * Description:  Updates a tab to have the desired tab number
 * Parameters:   tab (tabs.Tab)
 *                 - The current tab
 * Returns:      void
 */
const update = visibleTabs => {
  console.log('update(); ', visibleTabs);

  updateSome(visibleTabs, 0);
};

const updateSome = (visibleTabs, startIndex) => {
  console.log('updateSome(); ', startIndex, visibleTabs);

  for (let i = startIndex; i < visibleTabs.length; i++) {
    let tab = visibleTabs[i];
    updateTab(tab, i, visibleTabs.length);
  }
};

function updateTab(tab, tabIndex, visibleTabCount) {
  const oldTitle = tab.title;
  let newTitle = oldTitle;

  if (!newTitle) {
    console.log('missing title. Bail');
    return;
  }


  // Take out one of these numbers if it already exists in the title
  if (tabIndex >= MAX_COUNT && hasNumberMarker(newTitle)
      && (tabIndex !== visibleTabCount - 1 || newTitle[1] !== numbers[MAX_COUNT]) ) {
    console.log('  stripping number from title outside of range');
    newTitle = newTitle.substring(NUMBER_TAG_LEN);
  }

  if (tabIndex < MAX_COUNT) {
    if (numbers[tabIndex] === newTitle[1]) {
      console.log('  current title correct: ', oldTitle, '/', newTitle);
      return;
    }
    else if (hasNumberMarker(newTitle)) {
      console.log('  current title is numbered, but wrong');
      newTitle = marker + numbers[tabIndex] + newTitle.substring(NUMBER_TAG_LEN);
    }
    else {
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
  console.log('  oldTitle: ', oldTitle, '; newTitle: ', newTitle);
  if (oldTitle !== newTitle) {
    try {
      browser.tabs.executeScript(
        tab.id,
        {
          code: `document.title = ${JSON.stringify(newTitle)};`
        }
      ).catch(onError);
      console.log(`  Executed: ${tab.id}`);
    } catch (e) {
      console.log('  Tab numbering error:', e);
    }
  }
}

function onError(error) {
  console.log(`Error: ${error}`);
}

/*
 * Function:     updateAll
 * Description:  Updates all tabs to have the desired tab numbers
 * Parameters:   void
 * Returns:      void
 */
const updateAll = () => {
  let querying = browser.tabs.query({ hidden: false, currentWindow: true });
  querying.then(update, onError);
};

// Must listen for opening anchors in new tabs
browser.tabs.onCreated.addListener(updateAll);

// Must listen for tabs being attached from other windows
// browser.tabs.onAttached.addListener(updateAll);
browser.tabs.onAttached.addListener((tabId, attachInfo) => {
  console.log('onAttached(); ', tabId, attachInfo);
  let querying = browser.tabs.query({ hidden: false, windowId: attachInfo.newWindowId });
  querying.then(tabs => {
    let newTabIndex = indexOfTab(tabs, tabId);
    if (newTabIndex + 1 === tabs.length) {
      // Was attached to last position, need to update starting with the prior last position so its '9' gets removed
      newTabIndex--;
    }
    updateSome(tabs, newTabIndex);
  });
});

browser.tabs.onDetached.addListener((tabId, detachInfo) => {
  console.log('onDetached(); ', tabId, detachInfo);
  let querying = browser.tabs.query({ hidden: false, windowId: detachInfo.oldWindowId });
  querying.then(async tabs => {
    let startIndex = 0;
    let tab = await browser.tabs.get(tabId);
    if (hasNumberMarker(tab.title)) {
      startIndex = markedIndex(tab.title);
    }
    updateSome(tabs, startIndex);
  });
});

// Must listen for tabs being moved
browser.tabs.onMoved.addListener((tabId, moveInfo) => {
  console.log('onMoved();');
  updateAll();
});

// Must listen for tabs being removed
browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  /* Check that the tab has been removed every 100ms
     Firefox fires onRemoved BEFORE it removes the tab */
  const checkTabRemoval = () => {
    browser.tabs.query({ hidden: false, windowId: removeInfo.windowId }, tabs => {
      if (tabs.filter(tab => tab.id === tabId).length === 0)
        updateAll();
      else
        setTimeout(checkTabRemoval, 100);
    });
  };

  checkTabRemoval();
});

// Must listen for tab updates to titles
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  let querying = browser.tabs.query({ hidden: false, windowId: tab.windowId });
  querying.then(tabs => {
      let tabIndex = indexOfTab(tabs, tabId);
      console.log('onUpdated(); ', tabIndex, tabs.length);
      updateTab(tab, tabIndex, tabs.length);
    },
    onError);
}, { properties: ['title'] });

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('onUpdatedHidden();');
  // because we don't know if a tab was moved by Simple Tab Groups or the
  // active group was changed, we need to just blast through everything
  updateAll();
}, { properties: ['hidden'] });

/**
 * Get the index of tabId in the list of tabs.
 *
 * @param tabs List of tabs to scan
 * @param tabId Id of tab to find.
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

console.log('startup!');
updateAll();
