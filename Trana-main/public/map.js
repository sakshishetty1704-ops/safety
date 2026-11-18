let liveLat = null;
let liveLon = null;
let safetyRing = null;

document.addEventListener("DOMContentLoaded", function() {
    var infoText = document.getElementById('locinfo');

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                liveLat = position.coords.latitude;
                liveLon = position.coords.longitude;

                if (infoText) {
                    infoText.innerText = "Latitude: " + liveLat.toFixed(4) + "\n Longitude: " + liveLon.toFixed(4);
                }

                initializeRescueMap(liveLat, liveLon);
            },
            function(error) {
                console.warn("GPS access blocked by environment settings. Deploying default viewport position.");
                if (infoText) {
                    infoText.innerText = "Mangaluru, India (Default Baseline View)";
                }
                liveLat = 12.9141;
                liveLon = 74.8560;
                initializeRescueMap(liveLat, liveLon);
            }
        );
    } else {
        if (infoText) {
            infoText.innerText = "Geolocation engine is unsupported by this browser client.";
        }
        liveLat = 12.9141;
        liveLon = 74.8560;
        initializeRescueMap(liveLat, liveLon);
    }

    function initializeRescueMap(targetLat, targetLon) {
        var map = L.map('map').setView([targetLat, targetLon], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a>'
        }).addTo(map);

        L.marker([targetLat, targetLon]).addTo(map)
            .bindPopup('Active Crisis Response Zone Target Node')
            .openPopup();

        // Feature 2: 500m Dynamic Risk Ring (Starts Green = Secure)
        safetyRing = L.circle([targetLat, targetLon], {
            radius: 500,
            color: '#22c55e',
            fillColor: '#22c55e',
            fillOpacity: 0.2
        }).addTo(map);
    }
});

// Feature 1 & 2: Save location to MongoDB, dispatch SMS, and shift Risk Ring color
async function soscall() {
    if (liveLat === null || liveLon === null) {
        alert("Waiting for GPS coordinates. Please allow location permission first!");
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('tranaUser')) || {};

    try {
        const res = await fetch('/api/sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id || null,
                name: currentUser.name || 'Prototype User',
                lat: liveLat,
                lng: liveLon
            })
        });

        const data = await res.json();

        if (res.ok) {
            // Update Risk Ring color based on total active incidents in MongoDB
            if (safetyRing) {
                let ringColor = '#22c55e'; // Green
                if (data.incidentCount >= 3) ringColor = '#ef4444'; // Red (Danger)
                else if (data.incidentCount >= 1) ringColor = '#f97316'; // Orange (Caution)

                safetyRing.setStyle({ color: ringColor, fillColor: ringColor });
            }

            alert(` EMERGENCY SOS DISPATCHED!\nSaved GPS (${liveLat.toFixed(4)}, ${liveLon.toFixed(4)}) to nearby houses & routed SMS to Police.`);
        }
    } catch (err) {
        alert("Error sending SOS to server.");
    }
}
