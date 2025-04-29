document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');
  
  const startButton = document.getElementById('start');
  const stopButton = document.getElementById('stop');
  const clearButton = document.getElementById('clear');
  const smartRefreshButton = document.getElementById('smartRefresh');
  const statusDiv = document.getElementById('status');
  const flowList = document.getElementById('flowList');
  const refreshFlowButton = document.getElementById('refreshFlow');
  const renameFlowButton = document.getElementById('renameFlow');
  const deleteFlowButton = document.getElementById('deleteFlow');
  const nameFlowModal = document.getElementById('nameFlowModal');
  const flowNameInput = document.getElementById('flowName');
  const saveFlowNameButton = document.getElementById('saveFlowName');
  const cancelFlowNameButton = document.getElementById('cancelFlowName');
  const createNewFlowButton = document.getElementById('createNewFlow');
  const cancelNewFlowButton = document.getElementById('cancelNewFlow');
  const mainButtons = document.querySelector('.main-buttons');

  let currentFlowId = null;
  let flows = {};
  let isCreatingNewFlow = false;

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

  function showMainButtons() {
    mainButtons.style.display = 'block';
    createNewFlowButton.style.display = 'none';
    isCreatingNewFlow = true;
    updateButtonStates();
    chrome.storage.local.set({ isCreatingNewFlow: true });
  }

  function hideMainButtons() {
    mainButtons.style.display = 'none';
    createNewFlowButton.style.display = 'block';
    isCreatingNewFlow = false;
    updateButtonStates();
    chrome.storage.local.set({ isCreatingNewFlow: false });
  }

  function loadFlows() {
    chrome.storage.local.get(['flows', 'isCreatingNewFlow'], function(result) {
      flows = result.flows || {};
      isCreatingNewFlow = result.isCreatingNewFlow || false;
      
      if (isCreatingNewFlow) {
        showMainButtons();
      } else {
        hideMainButtons();
      }
      
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
      hideMainButtons();
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

  function updateButtonStates() {
    const hasSelectedFlow = currentFlowId && flows[currentFlowId];
    refreshFlowButton.disabled = !hasSelectedFlow;
    renameFlowButton.disabled = !hasSelectedFlow;
    deleteFlowButton.disabled = !hasSelectedFlow;
  }

  // Load saved flows and state when popup opens
  loadFlows();

  // Handle create new flow button
  createNewFlowButton.addEventListener('click', function() {
    if (isCreatingNewFlow) {
      hideMainButtons();
    } else {
      showMainButtons();
      updateStatus('Ready to create new flow');
    }
  });

  // Handle cancel new flow button
  cancelNewFlowButton.addEventListener('click', function() {
    hideMainButtons();
    updateStatus('Flow creation cancelled');
  });

  // Handle flow selection
  flowList.addEventListener('change', function() {
    currentFlowId = this.value;
    updateButtonStates();
  });

  // Handle flow refresh
  refreshFlowButton.addEventListener('click', function() {
    if (!currentFlowId || !flows[currentFlowId]) return;
    
    const flow = flows[currentFlowId];
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) return;
      
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      }).then(() => {
        chrome.storage.local.set({
          savedEvents: flow.events,
          initialUrl: flow.initialUrl,
          shouldReplayEvents: true
        }, function() {
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

  // Handle main buttons
  startButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        updateStatus('No active tab found', true);
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, {action: 'startLogging'}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error sending startLogging message:', chrome.runtime.lastError);
        } else {
          console.log('Start logging response:', response);
          updateStatus('Logging started');
        }
      });
    });
  });

  // Handle stop button
  stopButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        updateStatus('No active tab found', true);
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, {action: 'stopLogging'}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error sending stopLogging message:', chrome.runtime.lastError);
        } else {
          console.log('Stop logging response:', response);
          if (response && response.events && response.events.length > 0) {
            showNameFlowModal();
          } else {
            hideMainButtons();
          }
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
      
      chrome.tabs.sendMessage(tabs[0].id, {action: 'clearEvents'}, function(response) {
        if (chrome.runtime.lastError) {
          updateStatus('Error: ' + chrome.runtime.lastError.message, true);
          return;
        }
        
        chrome.storage.local.remove(['savedEvents', 'initialUrl'], function() {
          updateStatus('Events cleared successfully');
        });
      });
    });
  });

  smartRefreshButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs[0]) {
        updateStatus('No active tab found', true);
        return;
      }
      
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      }).then(() => {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'smartRefresh'}, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error sending smartRefresh message:', chrome.runtime.lastError);
          } else {
            console.log('Smart refresh response:', response);
          }
        });
      }).catch(err => {
        console.error('Error injecting content script:', err);
      });
    });
  });
}); 