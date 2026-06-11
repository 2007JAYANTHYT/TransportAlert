// Firebase Configuration (From google-services.json)
const firebaseConfig = {
    apiKey: "AIzaSyA4zVRhNid7LJmDYJCEcAH8xfmD55k1SrI",
    projectId: "transportalert-91d28",
    storageBucket: "transportalert-91d28.firebasestorage.app",
    databaseURL: "https://transportalert-91d28-default-rtdb.firebaseio.com"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const app = {
    currentScreen: 'login-screen',
    user: null,
    confirmationResult: null,
    map: null,
    markers: [],
    issues: [],
    userLat: null,
    userLng: null,
    notifiedIssues: new Set(),
    isVerifying: false,
    userMarker: null,

    init() {
        // Firebase Auth State Listener
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                this.user = user;
                
                // If we are playing the verification animation, don't interrupt it.
                if (this.isVerifying) return;
                
                // User is signed in, go to home
                document.getElementById('loading-screen').style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('loading-screen').classList.add('hidden');
                    document.getElementById('app').classList.remove('hidden');
                    this.navigate('home-screen');
                    this.loadIssues();
                }, 500);
            } else {
                this.user = null;
                // No user is signed in, show login
                document.getElementById('loading-screen').style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('loading-screen').classList.add('hidden');
                    document.getElementById('app').classList.remove('hidden');
                    this.navigate('login-screen');
                    this.setupRecaptcha();
                }, 500);
            }
        });
        // Request Notification Permission for Geofencing
        if ("Notification" in window && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
        
        // Handle loading screen
        setTimeout(() => {
            document.getElementById('loading-screen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('app').classList.remove('hidden');
                this.loadIssues();
            }, 500);
        }, 3000); // 3 seconds loading animation

        // Event listeners for forms
        document.getElementById('report-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitReport();
        });
    },

    setupRecaptcha() {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                'size': 'invisible',
                'callback': (response) => {
                    // reCAPTCHA solved
                }
            });
        }
    },

    async sendOTP() {
        // Keep ONLY digits, removing any stray +, -, or spaces they might have typed
        let phoneNumber = document.getElementById('phone-number').value.replace(/\D/g, ''); 
        
        // If they accidentally typed the 91 country code again, strip it
        if (phoneNumber.startsWith('91') && phoneNumber.length > 10) {
            phoneNumber = phoneNumber.substring(2);
        }
        
        // If they typed a leading 0, strip it
        if (phoneNumber.startsWith('0') && phoneNumber.length > 10) {
            phoneNumber = phoneNumber.substring(1);
        }
        
        if (!phoneNumber || phoneNumber.length < 10) {
            this.showError("Please enter a valid 10-digit mobile number.");
            return;
        }
        
        // Auto-append +91 country code safely
        const fullPhoneNumber = "+91" + phoneNumber;
        
        const appVerifier = window.recaptchaVerifier;
        const btn = document.getElementById('send-otp-btn');
        btn.innerText = "Sending...";
        btn.disabled = true;

        try {
            this.confirmationResult = await firebase.auth().signInWithPhoneNumber(fullPhoneNumber, appVerifier);
            // Hide phone input, show OTP input
            document.getElementById('phone-input-step').classList.add('hidden');
            document.getElementById('otp-input-step').classList.remove('hidden');
            document.querySelectorAll('.otp-box')[0].focus();
        } catch (error) {
            console.error("SMS not sent", error);
            alert("Error sending OTP: " + error.message);
            btn.innerText = "Send OTP";
            btn.disabled = false;
        }
    },

    otpInput(currentInput, nextInputIndex) {
        // Enforce numeric only (from the screenshot logic)
        if (!/^[0-9]$/.test(currentInput.value)) {
            currentInput.value = "";
            return;
        }
        
        if (currentInput.value.length === 1 && nextInputIndex) {
            document.querySelectorAll('.otp-box')[nextInputIndex].focus();
        }
    },

    otpBackspace(e, currentInput, prevInputIndex) {
        if (e.key === "Backspace" && currentInput.value === "" && prevInputIndex !== null) {
            document.querySelectorAll('.otp-box')[prevInputIndex].focus();
        }
    },

    showError(msg) {
        const toast = document.getElementById('error-toast');
        toast.innerText = msg;
        toast.classList.remove('hidden');
        // Small delay to allow display:block to apply before animating transform
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 500); // Wait for exit animation
        }, 3000);
    },

    async verifyOTP() {
        const inputs = document.querySelectorAll('.otp-box');
        let code = "";
        inputs.forEach(input => code += input.value);

        if (code.length !== 6) {
            this.showError("Please enter a valid 6-digit OTP.");
            return;
        }

        const btn = document.getElementById('verify-otp-btn');
        btn.innerText = "Checking OTP...";
        btn.disabled = true;
        this.isVerifying = true; // Block onAuthStateChanged from routing instantly

        try {
            // Fake 3-second delay to make it look like a deep check
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            await this.confirmationResult.confirm(code);
            // Success! Trigger new "joining boxes and tick mark" animation
            const container = document.querySelector('.otp-container');
            container.classList.add('verified');
            
            // Wait 1.5s for the animation to finish, then route manually
            setTimeout(() => {
                document.getElementById('phone-number').value = "";
                inputs.forEach(input => input.value = "");
                container.classList.remove('verified');
                this.resetLogin();
                
                // Manually trigger the home route now that animation is done
                this.isVerifying = false;
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('app').classList.remove('hidden');
                this.navigate('home-screen');
                this.loadIssues();
            }, 1500);
            
        } catch (error) {
            console.error("OTP verification failed", error);
            
            // Clear the OTP boxes and shake them or just show error
            inputs.forEach(input => input.value = "");
            inputs[0].focus(); // auto-focus back to first box
            
            this.showError("❌ Incorrect OTP. Please try again.");
            btn.innerText = "Verify OTP";
            btn.disabled = false;
            this.isVerifying = false;
        }
    },

    resetLogin() {
        document.getElementById('phone-input-step').classList.remove('hidden');
        document.getElementById('otp-input-step').classList.add('hidden');
        const btn = document.getElementById('send-otp-btn');
        btn.innerText = "Send OTP";
        btn.disabled = false;
    },

    logout() {
        firebase.auth().signOut().then(() => {
            this.navigate('login-screen');
        });
    },

    navigate(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        // Update nav items
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        // Hide bottom nav on login screen
        const bottomNav = document.querySelector('.bottom-nav');
        if (screenId === 'login-screen') {
            bottomNav.style.display = 'none';
        } else {
            bottomNav.style.display = 'flex';
        }
        
        // Hide navbar entirely on the map screen for true full screen
        const navbar = document.querySelector('.navbar');
        if (screenId === 'map-screen' || screenId === 'login-screen') {
            navbar.style.display = 'none';
        } else {
            navbar.style.display = 'block';
        }
        
        // Show target screen
        document.getElementById(screenId).classList.add('active');
        
        // Update bottom nav active state based on screen
        if (screenId === 'home-screen') document.querySelectorAll('.nav-item')[0].classList.add('active');
        if (screenId === 'map-screen') {
            document.querySelectorAll('.nav-item')[1].classList.add('active');
            // Show the map loader
            const mapLoader = document.getElementById('map-loader');
            if (mapLoader) {
                mapLoader.classList.remove('fade-out');
                mapLoader.style.display = 'flex';
            }
            this.initMap();
            setTimeout(() => {
                if (this.map) this.map.invalidateSize();
                // Fade out map loader after map renders
                if (mapLoader) {
                    mapLoader.classList.add('fade-out');
                    setTimeout(() => { mapLoader.style.display = 'none'; }, 500);
                }
            }, 1500);
        }
        if (screenId === 'report-screen') {
            document.querySelectorAll('.nav-item')[2].classList.add('active');
            this.initReportMap(); // Initialize report picker map
        }
        if (screenId === 'solutions-screen') document.querySelectorAll('.nav-item')[3].classList.add('active');
        
        this.currentScreen = screenId;
    },

    reportMap: null,
    reportMarker: null,

    initReportMap() {
        // If not initialized, initialize it
        if (!this.reportMap) {
            // Default center
            const center = [12.9716, 77.5946];
            this.reportMap = L.map('report-map').setView(center, 13);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(this.reportMap);

            // Add draggable marker
            this.reportMarker = L.marker(center, { draggable: true }).addTo(this.reportMap);
            
            // Set initial hidden inputs
            document.getElementById('r-lat').value = center[0];
            document.getElementById('r-lng').value = center[1];

            // Update inputs when dragged
            this.reportMarker.on('dragend', (event) => {
                const position = event.target.getLatLng();
                document.getElementById('r-lat').value = position.lat;
                document.getElementById('r-lng').value = position.lng;
                document.getElementById('r-location-text').innerText = `Manually Set: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`;
                document.getElementById('r-location-text').style.color = 'var(--primary-color)';
            });
        }
        
        // Invalidate size to fix rendering in hidden div
        setTimeout(() => {
            if (this.reportMap) this.reportMap.invalidateSize();
        }, 100);
    },

    getLocation() {
        if (navigator.geolocation) {
            document.getElementById('r-location-text').innerText = "Fetching precise location...";
            document.getElementById('r-location-text').style.color = "var(--primary-color)";
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    document.getElementById('r-lat').value = position.coords.latitude;
                    document.getElementById('r-lng').value = position.coords.longitude;
                    document.getElementById('r-location-text').innerText = `Location Acquired: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
                    document.getElementById('r-location-text').style.color = 'var(--success)';
                    
                    // Center the report map and move marker
                    if (this.reportMap && this.reportMarker) {
                        const newLatLng = [position.coords.latitude, position.coords.longitude];
                        this.reportMap.setView(newLatLng, 15);
                        this.reportMarker.setLatLng(newLatLng);
                    }
                },
                (error) => {
                    alert("Error getting precise location: " + error.message);
                    document.getElementById('r-location-text').innerText = "Location access failed";
                    document.getElementById('r-location-text').style.color = "var(--danger)";
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    },

    async loadIssues() {
        try {
            // Listen to Firebase Realtime Database
            const issuesRef = db.ref('issues');
            issuesRef.on('value', (snapshot) => {
                const data = snapshot.val();
                const issues = [];
                if (data) {
                    for (let key in data) {
                        issues.push({ id: key, ...data[key] });
                    }
                }
                
                // Sort by created_at descending
                issues.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                
                const activeIssues = issues.filter(i => i.status !== 'Resolved');
                document.getElementById('issue-count').innerText = activeIssues.length;
                
                const list = document.getElementById('issues-list');
                list.innerHTML = '';
                
                activeIssues.forEach(issue => {
                    const date = new Date(issue.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const badgeClass = issue.severity.toLowerCase();
                    
                    // Secure Voting Calculation
                    let upvotes = 0;
                    let downvotes = 0;
                    if (issue.votes) {
                        if (issue.votes.upvote) upvotes = Object.keys(issue.votes.upvote).length;
                        if (issue.votes.downvote) downvotes = Object.keys(issue.votes.downvote).length;
                    }
                    // attach computed votes to issue object for the detail view
                    issue.computedUpvotes = upvotes;
                    issue.computedDownvotes = downvotes;

                    const verifiedIcon = upvotes >= 2 ? '🛡️ ' : '';
                    
                    const html = `
                        <div class="glass-card issue-item" onclick="app.showIssueDetail(${JSON.stringify(issue).replace(/"/g, '&quot;')})">
                            <div class="issue-header">
                                <strong>${verifiedIcon}${issue.title}</strong>
                                <span class="badge ${badgeClass}">${issue.severity}</span>
                            </div>
                            <p class="sub-text">${issue.issue_type} • ${date}</p>
                        </div>
                    `;
                    list.insertAdjacentHTML('beforeend', html);
                });
                
                this.issues = activeIssues;
                
                // If map is active, refresh markers
                if (this.currentScreen === 'map-screen') {
                    this.updateMapMarkers();
                }

                // Check geofence proximity with new issues
                this.checkProximityToHazards();
            });
            
        } catch (error) {
            console.error("Error connecting to Firebase:", error);
        }
    },

    showIssueDetail(issue) {
        this.navigate('detail-screen');
        const detailContent = document.getElementById('detail-content');
        const date = new Date(issue.created_at).toLocaleString();
        
        const upvotes = issue.computedUpvotes || 0;
        const downvotes = issue.computedDownvotes || 0;
        const isVerified = upvotes >= 2;
        
        const hasLocation = issue.latitude && issue.longitude;
        const locationText = hasLocation 
            ? `📍 ${parseFloat(issue.latitude).toFixed(5)}, ${parseFloat(issue.longitude).toFixed(5)}`
            : '📍 Location not available';
        
        detailContent.innerHTML = `
            <h2>${issue.title} ${isVerified ? '<span style="color:var(--success); font-size:1rem;" title="Verified by Community">🛡️ Verified</span>' : ''}</h2>
            <p class="sub-text mb-2">${issue.issue_type} • Reported: ${date}</p>
            <p><strong>Severity:</strong> <span style="color: var(--${issue.severity === 'High' || issue.severity === 'Critical' ? 'danger' : 'warning'})">${issue.severity}</span></p>
            <p><strong>Status:</strong> ${issue.status}</p>
            <div class="mt-2 mb-2" style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">
                ${issue.description || 'No detailed description provided.'}
            </div>
            
            <!-- Location Section -->
            <div class="mt-2 mb-2" style="background: rgba(217,119,6,0.04); padding: 1rem; border-radius: 12px; border: 1px solid var(--border-color);">
                <p style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary-color); font-weight: 600; margin-bottom: 0.5rem;">Location</p>
                <p style="color: var(--text-sub); font-size: 0.9rem;">${locationText}</p>
                ${hasLocation ? `
                    <div style="display:flex; gap:10px; margin-top: 10px;">
                        <button class="btn-primary" style="flex:1; font-size: 0.85rem; padding: 0.6rem;" onclick="app.navigateToIssue(${issue.latitude}, ${issue.longitude})">
                            🗺️ View on Map
                        </button>
                        <button class="btn-secondary" style="flex:1; font-size: 0.85rem; padding: 0.6rem;" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${issue.latitude},${issue.longitude}', '_blank')">
                            🧭 Navigate
                        </button>
                    </div>
                ` : ''}
            </div>
            
            <div style="display:flex; gap:10px; margin-top: 15px;">
                <button class="btn-secondary" style="flex:1; border: 1px solid rgba(217,119,6,0.2);" onclick="app.voteIssue('${issue.id}', 'upvote')">👍 Still There (${upvotes})</button>
                <button class="btn-secondary" style="flex:1; border: 1px solid rgba(239,68,68,0.3);" onclick="app.voteIssue('${issue.id}', 'downvote')">👎 Cleared (${downvotes})</button>
            </div>
        `;
    },

    navigateToIssue(lat, lng) {
        this.navigate('map-screen');
        setTimeout(() => {
            if (this.map) {
                this.map.invalidateSize();
                this.map.flyTo([lat, lng], 16, { duration: 1.5 });
                
                // Add a temporary highlight marker
                const highlightIcon = L.divIcon({
                    html: '<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 20px rgba(239,68,68,0.8); animation: pulse 1s infinite;"></div>',
                    className: 'custom-marker'
                });
                const tempMarker = L.marker([lat, lng], {icon: highlightIcon})
                    .addTo(this.map)
                    .bindPopup('<b>⚠️ Reported Issue</b>')
                    .openPopup();
                
                // Remove highlight after 8 seconds
                setTimeout(() => { this.map.removeLayer(tempMarker); }, 8000);
            }
        }, 500);
    },

    async voteIssue(id, type) {
        if (!this.user) {
            this.showError("You must be logged in to vote!");
            return;
        }

        try {
            const issueRef = db.ref('issues/' + id);
            const snapshot = await issueRef.once('value');
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                // Check if user already voted THIS specific type (upvote or downvote)
                if (data.votes && data.votes[type] && data.votes[type][this.user.uid]) {
                    this.showError("You have already voted " + (type === 'upvote' ? '👍 Still There' : '👎 Cleared') + "!");
                    return;
                }

                // Register vote: votes/upvote/{uid} or votes/downvote/{uid}
                await db.ref(`issues/${id}/votes/${type}/${this.user.uid}`).set(true);
                
                // Re-calculate downvotes to check auto-resolve threshold
                let newDownvotes = 0;
                if (data.votes && data.votes.downvote) {
                    newDownvotes = Object.keys(data.votes.downvote).length;
                }
                if (type === 'downvote') newDownvotes++;
                
                // Auto-resolve logic (Waze-style)
                if (newDownvotes >= 3) {
                    await issueRef.update({ status: 'Resolved' });
                    this.showError("Issue marked as Cleared by the community!");
                    this.navigate('home-screen');
                } else {
                    this.showError("Vote recorded ✅");
                }
            }
        } catch (e) {
            console.error(e);
            this.showError("Error casting vote.");
        }
    },

    async submitReport() {
        const title = document.getElementById('r-title').value;
        const type = document.getElementById('r-type').value;
        const desc = document.getElementById('r-desc').value;
        const severity = document.getElementById('r-severity').value;
        const lat = document.getElementById('r-lat').value;
        const lng = document.getElementById('r-lng').value;

        const payload = {
            title, issue_type: type, description: desc, severity,
            latitude: lat ? parseFloat(lat) : null,
            longitude: lng ? parseFloat(lng) : null,
            status: 'Active',
            created_at: new Date().toISOString()
        };

        try {
            // Push to Firebase Realtime Database
            const newIssueRef = db.ref('issues').push();
            await newIssueRef.set(payload);
            
            alert("Issue reported successfully!");
            document.getElementById('report-form').reset();
            document.getElementById('r-location-text').innerText = "Location not added";
            document.getElementById('r-location-text').style.color = "var(--text-sub)";
            this.navigate('home-screen');
        } catch (e) {
            console.error(e);
            alert("Error reporting issue to Firebase. Check database rules.");
        }
    },

    initMap() {
        if (this.map) return; // Already initialized

        // Initialize Leaflet map with a default view
        this.map = L.map('map').setView([12.9716, 77.5946], 13); 
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Ask for permission and grab live location with continuous tracking
        if (navigator.geolocation) {
            navigator.geolocation.watchPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    this.userLat = lat;
                    this.userLng = lng;
                    this.checkProximityToHazards();
                    
                    if (!this.userMarker) {
                        // First time: center map and add marker
                        this.map.setView([lat, lng], 15);
                        
                        const userIcon = L.divIcon({
                            html: '<div style="background-color: #d97706; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(217,119,6,0.9); animation: pulse 1.5s infinite;"></div>',
                            className: 'custom-marker'
                        });
                        
                        this.userMarker = L.marker([lat, lng], {icon: userIcon})
                            .addTo(this.map)
                            .bindPopup('<b>📍 You are here</b><br>Live Location')
                            .openPopup();
                    } else {
                        // Update existing marker position
                        this.userMarker.setLatLng([lat, lng]);
                    }
                },
                (error) => {
                    console.warn("Could not get live location: ", error.message);
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
            );
        }

        // Update markers immediately
        this.updateMapMarkers();
    },

    updateMapMarkers() {
        if (!this.map || !this.issues) return;

        // Clear existing markers (except user location which isn't in this.markers array)
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];

        this.issues.forEach(issue => {
            if (issue.latitude && issue.longitude) {
                const color = issue.severity === 'High' || issue.severity === 'Critical' ? 'red' : 'orange';
                const markerHtml = `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`;
                const icon = L.divIcon({ html: markerHtml, className: 'issue-marker' });
                
                const marker = L.marker([issue.latitude, issue.longitude], {icon: icon})
                    .addTo(this.map)
                    .bindPopup(`<b>${issue.title}</b><br>${issue.issue_type}`);
                    
                this.markers.push(marker);
            }
        });
    },

    checkProximityToHazards() {
        if (!this.userLat || !this.userLng || !this.issues) return;
        
        this.issues.forEach(issue => {
            if (issue.severity === 'High' || issue.severity === 'Critical') {
                if (issue.latitude && issue.longitude && !this.notifiedIssues.has(issue.id)) {
                    const dist = this.getDistanceFromLatLonInKm(this.userLat, this.userLng, issue.latitude, issue.longitude);
                    if (dist < 2.0) { // Within 2 km
                        this.notifiedIssues.add(issue.id);
                        if (Notification.permission === "granted") {
                            new Notification("⚠️ Hazard Nearby", {
                                body: `${issue.title} is ${dist.toFixed(1)}km away!`,
                            });
                        }
                    }
                }
            }
        });
    },

    getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        var R = 6371; // Radius of the earth in km
        var dLat = (lat2-lat1) * (Math.PI/180);  
        var dLon = (lon2-lon1) * (Math.PI/180); 
        var a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2)
          ; 
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        var d = R * c; // Distance in km
        return d;
    }
};

// Initialize app when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
