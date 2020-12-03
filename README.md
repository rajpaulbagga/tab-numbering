# tab-numbering
A Firefox browser extension to add numbers to tab titles corresponding to keyboard shortcuts.

Firefox:
![Screenshot](./screenshot-firefox.png)


This extension writes the tab number to the first eight tabs and the last tab, the ones accessible with <kbd>ctrl</kbd>/<kbd>cmd</kbd> + *number*.

## How to install

- For Firefox: Go to Releases here and download the .xpi file.

## Known issues

- Cannot add numbers to pinned tabs, internal error pages, "new tab" pages or other special tabs.
- Does not remove numbers when uninstalled or deactivated (A subsequent page navigation or reload clears them).