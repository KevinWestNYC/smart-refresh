document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');
  
  const startButton = document.getElementById('start');
  const stopButton = document.getElementById('stop');
  const clearButton = document.getElementById('clear');
  const smartRefreshButton = document.getElementById('smartRefresh');
  const statusDiv = document.getElementById('status');

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

  startButton.addEventListener('click', function() {
    console.log('Start button clicked');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        return;
      }
      
      if (!tabs[0]) {
        console.error('No active tab found');
        return;
      }
      
      console.log('Sending startLogging message to tab:', tabs[0].id);
      chrome.tabs.sendMessage(tabs[0].id, {action: 'startLogging'}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error sending startLogging message:', chrome.runtime.lastError);
        } else {
          console.log('Start logging response:', response);
        }
      });
    });
  });

  stopButton.addEventListener('click', function() {
    console.log('Stop button clicked');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        return;
      }
      
      if (!tabs[0]) {
        console.error('No active tab found');
        return;
      }
      
      console.log('Sending stopLogging message to tab:', tabs[0].id);
      chrome.tabs.sendMessage(tabs[0].id, {action: 'stopLogging'}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error sending stopLogging message:', chrome.runtime.lastError);
        } else {
          console.log('Stop logging response:', response);
        }
      });
    });
  });

  clearButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        updateStatus('No active tab found', true);
        return;
      }
      
      chrome.runtime.sendMessage({
        action: 'clearEvents',
        tabId: tabs[0].id
      }, function(response) {
        if (chrome.runtime.lastError) {
          updateStatus('Error: ' + chrome.runtime.lastError.message, true);
          return;
        }
        updateStatus('Events cleared successfully');
        
        // Clear the events display
        const existingList = document.getElementById('events-list');
        if (existingList) {
          existingList.remove();
        }
      });
    });
  });

  smartRefreshButton.addEventListener('click', function() {
    console.log('Refresh button clicked');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        return;
      }
      
      if (!tabs[0]) {
        console.error('No active tab found');
        return;
      }
      
      console.log('Sending smartRefresh message to tab:', tabs[0].id);
      chrome.tabs.sendMessage(tabs[0].id, {action: 'smartRefresh'}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error sending smartRefresh message:', chrome.runtime.lastError);
        } else {
          console.log('Smart refresh response:', response);
        }
      });
    });
  });
}); 