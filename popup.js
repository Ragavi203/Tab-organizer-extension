console.log('Popup script loaded!');

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded in popup');
  const organizeBtn = document.getElementById('organizeBtn');
  const status = document.getElementById('status');
  
  if (!organizeBtn) {
    console.error('Could not find organize button!');
    return;
  }
  
  console.log('Button found, adding event listener');

  organizeBtn.addEventListener('click', async function() {
    // Disable button and show loading
    organizeBtn.disabled = true;
    organizeBtn.textContent = '🤔 Thinking...';
    status.textContent = 'AI is analyzing your tabs...';

    try {
      // Send message to background script to do the heavy lifting
      const response = await chrome.runtime.sendMessage({
        action: 'organizeTabs'
      });

      if (response.success) {
        status.textContent = `Created ${response.groupCount} groups!`;
        organizeBtn.textContent = '✅ Done!';
        
        // Reset after a few seconds
        setTimeout(() => {
          organizeBtn.disabled = false;
          organizeBtn.textContent = '🧠 Organize My Tabs';
          status.textContent = '';
        }, 3000);
      } else {
        throw new Error(response.error || 'Something went wrong');
      }
    } catch (error) {
      console.error('Error:', error);
      status.textContent = 'Oops! Something went wrong.';
      organizeBtn.disabled = false;
      organizeBtn.textContent = '🧠 Try Again';
    }
  });
});