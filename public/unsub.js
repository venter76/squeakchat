// Function to unsubscribe from push notifications
function unsubscribeFromPush() {
    navigator.serviceWorker.ready
    .then(function(registration) {
        return registration.pushManager.getSubscription();
    })
    .then(function(subscription) {
        if (!subscription) {
            console.log('No active subscription found.');
            return;
        }

        // Here we're assuming the server has an endpoint to handle unsubscriptions
        return fetch('/api/unsubscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(subscription)
        })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Failed to unsubscribe.');
            }
            return response.json();
        })
        .then(function(data) {
            if (data.success) {
                return subscription.unsubscribe();
            } else {
                throw new Error('Server error during unsubscription.');
            }
        })
        .then(function() {
            console.log('Successfully unsubscribed.');
        });
    })
    .catch(function(error) {
        console.error('Failed to unsubscribe:', error);
    });
}

// If you want to immediately call the unsubscribe function when unsub.js loads
// (rather than waiting for a button click), uncomment the line below.
// unsubscribeFromPush();

// If you have a button for unsubscribing in your HTML:
document.getElementById('unsubscribeButton').addEventListener('click', function() {
    unsubscribeFromPush();
});
