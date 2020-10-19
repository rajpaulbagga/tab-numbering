/*
 * Title:             tab-numbering.js
 * Description:       Numbers your tabs!
 * Created by:        Tuomas Salo
 * Contributions by:  Austin Moore
 */

'use strict';

const browser = window.browser || window.chrome;
const MAX_COUNT = 8; // Max tab that can be accessed this way, apart from special 9 handling as last tab.

const numbers = ['¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
const numberSet = new Set(numbers)

/*
 * Function:     update
 * Description:  Updates a tab to have the desired tab number
 * Parameters:   tab (tabs.Tab)
 *                 - The current tab
 * Returns:      void
 */
const update = visibleTabs => {
  console.log('update(); ', visibleTabs);

  for (var i = 0; i < visibleTabs.length; i++) {
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
  if (tabIndex >= MAX_COUNT && numberSet.has(newTitle[0]) && (tabIndex != visibleTabCount - 1 || newTitle[0] != numbers[MAX_COUNT]) ) {
    console.log('stripping number from title outside of range');
    newTitle = newTitle.substring(1);
  }

  if (tabIndex < MAX_COUNT) {
    if (numbers[tabIndex] === newTitle[0]) {
      console.log("current title correct: ", oldTitle, '/', newTitle)
      return;
    }
    else if (numberSet.has(newTitle[0])) {
      console.log("current title is numbered, but wrong");
      newTitle = numbers[tabIndex] + newTitle.substring(1);
    }
    else {
      console.log("current title is not numbered but needs to be");
      newTitle = numbers[tabIndex] + newTitle;
    }
  }
  if (tabIndex >= MAX_COUNT && tabIndex == visibleTabCount - 1) {
    // Special last tab handling as '9'
    if (newTitle[0] != numbers[MAX_COUNT]) {
      newTitle = numbers[MAX_COUNT] + newTitle;
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
      console.log(`Executed: ${tab.id}`);
    } catch (e) {
      console.log('Tab numbering error:', e);
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
browser.tabs.onAttached.addListener(updateAll);

// Must listen for tabs being moved
browser.tabs.onMoved.addListener(updateAll);

// Must listen for tabs being removed
browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  /* Check that the tab has been removed every 100ms
     Firefox fires onRemoved BEFORE it removes the tab */
  const checkTabRemoval = () => {
    browser.tabs.query({}, tabs => {
      if (tabs.filter(tab => tab.id === tabId).length === 0)
        updateAll();
      else
        setTimeout(checkTabRemoval, 100);
    });
  };

  checkTabRemoval();
});

// Must listen for tab updates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  let querying = browser.tabs.query({ hidden: false, currentWindow: true });
  let visibleTabCount = 0;
  let tabIndex = 0;
  querying.then(tabs => {
    visibleTabCount = tabs.length;
    for (var i = 0; i < visibleTabCount; i++) {
      if (tabs[i].id == tabId) {
        tabIndex = i;
        break;
      }
    }
    console.log('update one tab!', tabIndex, visibleTabCount);
    updateTab(tab, tabIndex, visibleTabCount);
    }, onError)
});
console.log('startup!');
updateAll();
