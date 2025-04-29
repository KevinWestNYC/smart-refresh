// Listen for new tab creation
chrome.tabs.onCreated.addListener(function(tab) {
  console.log('New tab created:', tab.id);
  // Only inject if it's not a restricted page
  if (!tab.url.startsWith('chrome://')) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).catch(err => {
      console.error('Error injecting script into new tab:', err);
    });
  }
});

// Listen for tab updates to inject content script when navigating to non-restricted pages
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && !tab.url.startsWith('chrome://')) {
    console.log('Tab updated, checking for replay flag');
    chrome.storage.local.get(['shouldReplayEvents'], function(result) {
      if (result.shouldReplayEvents) {
        console.log('Replay flag found, injecting content script');
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }).catch(err => {
          console.error('Error injecting script after navigation:', err);
        });
      }
    });
  }
});

// Listen for messages from popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  
  if (message.action === 'startLogging' || message.action === 'stopLogging') {
    if (!message.tabId) {
      console.error('No tabId provided');
      return;
    }
    
    // Get the tab's URL to check if we can inject
    chrome.tabs.get(message.tabId, function(tab) {
      if (!tab) {
        console.error('Tab not found');
        return;
      }
      
      // Check if the URL is injectable (not a chrome:// URL)
      if (tab.url.startsWith('chrome://')) {
        console.error('Cannot inject into chrome:// URLs');
        sendResponse({ error: 'Cannot inject into chrome:// URLs' });
        return;
      }
      
      // Inject content script if needed
      chrome.scripting.executeScript({
        target: { tabId: message.tabId },
        files: ['content.js']
      }).then(() => {
        console.log('Content script injected successfully');
        // Send message to content script
        chrome.tabs.sendMessage(message.tabId, message, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error sending message to content script:', chrome.runtime.lastError);
            return;
          }
          console.log('Response from content script:', response);
          sendResponse(response);
        });
      }).catch(err => {
        console.error('Error injecting script:', err);
        sendResponse({ error: err.message });
      });
    });
    return true; // Keep the message channel open
  }
  else if (message.action === 'refreshTab') {
    console.log('Received refresh request for tab:', sender.tab.id);
    
    // First inject the content script
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      files: ['content.js']
    }, function() {
      if (chrome.runtime.lastError) {
        console.error('Error injecting content script:', chrome.runtime.lastError);
        return;
      }
      
      console.log('Content script injected successfully');
      
      // Then refresh the page
      chrome.tabs.reload(sender.tab.id, {}, function() {
        if (chrome.runtime.lastError) {
          console.error('Error refreshing tab:', chrome.runtime.lastError);
        } else {
          console.log('Tab refreshed successfully');
          
          // Listen for tab update complete
          chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === sender.tab.id && changeInfo.status === 'complete') {
              console.log('Page fully loaded after refresh');
              // Remove the listener to prevent multiple injections
              chrome.tabs.onUpdated.removeListener(listener);
              
              // Only inject if it's not a restricted page
              chrome.tabs.get(sender.tab.id, function(tab) {
                if (!tab.url.startsWith('chrome://')) {
                  chrome.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    files: ['content.js']
                  }, function() {
                    if (chrome.runtime.lastError) {
                      console.error('Error injecting content script after refresh:', chrome.runtime.lastError);
                    } else {
                      console.log('Content script injected after page load');
                    }
                  });
                }
              });
            }
          });
        }
      });
    });
    
    sendResponse({ status: 'refreshing' });
    return true;
  }
}); 