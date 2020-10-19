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
const number1CodePoint = numbers[0].codePointAt(0);
const number9CodePoint = numbers[numbers.length - 1].codePointAt(0);

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

    const oldTitle = tab.title;
    let newTitle = oldTitle;

    if (!newTitle) {
      console.log('missing title. Bail');
      return;
    }


    // Take out one of these numbers if it already exists in the title
    if (i >= MAX_COUNT && titleContainsIndexIndicator(newTitle)) {
      console.log('stripping number from title outside of range');
      newTitle = newTitle.substring(1);
    }

    if (i < MAX_COUNT) {
      if (numbers[i] === newTitle[0]) {
        console.log("current title correct: ", oldTitle, '/', newTitle)
        continue;
      }
      else if (titleContainsIndexIndicator(newTitle)) {
        console.log("current title is numbered, but wrong");
        newTitle = numbers[i] + newTitle.substring(1);
      }
      else {
        console.log("current title is not numbered but needs to be");
        newTitle = numbers[i] + newTitle;
      }
    }
    if (i >= MAX_COUNT && i == visibleTabs.length - 1) {
      // Special last tab handling as '9'
      if (newTitle[0] != numbers[MAX_COUNT]) {
        newTitle = numbers[MAX_COUNT] + newTitle;
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

function titleContainsIndexIndicator(title) {
  let firstCharCodePoint = title.codePointAt(0);
  return firstCharCodePoint >= number1CodePoint && firstCharCodePoint <= number9CodePoint;
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
  //update(tab);
  console.log('update one tab!');
  updateAll();
});
console.log('startup!');
updateAll();
