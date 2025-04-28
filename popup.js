document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');
  
  const startButton = document.getElementById('start');
  const stopButton = document.getElementById('stop');
  const clearButton = document.getElementById('clear');
  const smartRefreshButton = document.getElementById('smartRefresh');
  const statusDiv = document.getElementById('status');
  const tabToggle = document.getElementById('tabToggle');

  function updateStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? 'red' : 'green';
  }

  function displayEvents(events) {
    if (!events || events.length === 0) {
      updateStatus('No events were logged');
      return;
    }

    const eventsList = document.createElement('div');
    eventsList.style.marginTop = '10px';
    eventsList.style.maxHeight = '200px';
    eventsList.style.overflowY = 'auto';
    eventsList.style.fontSize = '12px';
    eventsList.style.textAlign = 'left';

    events.forEach(event => {
      const eventDiv = document.createElement('div');
      eventDiv.style.marginBottom = '5px';
      eventDiv.style.padding = '5px';
      eventDiv.style.border = '1px solid #ccc';
      eventDiv.style.borderRadius = '3px';

      const time = new Date(event.timestamp).toLocaleTimeString();
      let eventText = `[${time}] ${event.type.toUpperCase()}: `;

      if (event.type === 'click') {
        eventText += `<${event.element.tag}>`;
        if (event.element.id) eventText += `#${event.element.id}`;
        if (event.element.class) eventText += `.${event.element.class}`;
        if (event.element.text) eventText += ` - "${event.element.text}"`;
      } else if (event.type === 'input') {
        eventText += `<${event.element.tag} type="${event.element.type}">`;
        if (event.element.value) eventText += ` - "${event.element.value}"`;
      }

      eventDiv.textContent = eventText;
      eventsList.appendChild(eventDiv);
    });

    // Remove any existing events list
    const existingList = document.getElementById('events-list');
    if (existingList) {
      existingList.remove();
    }

    eventsList.id = 'events-list';
    document.body.appendChild(eventsList);
  }

  // Load saved events when popup opens
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]) return;
    
    chrome.runtime.sendMessage({
      action: 'getSavedEvents',
      tabId: tabs[0].id
    }, function(response) {
      if (response && response.events) {
        displayEvents(response.events);
        updateStatus('Loaded saved events');
      }
    });
  });

  // Load saved toggle state for current tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]) return;
    
    chrome.storage.local.get(['activeTabs'], function(result) {
      const activeTabs = result.activeTabs || {};
      tabToggle.checked = activeTabs[tabs[0].id] || false;
      
      // Update button states based on toggle
      updateButtonStates(tabToggle.checked);
    });
  });

  function updateButtonStates(isActive) {
    startButton.disabled = !isActive;
    stopButton.disabled = !isActive;
    clearButton.disabled = !isActive;
    smartRefreshButton.disabled = !isActive;
  }

  // Handle toggle changes
  tabToggle.addEventListener('change', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) return;
      
      chrome.storage.local.get(['activeTabs'], function(result) {
        const activeTabs = result.activeTabs || {};
        activeTabs[tabs[0].id] = tabToggle.checked;
        
        chrome.storage.local.set({ activeTabs: activeTabs }, function() {
          console.log('Tab active state updated:', activeTabs);
          updateButtonStates(tabToggle.checked);
          
          if (tabToggle.checked) {
            // Inject content script if toggled on
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['content.js']
            }).catch(err => {
              console.error('Error injecting content script:', err);
            });
          }
        });
      });
    });
  });

  // Modify each button click handler to check if tab is active
  function wrapButtonHandler(handler) {
    return function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) {
          updateStatus('No active tab found', true);
          return;
        }
        
        chrome.storage.local.get(['activeTabs'], function(result) {
          const activeTabs = result.activeTabs || {};
          if (!activeTabs[tabs[0].id]) {
            updateStatus('Extension is not active on this tab', true);
            return;
          }
          
          handler(tabs[0]);
        });
      });
    };
  }

  startButton.addEventListener('click', wrapButtonHandler(function(tab) {
    console.log('Start button clicked');
    chrome.tabs.sendMessage(tab.id, {action: 'startLogging'}, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Error sending startLogging message:', chrome.runtime.lastError);
      } else {
        console.log('Start logging response:', response);
      }
    });
  }));

  stopButton.addEventListener('click', wrapButtonHandler(function(tab) {
    console.log('Stop button clicked');
    chrome.tabs.sendMessage(tab.id, {action: 'stopLogging'}, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Error sending stopLogging message:', chrome.runtime.lastError);
      } else {
        console.log('Stop logging response:', response);
      }
    });
  }));

  clearButton.addEventListener('click', wrapButtonHandler(function(tab) {
    // Clear the events display first
    const existingList = document.getElementById('events-list');
    if (existingList) {
      existingList.remove();
    }
    
    // Send clear message to content script
    chrome.tabs.sendMessage(tab.id, {action: 'clearEvents'}, function(response) {
      if (chrome.runtime.lastError) {
        updateStatus('Error: ' + chrome.runtime.lastError.message, true);
        return;
      }
      
      // Also clear from storage directly to ensure it's cleared
      chrome.storage.local.remove(['savedEvents', 'initialUrl'], function() {
        updateStatus('Events cleared successfully');
      });
    });
  }));

  smartRefreshButton.addEventListener('click', wrapButtonHandler(function(tab) {
    console.log('Refresh button clicked');
    // First inject the content script
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).then(() => {
      console.log('Content script injected successfully');
      // Now send the smart refresh message
      chrome.tabs.sendMessage(tab.id, {action: 'smartRefresh'}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error sending smartRefresh message:', chrome.runtime.lastError);
        } else {
          console.log('Smart refresh response:', response);
        }
      });
    }).catch(err => {
      console.error('Error injecting content script:', err);
    });
  }));
}); 