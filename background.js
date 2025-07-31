// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'organizeTabs') {
    organizeTabs()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

async function organizeTabs() {
  try {
    // Hardcoded API key
    const hardcodedKey = 'your claude api key'; //here!
    
    // Get all tabs in current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Skip if too few tabs (no point organizing 2 tabs)
    if (tabs.length < 3) {
      return { success: false, error: 'Need at least 3 tabs to organize!' };
    }

    // Get API key from storage (or use hardcoded)
    const { apiKey } = await chrome.storage.sync.get(['apiKey']);
    const finalApiKey = apiKey || hardcodedKey;
    
    console.log('Final API key length:', finalApiKey.length);
    console.log('About to process', tabs.length, 'tabs');
    
    if (!finalApiKey || finalApiKey === 'YOUR_CLAUDE_API_KEY_HERE') {
      return { success: false, error: 'Please add your Claude API key to the code!' };
    }

    // Prepare tab data for Claude
    const tabData = tabs.map((tab, index) => ({
      index: index,
      id: tab.id,
      title: tab.title,
      url: tab.url,
      pinned: tab.pinned
    }));

    console.log('Calling Claude API with', tabData.length, 'tabs');

    // Call Claude API
    const groups = await callClaudeAPI(tabData, finalApiKey);
    
    console.log('Claude returned', groups.length, 'groups');
    
    // Create the actual tab groups
    await createTabGroups(groups);

    return { success: true, groupCount: groups.length };
    
  } catch (error) {
    console.error('Error organizing tabs:', error);
    return { success: false, error: error.message };
  }
}

async function callClaudeAPI(tabData, apiKey) {
  console.log('About to call Claude API...');
  
  const prompt = `Analyze these browser tabs and group them by topic/purpose. Return ONLY a JSON array of groups.

Tab data:
${tabData.map(tab => `${tab.index}: "${tab.title}" (${tab.url})`).join('\n')}

Return format:
[
  {
    "name": "Work Stuff",
    "color": "blue",
    "tabIds": [0, 3, 7]
  },
  {
    "name": "Shopping",
    "color": "red", 
    "tabIds": [1, 4]
  }
]

Rules:
- Skip pinned tabs
- Group similar topics together
- Use colors: blue, red, yellow, green, pink, purple, cyan, orange
- Keep group names short and descriptive
- Minimum 2 tabs per group
- Maximum 8 groups total`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  console.log('Claude API response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', errorText);
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.content[0].text;
  
  console.log('Claude response:', content);
  
  // Parse JSON from Claude's response
  try {
    return JSON.parse(content);
  } catch (e) {
    // Sometimes Claude wraps JSON in markdown, let's try to extract it
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse Claude response: ' + content);
  }
}

async function createTabGroups(groups) {
  const colors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
  
  for (const group of groups) {
    if (group.tabIds && group.tabIds.length >= 2) {
      // Get actual tab IDs
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const tabIds = group.tabIds.map(index => tabs[index]?.id).filter(id => id);
      
      console.log('Creating group:', group.name, 'with tabs:', tabIds);
      
      if (tabIds.length >= 2) {
        // Create the group
        const groupId = await chrome.tabs.group({ tabIds });
        
        // Update group properties
        await chrome.tabGroups.update(groupId, {
          title: group.name,
          color: colors.includes(group.color) ? group.color : 'blue'
        });
      }
    }
  }
}
