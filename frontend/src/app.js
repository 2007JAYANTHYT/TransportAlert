const app = {
    currentScreen: 'home-screen',
    API_URL: 'http://127.0.0.0:5000/api', // Update if deployed
    map: null,
    markers: [],

    init() {
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

    navigate(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        // Update nav items
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        // Show target screen
        document.getElementById(screenId).classList.add('active');
        
        // Update bottom nav active state based on screen
        if (screenId === 'home-screen') document.querySelectorAll('.nav-item')[0].classList.add('active');
        if (screenId === 'map-screen') {
            document.querySelectorAll('.nav-item')[1].classList.add('active');
            this.initMap(); // Initialize map when visible
        }
        if (screenId === 'report-screen') document.querySelectorAll('.nav-item')[2].classList.add('active');
        if (screenId === 'solutions-screen') document.querySelectorAll('.nav-item')[3].classList.add('active');
        
        this.currentScreen = screenId;
    },

    getLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    document.getElementById('r-lat').value = position.coords.latitude;
                    document.getElementById('r-lng').value = position.coords.longitude;
                    document.getElementById('r-location-text').innerText = `Location: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
                    document.getElementById('r-location-text').style.color = 'var(--success)';
                },
                (error) => {
                    alert("Error getting location: " + error.message);
                }
            );
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    },

    async loadIssues() {
        try {
            // Simulated fetch if backend is not running
            // const response = await fetch(`${this.API_URL}/issues`);
            // const issues = await response.json();
            
            // Mock data for demo since backend might not be running yet
            const issues = [
                { id: 1, title: 'Major Traffic Jam', issue_type: 'Traffic Congestion', severity: 'High', status: 'Active', created_at: new Date().toISOString(), latitude: 12.9716, longitude: 77.5946 },
                { id: 2, title: 'Deep Pothole on Main St', issue_type: 'Pothole', severity: 'Medium', status: 'Active', created_at: new Date().toISOString(), latitude: 12.9750, longitude: 77.5900 }
            ];

            document.getElementById('issue-count').innerText = issues.length;
            
            const list = document.getElementById('issues-list');
            list.innerHTML = '';
            
            issues.forEach(issue => {
                const date = new Date(issue.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const badgeClass = issue.severity.toLowerCase();
                
                const html = `
                    <div class="glass-card issue-item" onclick="app.showIssueDetail(${JSON.stringify(issue).replace(/"/g, '&quot;')})">
                        <div class="issue-header">
                            <strong>${issue.title}</strong>
                            <span class="badge ${badgeClass}">${issue.severity}</span>
                        </div>
                        <p class="sub-text">${issue.issue_type} • ${date}</p>
                    </div>
                `;
                list.insertAdjacentHTML('beforeend', html);
            });
            
            // Store for map
            this.issues = issues;
        } catch (error) {
            console.error("Error loading issues:", error);
        }
    },

    showIssueDetail(issue) {
        this.navigate('detail-screen');
        const detailContent = document.getElementById('detail-content');
        const date = new Date(issue.created_at).toLocaleString();
        
        detailContent.innerHTML = `
            <h2>${issue.title}</h2>
            <p class="sub-text mb-2">${issue.issue_type} • Reported: ${date}</p>
            <p><strong>Severity:</strong> <span style="color: var(--${issue.severity === 'High' ? 'danger' : 'warning'})">${issue.severity}</span></p>
            <p><strong>Status:</strong> ${issue.status}</p>
            <div class="mt-2 mb-2" style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">
                ${issue.description || 'No detailed description provided.'}
            </div>
            <button class="btn-primary w-100" onclick="alert('This would mark the issue as resolved via API.')">Mark as Resolved</button>
        `;
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
            longitude: lng ? parseFloat(lng) : null
        };

        try {
            // Mock submission
            console.log("Submitting:", payload);
            alert("Issue reported successfully!");
            document.getElementById('report-form').reset();
            document.getElementById('r-location-text').innerText = "Location not added";
            document.getElementById('r-location-text').style.color = "var(--text-sub)";
            this.navigate('home-screen');
            this.loadIssues(); // Refresh
        } catch (e) {
            alert("Error reporting issue.");
        }
    },

    initMap() {
        if (this.map) return; // Already initialized

        // Initialize Leaflet map
        this.map = L.map('map').setView([12.9716, 77.5946], 13); // Default view
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Add markers for issues
        if (this.issues) {
            this.issues.forEach(issue => {
                if (issue.latitude && issue.longitude) {
                    const color = issue.severity === 'High' ? 'red' : 'orange';
                    const markerHtml = `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`;
                    const icon = L.divIcon({ html: markerHtml, className: 'custom-marker' });
                    
                    L.marker([issue.latitude, issue.longitude], {icon: icon})
                        .addTo(this.map)
                        .bindPopup(`<b>${issue.title}</b><br>${issue.issue_type}`);
                }
            });
        }
        
        // Fix map rendering issue in hidden div
        setTimeout(() => {
            this.map.invalidateSize();
        }, 100);
    }
};

// Initialize app when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
