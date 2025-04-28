let isLogging = false;
let loggedEvents = [];

// Function to load and replay events
function loadAndReplayEvents() {
  console.log('Loading events from storage...');
  chrome.storage.local.get(['savedEvents'], function(result) {
    if (result.savedEvents) {
      loggedEvents = result.savedEvents;
      console.log('Loaded saved events:', loggedEvents);
      
      // Wait for page to be fully loaded before replaying events
      if (document.readyState === 'complete') {
        console.log('Page already loaded, replaying events immediately');
        replayEvents();
      } else {
        console.log('Waiting for page load before replaying events');
        window.addEventListener('load', function() {
          console.log('Page loaded, starting event replay');
          replayEvents();
        });
      }
    } else {
      console.log('No saved events found in storage');
    }
  });
}

// Load events when content script is injected
loadAndReplayEvents();

// Log when content script is injected
console.log('Content script injected and running');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.action === 'startLogging') {
    if (isLogging) {
      console.log('Logging already active');
      sendResponse({ status: 'already_logging' });
      return;
    }
    
    isLogging = true;
    loggedEvents = []; // Reset events array
    console.log('Starting event logging...');
    
    // Log clicks
    document.addEventListener('click', function(event) {
      if (!isLogging) return;
      
      const target = event.target;
      const eventData = {
        type: 'click',
        timestamp: new Date().toISOString(),
        element: {
          tag: target.tagName,
          id: target.id || '',
          class: target.className || '',
          text: target.textContent.trim().substring(0, 50) // Limit text length
        }
      };
      
      console.log('Click event:', eventData);
      loggedEvents.push(eventData);
      
      // Save events to storage after each event
      chrome.storage.local.set({ savedEvents: loggedEvents }, function() {
        console.log('Events saved to storage');
      });
    }, true);
    
    // Log input changes
    document.addEventListener('input', function(event) {
      if (!isLogging) return;
      
      const target = event.target;
      const eventData = {
        type: 'input',
        timestamp: new Date().toISOString(),
        element: {
          tag: target.tagName,
          type: target.type || '',
          value: target.value.substring(0, 100) // Limit value length
        }
      };
      
      console.log('Input event:', eventData);
      loggedEvents.push(eventData);
      
      // Save events to storage after each event
      chrome.storage.local.set({ savedEvents: loggedEvents }, function() {
        console.log('Events saved to storage');
      });
    }, true);
    
    sendResponse({ status: 'started' });
  }
  else if (message.action === 'stopLogging') {
    if (!isLogging) {
      console.log('Logging not active');
      sendResponse({ status: 'not_logging' });
      return;
    }
    
    isLogging = false;
    console.log('Stopping event logging...');
    
    // Save final events to storage
    chrome.storage.local.set({ savedEvents: loggedEvents }, function() {
      console.log('Final events saved to storage');
    });
    
    // Send the collected events
    sendResponse({ 
      status: 'stopped',
      events: loggedEvents
    });
  }
  else if (message.action === 'clearEvents') {
    loggedEvents = [];
    chrome.storage.local.remove('savedEvents', function() {
      console.log('Events cleared from storage');
      sendResponse({ status: 'cleared' });
    });
    return true;
  }
  else if (message.action === 'smartRefresh') {
    console.log('Received smart refresh request');
    // Save events and request refresh
    chrome.storage.local.set({ savedEvents: loggedEvents }, function() {
      console.log('Events saved before refresh');
      // Send response before refreshing
      sendResponse({ status: 'refreshing' });
      // Request the background script to refresh the tab
      chrome.runtime.sendMessage({ action: 'refreshTab' }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error sending refresh request:', chrome.runtime.lastError);
        } else {
          console.log('Refresh request sent successfully');
        }
      });
    });
    return true;
  }
  
  return true; // Keep the message channel open
});

// Function to replay events
function replayEvents() {
  if (!loggedEvents || loggedEvents.length === 0) {
    console.log('No events to replay');
    return;
  }

  console.log('Starting to replay events...');
  let index = 0;

  function replayNextEvent() {
    if (index >= loggedEvents.length) {
      console.log('Finished replaying events');
      return;
    }

    const event = loggedEvents[index];
    console.log('Replaying event:', event);

    if (event.type === 'click') {
      // Find the element to click
      let element;
      if (event.element.id) {
        element = document.getElementById(event.element.id);
      } else if (event.element.class) {
        element = document.querySelector(`.${event.element.class.split(' ')[0]}`);
      } else {
        element = document.querySelector(event.element.tag);
      }

      if (element) {
        console.log('Clicking element:', element);
        // Add a small delay before clicking
        setTimeout(() => {
          element.click();
          // Move to next event after click
          index++;
          setTimeout(replayNextEvent, 1000);
        }, 500);
      } else {
        console.log('Element not found for click event:', event);
        // Move to next event even if element not found
        index++;
        setTimeout(replayNextEvent, 500);
      }
    } else if (event.type === 'input') {
      // Find the input element
      let element;
      if (event.element.id) {
        element = document.getElementById(event.element.id);
      } else if (event.element.class) {
        element = document.querySelector(`.${event.element.class.split(' ')[0]}`);
      } else {
        element = document.querySelector(`${event.element.tag}[type="${event.element.type}"]`);
      }

      if (element) {
        console.log('Setting input value:', event.element.value);
        // Add a small delay before setting input
        setTimeout(() => {
          element.value = event.element.value;
          // Trigger input event to ensure any listeners are notified
          element.dispatchEvent(new Event('input', { bubbles: true }));
          // Move to next event after input
          index++;
          setTimeout(replayNextEvent, 1000);
        }, 500);
      } else {
        console.log('Element not found for input event:', event);
        // Move to next event even if element not found
        index++;
        setTimeout(replayNextEvent, 500);
      }
    } else {
      // Move to next event for unknown event types
      index++;
      setTimeout(replayNextEvent, 500);
    }
  }

  // Add initial delay before starting to replay events
  console.log('Waiting 2 seconds before starting event replay...');
  setTimeout(() => {
    console.log('Starting event replay after initial delay');
    replayNextEvent();
  }, 2000);
} 