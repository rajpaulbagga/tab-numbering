/*
 * Title:             tab-numbering.js
 * Description:       Numbers your tabs!
 * Created by:        Tuomas Salo
 * Contributions by:  Austin Moore
 */

'use strict';

const browser = window.browser || window.chrome;

/*
 * Function:     update
 * Description:  Updates a tab to have the desired tab number
 * Parameters:   tab (tabs.Tab)
 *                 - The current tab
 * Returns:      void
 */
const update = visibleTabs => {
  console.log('update(); ', visibleTabs);

  const numbers = ['¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  let tabCount = 9;

  // If we are using Firefox
  if (browser === window.browser)
    tabCount = 8;


  for (var i = 0; i < visibleTabs.length; i++) {
    let tab = visibleTabs[i];

    const oldTitle = tab.title;
    let newTitle = oldTitle;

    if (!newTitle) {
      console.log('missing title. Bail');
      return;
    }


    // Take out one of these numbers if it already exists in the title
    if (i >= tabCount && numbers.includes(newTitle[0])) {
      console.log('stripping number from title outside of range');
      newTitle = newTitle.substring(1);
    }

    if (i < tabCount) {
      if (numbers[i] === newTitle[0]) {
        console.log("current title correct: ", oldTitle, '/', newTitle)
        continue;
      }
      else if (numbers.includes(newTitle[0])) {
        console.log("current title is numbered, but wrong");
        newTitle = numbers[i] + newTitle.substring(1);
      }
      else {
        console.log("current title is not numbered but needs to be");
        newTitle = numbers[i] + newTitle;
      }
    }
    if (browser === window.browser && i >= tabCount && i == visibleTabs.length - 1) {
      if (newTitle[0] != numbers[8]) {
        newTitle = numbers[8] + newTitle;
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
        );
        console.log(`Executed: ${tab.id}`);
      } catch (e) {
        console.log('Tab numbering error:', e);
      }
    }
  }
};

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
  //update(tab);
  console.log('update one tab!');
  updateAll();
});
console.log('startup!');
updateAll();
