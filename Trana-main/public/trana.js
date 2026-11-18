document.addEventListener("DOMContentLoaded", function () {
    var infoText = document.getElementById("locinfo");

    var defaultLat = 12.9141;
    var defaultLon = 74.8560;

    // Store the user's actual GPS coordinates
    var currentLat = null;
    var currentLon = null;
    var hasRealLocation = false;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                currentLat = position.coords.latitude;
                currentLon = position.coords.longitude;
                hasRealLocation = true;

                if (infoText) {
                    infoText.innerText =
                        "Lat: " + currentLat.toFixed(4) +
                        ", Lon: " + currentLon.toFixed(4);
                }

                initializeRescueMap(currentLat, currentLon);
            },
            function () {
                if (infoText) {
                    infoText.innerText =
                        "Location permission unavailable. Showing default map.";
                }

                // Default coordinates are ONLY for map display.
                initializeRescueMap(defaultLat, defaultLon);
            },
            { timeout: 5000, enableHighAccuracy: true }
        );
    } else {
        if (infoText) {
            infoText.innerText =
                "Geolocation is unsupported by this browser.";
        }

        initializeRescueMap(defaultLat, defaultLon);
    }

    function initializeRescueMap(targetLat, targetLon) {
        var map = L.map("map", {
            zoomControl: false
        }).setView([targetLat, targetLon], 15);

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution: "&copy; OpenStreetMap contributors"
            }
        ).addTo(map);

        L.marker([targetLat, targetLon])
            .addTo(map)
            .bindPopup("You are here.")
            .openPopup();

        L.circle([targetLat, targetLon], {
            radius: 500,
            color: "#ff4d4d",
            fillColor: "#ff4d4d",
            fillOpacity: 0.15
        }).addTo(map);
    }

    // Make the SOS function accessible to the HTML button.
    window.soscall = async function () {
        if (!hasRealLocation) {
            alert("Real GPS location is unavailable. Please enable location permission before testing SOS.");
            return;
        }

        // Prototype test confirmation
        var confirmed = confirm(
            "Send a TEST SOS alert with your current GPS location?"
        );

        if (!confirmed) return;

        try {
            var response = await fetch("/api/sos", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: "Trana Test User",
                    lat: currentLat,
                    lng: currentLon
                })
            });

            var result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "SOS request failed");
            }

            alert("Test SOS sent to the connected Trana receiver dashboard!");
            console.log("SOS response:", result);

        } catch (error) {
            console.error("SOS Error:", error);
            alert("Could not send SOS. Check whether the Trana server is running.");
        }
    };
});
