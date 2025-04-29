document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');
  
  const startButton = document.getElementById('start');
  const stopButton = document.getElementById('stop');
  const clearButton = document.getElementById('clear');
  const smartRefreshButton = document.getElementById('smartRefresh');
  const statusDiv = document.getElementById('status');
  const tabToggle = document.getElementById('tabToggle');
  const flowList = document.getElementById('flowList');
  const refreshFlowButton = document.getElementById('refreshFlow');
  const renameFlowButton = document.getElementById('renameFlow');
  const deleteFlowButton = document.getElementById('deleteFlow');
  const nameFlowModal = document.getElementById('nameFlowModal');
  const flowNameInput = document.getElementById('flowName');
  const saveFlowNameButton = document.getElementById('saveFlowName');
  const cancelFlowNameButton = document.getElementById('cancelFlowName');

  let currentFlowId = null;
  let flows = {};

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

    const existingList = document.getElementById('events-list');
    if (existingList) {
      existingList.remove();
    }

    eventsList.id = 'events-list';
    document.body.appendChild(eventsList);
  }

  function showNameFlowModal() {
    nameFlowModal.style.display = 'block';
    flowNameInput.value = '';
    flowNameInput.focus();
  }

  function hideNameFlowModal() {
    nameFlowModal.style.display = 'none';
  }

  function loadFlows() {
    chrome.storage.local.get(['flows'], function(result) {
      flows = result.flows || {};
      updateFlowList();
    });
  }

  function updateFlowList() {
    flowList.innerHTML = '';
    Object.entries(flows).forEach(([id, flow]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = flow.name;
      flowList.appendChild(option);
    });
    
    if (currentFlowId && flows[currentFlowId]) {
      flowList.value = currentFlowId;
    }
  }

  function saveFlow(name, events, initialUrl) {
    const flowId = Date.now().toString();
    const newFlow = {
      name,
      events,
      initialUrl,
      timestamp: new Date().toISOString()
    };
    
    flows[flowId] = newFlow;
    chrome.storage.local.set({ flows }, function() {
      console.log('Flow saved:', newFlow);
      currentFlowId = flowId;
      updateFlowList();
      updateStatus('Flow saved successfully');
    });
  }

  function deleteFlow(flowId) {
    if (!flows[flowId]) return;
    
    delete flows[flowId];
    chrome.storage.local.set({ flows }, function() {
      console.log('Flow deleted:', flowId);
      if (currentFlowId === flowId) {
        currentFlowId = null;
      }
      updateFlowList();
      updateStatus('Flow deleted successfully');
    });
  }

  function renameFlow(flowId, newName) {
    if (!flows[flowId]) return;
    
    flows[flowId].name = newName;
    chrome.storage.local.set({ flows }, function() {
      console.log('Flow renamed:', flowId, newName);
      updateFlowList();
      updateStatus('Flow renamed successfully');
    });
  }

  // Load saved flows when popup opens
  loadFlows();

  // Load saved toggle state for current tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]) return;
    
    chrome.storage.local.get(['activeTabs'], function(result) {
      const activeTabs = result.activeTabs || {};
      tabToggle.checked = activeTabs[tabs[0].id] || false;
      updateButtonStates(tabToggle.checked);
    });
  });

  function updateButtonStates(isActive) {
    startButton.disabled = !isActive;
    stopButton.disabled = !isActive;
    clearButton.disabled = !isActive;
    smartRefreshButton.disabled = !isActive;
    refreshFlowButton.disabled = !isActive || !currentFlowId;
    renameFlowButton.disabled = !isActive || !currentFlowId;
    deleteFlowButton.disabled = !isActive || !currentFlowId;
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

  // Handle flow selection
  flowList.addEventListener('change', function() {
    currentFlowId = this.value;
    updateButtonStates(tabToggle.checked);
  });

  // Handle flow refresh
  refreshFlowButton.addEventListener('click', function() {
    if (!currentFlowId || !flows[currentFlowId]) return;
    
    const flow = flows[currentFlowId];
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) return;
      
      // First inject the content script
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      }).then(() => {
        // Save the flow data to storage
        chrome.storage.local.set({
          savedEvents: flow.events,
          initialUrl: flow.initialUrl,
          shouldReplayEvents: true
        }, function() {
          // Send the smart refresh message
          chrome.tabs.sendMessage(tabs[0].id, {action: 'smartRefresh'}, function(response) {
            if (chrome.runtime.lastError) {
              console.error('Error sending smartRefresh message:', chrome.runtime.lastError);
            } else {
              console.log('Smart refresh response:', response);
            }
          });
        });
      }).catch(err => {
        console.error('Error injecting content script:', err);
      });
    });
  });

  // Handle flow rename
  renameFlowButton.addEventListener('click', function() {
    if (!currentFlowId || !flows[currentFlowId]) return;
    flowNameInput.value = flows[currentFlowId].name;
    showNameFlowModal();
  });

  // Handle flow delete
  deleteFlowButton.addEventListener('click', function() {
    if (!currentFlowId || !flows[currentFlowId]) return;
    if (confirm('Are you sure you want to delete this flow?')) {
      deleteFlow(currentFlowId);
    }
  });

  // Handle modal buttons
  saveFlowNameButton.addEventListener('click', function() {
    const name = flowNameInput.value.trim();
    if (!name) {
      updateStatus('Please enter a name', true);
      return;
    }
    
    if (currentFlowId && flows[currentFlowId]) {
      renameFlow(currentFlowId, name);
    } else {
      // This should only happen after stopping logging
      chrome.storage.local.get(['savedEvents', 'initialUrl'], function(result) {
        if (result.savedEvents && result.initialUrl) {
          saveFlow(name, result.savedEvents, result.initialUrl);
        } else {
          updateStatus('No events to save', true);
        }
      });
    }
    
    hideNameFlowModal();
  });

  cancelFlowNameButton.addEventListener('click', hideNameFlowModal);

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
        if (response && response.events && response.events.length > 0) {
          showNameFlowModal();
        }
      }
    });
  }));

  clearButton.addEventListener('click', wrapButtonHandler(function(tab) {
    const existingList = document.getElementById('events-list');
    if (existingList) {
      existingList.remove();
    }
    
    chrome.tabs.sendMessage(tab.id, {action: 'clearEvents'}, function(response) {
      if (chrome.runtime.lastError) {
        updateStatus('Error: ' + chrome.runtime.lastError.message, true);
        return;
      }
      
      chrome.storage.local.remove(['savedEvents', 'initialUrl'], function() {
        updateStatus('Events cleared successfully');
      });
    });
  }));

  smartRefreshButton.addEventListener('click', wrapButtonHandler(function(tab) {
    console.log('Refresh button clicked');
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).then(() => {
      console.log('Content script injected successfully');
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