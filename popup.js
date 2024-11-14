document.getElementById('startButton').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab.url.startsWith("https://web.vit.ac.in/endfeedback/processStudentLogin")) {
        
        const rating = parseInt(document.getElementById('rating').value, 10);
        const suggestion = document.getElementById('suggestion').value.trim();

        if (isNaN(rating) || rating < 1 || rating > 5) {
            updateStatus("Please enter a valid rating between 1 and 5.");
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        }, () => {
            if (chrome.runtime.lastError) {
                updateStatus("Failed to inject content script.");
                console.error("VIT Feedback Automator:", chrome.runtime.lastError.message);
                return;
            }

            console.log("VIT Feedback Automator: Content script injected.");
            updateStatus("Content script injected. Starting automation...");

            chrome.tabs.sendMessage(tab.id, { 
                action: "startFeedbackAutomation",
                rating: rating,
                suggestion: suggestion
            }, (response) => {
                if (chrome.runtime.lastError) {
                    updateStatus("Content script not loaded. Ensure you're on the feedback processing page.");
                    console.error("VIT Feedback Automator:", chrome.runtime.lastError.message);
                } else {
                    updateStatus("Automation started...");
                    console.log("VIT Feedback Automator: Automation message sent.", response);
                }
            });
        });
    } else {
        updateStatus("Please navigate to the main feedback processing page.");
    }
});

function updateStatus(message) {
    document.getElementById('status').innerText = message;
}
