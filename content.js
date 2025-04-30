let isLogging = false;
let loggedEvents = [];
let initialUrl = null;

// Function to load and replay events
function loadAndReplayEvents() {
  console.log('Loading events from storage...');
  chrome.storage.local.get(['savedEvents', 'initialUrl', 'shouldReplayEvents'], function(result) {
    if (result.savedEvents) {
      loggedEvents = result.savedEvents;
      initialUrl = result.initialUrl;
      const shouldReplay = result.shouldReplayEvents || false;
      console.log('Loaded saved events:', loggedEvents);
      console.log('Initial URL:', initialUrl);
      console.log('Should replay events:', shouldReplay);
      
      // Reset retry counts for all events
      loggedEvents.forEach(event => {
        delete event.retryCount;
      });
      
      // Only proceed with replay if shouldReplayEvents is true
      if (shouldReplay) {
        // Reset the flag immediately
        chrome.storage.local.set({ shouldReplayEvents: false }, function() {
          console.log('Reset shouldReplayEvents flag');
        });
        
        // Check if we need to navigate to the initial URL
        if (initialUrl && window.location.href !== initialUrl) {
          console.log('Navigating to initial URL:', initialUrl);
          // Save the events and URL before navigation
          chrome.storage.local.set({ 
            savedEvents: loggedEvents,
            initialUrl: initialUrl,
            shouldReplayEvents: true // Keep this true for the new page
          }, function() {
            console.log('Saved events and URL before navigation');
            window.location.href = initialUrl;
          });
          return;
        }
        
        // Function to start replay after page is ready
        function startReplay() {
          console.log('Page is ready, starting replay');
          setTimeout(() => {
            console.log('Starting event replay after delay');
            replayEvents();
          }, 2000);
        }
        
        // Check if page is already loaded
        if (document.readyState === 'complete') {
          console.log('Page already loaded, starting replay');
          startReplay();
        } else {
          console.log('Waiting for page load before replaying events');
          window.addEventListener('load', function() {
            console.log('Page loaded, starting replay');
            startReplay();
          });
        }
      } else {
        console.log('Event replay not triggered - waiting for smart refresh button');
      }
    } else {
      console.log('No saved events found in storage');
    }
  });
}

// Log when content script is injected
console.log('Content script injected and running');

// Load events when content script is injected
loadAndReplayEvents();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.action === 'startLogging') {
    if (isLogging) {
      console.log('Logging already active');
      sendResponse({ status: 'already_logging' });
      return true;
    }
    
    isLogging = true;
    loggedEvents = []; // Reset events array
    initialUrl = window.location.href; // Save initial URL
    console.log('Starting event logging...');
    console.log('Initial URL saved:', initialUrl);
    
    // Save initial URL to storage
    chrome.storage.local.set({ 
      savedEvents: loggedEvents,
      initialUrl: initialUrl 
    }, function() {
      console.log('Initial URL saved to storage');
    });
    
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
    return true;
  }
  else if (message.action === 'stopLogging') {
    if (!isLogging) {
      console.log('Logging not active');
      sendResponse({ status: 'not_logging' });
      return true;
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
    return true;
  }
  else if (message.action === 'clearEvents') {
    console.log('Clearing events...');
    loggedEvents = [];
    initialUrl = null; // Clear the initial URL
    
    // Remove from storage and send response
    chrome.storage.local.remove(['savedEvents', 'initialUrl'], () => {
      console.log('Events and initial URL cleared from storage');
      sendResponse({ status: 'cleared' });
    });
    
    return true; // Keep the message channel open
  }
  else if (message.action === 'smartRefresh') {
    console.log('Received smart refresh request');
    // Set the flag in storage before refreshing
    chrome.storage.local.set({ shouldReplayEvents: true }, function() {
      console.log('Set shouldReplayEvents flag to true');
      // First load events from storage to ensure we have the latest
      chrome.storage.local.get(['savedEvents', 'initialUrl'], function(result) {
        if (result.savedEvents) {
          loggedEvents = result.savedEvents;
          initialUrl = result.initialUrl;
          console.log('Loaded events for smart refresh:', loggedEvents);
          console.log('Initial URL:', initialUrl);
        }
        
        // Save events and request refresh
        chrome.storage.local.set({ savedEvents: loggedEvents, initialUrl: initialUrl }, function() {
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
      });
    });
    return true;
  }
  
  return true; // Keep the message channel open
});

// Function to find the exact element by class and text
function findElementByClassAndText(className, text) {
  const elements = document.querySelectorAll(`.${className}`);
  const targetText = text.trim().toLowerCase();
  
  for (const element of elements) {
    const elementText = element.textContent.trim().toLowerCase();
    if (elementText === targetText) {
      return element;
    }
  }
  return null;
}

// Function to replay events
function replayEvents() {
  if (!loggedEvents || loggedEvents.length === 0) {
    console.log('No events to replay');
    return;
  }

  console.log('Starting to replay events...');
  let index = 0;
  const MAX_RETRIES = 10;
  const RETRY_DELAY = 1000;
  const FIRST_EVENT_TIMEOUT = 3000; // 3 seconds timeout for first event
  const FIRST_EVENT_RETRY_INTERVAL = 200; // Try every 200ms for first event
  let firstEventStartTime = Date.now();

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
      } else if (event.element.class && event.element.text) {
        element = findElementByClassAndText(event.element.class.split(' ')[0], event.element.text);
      } else if (event.element.class) {
        element = document.querySelector(`.${event.element.class.split(' ')[0]}`);
      } else if (event.element.text) {
        const elements = document.querySelectorAll(event.element.tag);
        const targetText = event.element.text.trim().toLowerCase();
        for (const el of elements) {
          if (el.textContent.trim().toLowerCase() === targetText) {
            element = el;
            break;
          }
        }
      } else {
        element = document.querySelector(event.element.tag);
      }

      if (element) {
        console.log('Clicking element:', element);
        element.click();
        index++;
        // For first event, move to next immediately
        if (index === 1) {
          replayNextEvent();
        } else {
          setTimeout(replayNextEvent, 1000);
        }
      } else {
        console.log('Element not found for click event:', event);
        
        // Special handling for first event
        if (index === 0) {
          const timeElapsed = Date.now() - firstEventStartTime;
          if (timeElapsed < FIRST_EVENT_TIMEOUT) {
            console.log(`Retrying first event in ${FIRST_EVENT_RETRY_INTERVAL}ms (${timeElapsed}ms elapsed)`);
            setTimeout(replayNextEvent, FIRST_EVENT_RETRY_INTERVAL);
            return;
          } else {
            console.log('First event timeout reached, stopping replay');
            return;
          }
        }
        
        // Normal retry handling for other events
        if (event.retryCount === undefined) {
          event.retryCount = 1;
        } else {
          event.retryCount++;
        }
        
        if (event.retryCount <= MAX_RETRIES) {
          console.log(`Retrying event (attempt ${event.retryCount}/${MAX_RETRIES})`);
          setTimeout(replayNextEvent, RETRY_DELAY);
        } else {
          console.log('Max retries reached, stopping replay');
          return;
        }
        return;
      }
    } else if (event.type === 'input') {
      // Find the input element
      let element;
      if (event.element.id) {
        element = document.getElementById(event.element.id);
      } else if (event.element.class) {
        element = document.querySelector(`.${event.element.class.split(' ')[0]}`);
      } else if (event.element.text) {
        // If no class but we have text, try to find by tag + text
        const elements = document.querySelectorAll(`${event.element.tag}[type="${event.element.type}"]`);
        const targetText = event.element.text.trim().toLowerCase();
        for (const el of elements) {
          if (el.value.trim().toLowerCase() === targetText) {
            element = el;
            break;
          }
        }
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
        // Check if we've exceeded max retries
        if (event.retryCount === undefined) {
          event.retryCount = 1;
        } else {
          event.retryCount++;
        }
        
        if (event.retryCount <= MAX_RETRIES) {
          console.log(`Retrying event (attempt ${event.retryCount}/${MAX_RETRIES})`);
          setTimeout(replayNextEvent, RETRY_DELAY);
        } else {
          console.log('Max retries reached, stopping replay');
          return;
        }
        return;
      }
    } else {
      index++;
      setTimeout(replayNextEvent, 1000);
    }
  }

  replayNextEvent();
} 