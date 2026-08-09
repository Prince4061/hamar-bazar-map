/* ==========================================================================
   Hamar Bazar — Location Manager (Takhatpur)
   Map & Admin Logic JS (v6 - Delete Order, User & Shop Markers)
   ========================================================================== */

let mapInstance = null;
let mapEngineType = 'leaflet'; // 'google' or 'leaflet'
let allLocations = [];
let markerObjects = [];
let isAddLocationMode = false;
let pendingClickCoords = null;
let googleMapsLoaded = false;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupEventListeners();
    checkAndLoadMapEngine();
    // Auto-refresh live map locations every 5 seconds (for live delivery tracking)
    setInterval(fetchMapLocations, 5000);
}

// ----------------- MAP ENGINE LOADER -----------------

function checkAndLoadMapEngine() {
    const apiKey = window.APP_CONFIG.googleMapsApiKey;
    const bannerText = document.getElementById('map-engine-text');
    const keyLabel = document.getElementById('key-status-label');

    // Always fetch location data immediately
    fetchMapLocations();

    if (apiKey && apiKey.trim() !== "") {
        bannerText.innerText = "Loading Google Maps Engine (Takhatpur)...";
        keyLabel.innerText = "API Key Active";
        loadGoogleMapsScript(apiKey);
    } else {
        bannerText.innerHTML = "<i class='fa-solid fa-map' style='color:#3B82F6;'></i> <strong>Takhatpur OpenStreetMap Active</strong>";
        keyLabel.innerText = "Set API Key";
        initLeafletMap();
    }
}

function loadGoogleMapsScript(apiKey) {
    if (window.google && window.google.maps) {
        createGoogleMapInstance();
        return;
    }

    window.gm_authFailure = () => {
        console.warn("Google Maps authentication failed for the provided API key.");
        showToast("Google Maps API Key error. Fallback OpenStreetMap active.", "error");
        document.getElementById('map-engine-text').innerHTML = "<i class='fa-solid fa-triangle-exclamation' style='color:#F59E0B;'></i> Key Auth Issue. <strong>Takhatpur OpenStreetMap Active</strong>";
        initLeafletMap();
        renderMarkers();
    };

    window.onGoogleMapsInitCallback = () => {
        googleMapsLoaded = true;
        mapEngineType = 'google';
        document.getElementById('map-engine-text').innerHTML = "<i class='fa-solid fa-square-check' style='color:#10B981;'></i> <strong>Google Maps Engine Active</strong> (Takhatpur)";
        createGoogleMapInstance();
        renderMarkers();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=onGoogleMapsInitCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
        showToast("Failed to load Google Maps script. Switched to OpenStreetMap.", "error");
        document.getElementById('map-engine-text').innerHTML = "Script Error. <strong>Takhatpur OpenStreetMap Active</strong>";
        initLeafletMap();
        renderMarkers();
    };
    document.head.appendChild(script);
}

// ----------------- MAP INITIALIZERS -----------------

function initLeafletMap() {
    mapEngineType = 'leaflet';
    const lat = window.APP_CONFIG.centerLat;
    const lng = window.APP_CONFIG.centerLng;
    const zoom = window.APP_CONFIG.defaultZoom;

    if (mapInstance && mapInstance.remove) {
        mapInstance.remove();
    }

    mapInstance = L.map('map', {
        zoomControl: false
    }).setView([lat, lng], zoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; Hamar Bazar Admin Map | Takhatpur',
        maxZoom: 19
    }).addTo(mapInstance);

    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

    mapInstance.on('click', onMapClick);
}

function createGoogleMapInstance() {
    mapEngineType = 'google';
    const center = { lat: window.APP_CONFIG.centerLat, lng: window.APP_CONFIG.centerLng };
    const zoom = window.APP_CONFIG.defaultZoom;

    mapInstance = new google.maps.Map(document.getElementById('map'), {
        center: center,
        zoom: zoom,
        styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            {
                featureType: "administrative.locality",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }]
            },
            {
                featureType: "poi",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }]
            },
            {
                featureType: "road",
                elementType: "geometry",
                stylers: [{ color: "#38414e" }]
            },
            {
                featureType: "road",
                elementType: "geometry.stroke",
                stylers: [{ color: "#212a37" }]
            },
            {
                featureType: "water",
                elementType: "geometry",
                stylers: [{ color: "#17263c" }]
            }
        ]
    });

    mapInstance.addListener('click', (e) => {
        onMapClick({ latlng: { lat: e.latLng.lat(), lng: e.latLng.lng() } });
    });
}

// ----------------- DATA FETCH & RENDER -----------------

function fetchMapLocations() {
    fetch('/api/map/locations?t=' + Date.now(), { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
            allLocations = data;
            updateCounts();
            renderMarkers();
        })
        .catch(err => {
            console.error("Error fetching map locations:", err);
            showToast("Failed to fetch location data", "error");
        });
}

function updateCounts() {
    let shops = 0, users = 0, orders = 0, riders = 0;
    allLocations.forEach(item => {
        if (item.type === 'shop') shops++;
        if (item.type === 'user') users++;
        if (item.type === 'order') orders++;
        if (item.type === 'rider') riders++;
    });
    document.getElementById('count-shops').innerText = shops;
    document.getElementById('count-users').innerText = users;
    document.getElementById('count-orders').innerText = orders;
    const riderElem = document.getElementById('count-riders');
    if (riderElem) riderElem.innerText = riders;
}

function renderMarkers() {
    clearAllMarkers();

    const showShop = document.getElementById('filter-shop').checked;
    const showUser = document.getElementById('filter-user').checked;
    const showOrder = document.getElementById('filter-order').checked;
    const showRider = document.getElementById('filter-rider') ? document.getElementById('filter-rider').checked : true;

    allLocations.forEach(item => {
        if (item.type === 'shop' && !showShop) return;
        if (item.type === 'user' && !showUser) return;
        if (item.type === 'order' && !showOrder) return;
        if (item.type === 'rider' && !showRider) return;

        createMarkerOnMap(item);
    });
}

function clearAllMarkers() {
    markerObjects.forEach(obj => {
        if (mapEngineType === 'leaflet') {
            if (mapInstance && obj.marker) mapInstance.removeLayer(obj.marker);
        } else if (mapEngineType === 'google') {
            if (obj.marker && obj.marker.setMap) obj.marker.setMap(null);
        }
    });
    markerObjects = [];
}

// Custom Google Overlay Marker Class
class GoogleHTMLOverlayMarker {
    constructor(lat, lng, htmlContent, map, onClick) {
        this.lat = lat;
        this.lng = lng;
        this.htmlContent = htmlContent;
        this.map = map;
        this.onClick = onClick;
        this.overlay = new google.maps.OverlayView();
        
        const self = this;
        this.overlay.onAdd = function() {
            self.div = document.createElement('div');
            self.div.style.position = 'absolute';
            self.div.style.cursor = 'pointer';
            self.div.style.zIndex = '1000';
            self.div.innerHTML = self.htmlContent;
            self.div.addEventListener('click', (e) => {
                e.stopPropagation();
                if (self.onClick) self.onClick();
            });
            const panes = this.getPanes();
            panes.overlayMouseTarget.appendChild(self.div);
        };
        
        this.overlay.draw = function() {
            const projection = this.getProjection();
            if (!projection || !self.div) return;
            const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(self.lat, self.lng));
            if (point) {
                self.div.style.left = point.x + 'px';
                self.div.style.top = point.y + 'px';
            }
        };
        
        this.overlay.onRemove = function() {
            if (self.div && self.div.parentNode) {
                self.div.parentNode.removeChild(self.div);
            }
        };
        
        this.overlay.setMap(map);
    }
    
    setMap(map) {
        if (this.overlay) this.overlay.setMap(map);
    }
}

function createMarkerOnMap(item) {
    let typeClass = item.type;
    let iconFaClass = 'fa-store';
    
    if (item.type === 'shop') {
        iconFaClass = 'fa-store';
    } else if (item.type === 'user') {
        const tier = item.customer_tier || 'normal';
        typeClass = 'user-' + tier;
        if (tier === 'premium') iconFaClass = 'fa-crown';
        else if (tier === 'active') iconFaClass = 'fa-user-check';
        else iconFaClass = 'fa-user';
    } else if (item.type === 'order') {
        iconFaClass = 'fa-bag-shopping';
    } else if (item.type === 'rider') {
        iconFaClass = 'fa-motorcycle';
        typeClass = 'rider';
    }
    
    // Tag pill generation
    let tagPill = '';
    if (item.type === 'shop') {
        if (item.is_partner) {
            tagPill = `<span class="partner-tag-pill"><i class="fa-solid fa-circle-check"></i> Tie-Up</span>`;
        } else {
            tagPill = `<span style="background:rgba(239,68,68,0.2); color:#FCA5A5; font-size:10px; padding:1px 6px; border-radius:10px;">Pending</span>`;
        }
    } else if (item.type === 'user') {
        const tier = item.customer_tier || 'normal';
        if (tier === 'premium') {
            tagPill = `<span class="order-count-pill user-premium"><i class="fa-solid fa-crown"></i> ${item.total_orders || 0} Orders (VIP)</span>`;
        } else if (tier === 'active') {
            tagPill = `<span class="order-count-pill user-active"><i class="fa-solid fa-bolt"></i> ${item.total_orders || 0} Orders (Active)</span>`;
        } else {
            tagPill = `<span class="order-count-pill user-normal"><i class="fa-solid fa-user"></i> ${item.total_orders || 0} Orders</span>`;
        }
    } else if (item.type === 'rider') {
        tagPill = `<span class="order-count-pill rider"><i class="fa-solid fa-gauge-high"></i> ${item.speed || 0} km/h • 🔋${item.battery || 100}%</span>`;
    }

    const htmlContent = `
        <div class="custom-marker-wrapper">
            <div class="marker-aura ${typeClass}"></div>
            <div class="marker-pin-badge ${typeClass}">
                <i class="fa-solid ${iconFaClass}"></i>
            </div>
            <div class="marker-tip"></div>
            <div class="marker-label-tag ${typeClass}">
                <span>${item.name}</span>
                ${tagPill}
            </div>
        </div>
    `;

    if (mapEngineType === 'leaflet') {
        const customDivIcon = L.divIcon({
            html: htmlContent,
            className: 'custom-leaflet-marker-node',
            iconSize: [60, 80],
            iconAnchor: [30, 75]
        });

        const marker = L.marker([item.lat, item.lng], {
            icon: customDivIcon,
            draggable: true
        }).addTo(mapInstance);

        marker.on('click', () => openDrawerForItem(item));
        marker.on('dragend', (e) => {
            const newPos = e.target.getLatLng();
            handleMarkerDragEnd(item, newPos.lat, newPos.lng);
        });

        markerObjects.push({ item: item, marker: marker });
    } else {
        const overlayMarker = new GoogleHTMLOverlayMarker(
            item.lat, 
            item.lng, 
            htmlContent, 
            mapInstance, 
            () => openDrawerForItem(item)
        );
        markerObjects.push({ item: item, marker: overlayMarker });
    }
}

// ----------------- DRAG & DROP LOCATION UPDATE -----------------

function handleMarkerDragEnd(item, newLat, newLng) {
    const formattedLat = parseFloat(newLat).toFixed(6);
    const formattedLng = parseFloat(newLng).toFixed(6);

    if (confirm(`Update location for ${item.name} to Lat: ${formattedLat}, Lng: ${formattedLng}?`)) {
        let endpoint = '';
        if (item.type === 'shop') endpoint = `/api/shops/${item.id}/location`;
        else if (item.type === 'user') endpoint = `/api/users/${item.id}/location`;
        else {
            showToast("Orders delivery location cannot be dragged directly", "error");
            fetchMapLocations();
            return;
        }

        fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: formattedLat, longitude: formattedLng })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                showToast(`Updated location for ${item.name}!`);
                fetchMapLocations();
            } else {
                showToast(data.message || "Failed to update location", "error");
                fetchMapLocations();
            }
        });
    } else {
        fetchMapLocations();
    }
}

// ----------------- INTERACTIVE ADD LOCATION MODE -----------------

function toggleAddLocationMode() {
    isAddLocationMode = !isAddLocationMode;
    const banner = document.getElementById('add-mode-banner');
    const btn = document.getElementById('add-location-btn');

    if (isAddLocationMode) {
        banner.classList.remove('hidden');
        btn.classList.remove('btn-emerald');
        btn.classList.add('btn-danger');
        btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Cancel Add';
        document.getElementById('map').style.cursor = 'crosshair';
    } else {
        banner.classList.add('hidden');
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-emerald');
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Location';
        document.getElementById('map').style.cursor = 'default';
    }
}

function onMapClick(e) {
    if (!isAddLocationMode) return;

    pendingClickCoords = {
        lat: parseFloat(e.latlng.lat).toFixed(6),
        lng: parseFloat(e.latlng.lng).toFixed(6)
    };

    toggleAddLocationMode();
    document.getElementById('selected-coords-display').innerText = `${pendingClickCoords.lat}, ${pendingClickCoords.lng}`;
    openModal('type-select-modal');
}

function openAddShopModal() {
    closeModal('type-select-modal');
    document.getElementById('shop-lat').value = pendingClickCoords.lat;
    document.getElementById('shop-lng').value = pendingClickCoords.lng;
    document.getElementById('shop-name').value = '';
    document.getElementById('shop-owner').value = '';
    document.getElementById('shop-mobile').value = '';
    openModal('add-shop-modal');
}

function openAddNewUserModal() {
    closeModal('type-select-modal');
    document.getElementById('new-user-lat').value = pendingClickCoords.lat;
    document.getElementById('new-user-lng').value = pendingClickCoords.lng;
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-mobile').value = '';
    document.getElementById('new-user-orders').value = '1';
    document.getElementById('new-user-address').value = '';
    openModal('add-new-user-modal');
}

function submitNewShop(e) {
    e.preventDefault();
    const body = {
        name: document.getElementById('shop-name').value.trim(),
        owner_name: document.getElementById('shop-owner').value.trim(),
        mobile: document.getElementById('shop-mobile').value.trim(),
        category: document.getElementById('shop-category').value,
        partner_status: document.getElementById('shop-partner-status').value,
        latitude: document.getElementById('shop-lat').value,
        longitude: document.getElementById('shop-lng').value
    };

    fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            showToast("New Tie-Up Shop added successfully!");
            closeModal('add-shop-modal');
            fetchMapLocations();
        } else {
            showToast(data.message || "Error adding shop", "error");
        }
    });
}

function submitNewUser(e) {
    e.preventDefault();
    const body = {
        name: document.getElementById('new-user-name').value.trim(),
        mobile: document.getElementById('new-user-mobile').value.trim(),
        address: document.getElementById('new-user-address').value.trim(),
        manual_order_count: document.getElementById('new-user-orders').value,
        latitude: document.getElementById('new-user-lat').value,
        longitude: document.getElementById('new-user-lng').value
    };

    fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            showToast("New App User location marked successfully!");
            closeModal('add-new-user-modal');
            fetchMapLocations();
        } else {
            showToast(data.message || "Error adding user", "error");
        }
    });
}

function updateUserOrderCount(userId) {
    const inputVal = document.getElementById('drawer-order-count-input').value;
    if (inputVal === "" || parseInt(inputVal) < 0) {
        showToast("Enter a valid order count", "error");
        return;
    }

    fetch(`/api/users/${userId}/order_count`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual_order_count: parseInt(inputVal) })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            showToast(`User order count updated to ${inputVal}!`);
            fetchMapLocations();
            const badgeSpan = document.getElementById('drawer-user-order-badge');
            if (badgeSpan) badgeSpan.innerText = `${inputVal} Orders`;
        } else {
            showToast(data.message || "Failed to update order count", "error");
        }
    });
}

// ----------------- DELETE ACTIONS -----------------

function deleteOrder(orderId) {
    if (confirm(`Are you sure you want to delete Order #${orderId}?`)) {
        fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast(`Order #${orderId} deleted successfully!`);
                } else {
                    showToast(data.message || "Failed to delete order", "error");
                }
                document.getElementById('detail-drawer').classList.add('hidden');
                fetchMapLocations();
            })
            .catch(err => {
                console.error("Error deleting order:", err);
                showToast("Error deleting order: " + err.message, "error");
            });
    }
}

function deleteUser(userId) {
    if (confirm("Are you sure you want to delete this user location?")) {
        fetch(`/api/users/${userId}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast("User location deleted successfully!");
                } else {
                    showToast(data.message || "Failed to delete user", "error");
                }
                document.getElementById('detail-drawer').classList.add('hidden');
                fetchMapLocations();
            })
            .catch(err => {
                console.error("Error deleting user:", err);
                showToast("Error deleting user: " + err.message, "error");
            });
    }
}

function deleteShop(shopId) {
    if (confirm("Are you sure you want to delete this shop location?")) {
        fetch(`/api/shops/${shopId}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast("Shop location deleted successfully!");
                } else {
                    showToast(data.message || "Failed to delete shop", "error");
                }
                document.getElementById('detail-drawer').classList.add('hidden');
                fetchMapLocations();
            })
            .catch(err => {
                console.error("Error deleting shop:", err);
                showToast("Error deleting shop: " + err.message, "error");
            });
    }
}

function openAddRiderModal() {
    document.getElementById('rider-name').value = '';
    document.getElementById('rider-mobile').value = '';
    document.getElementById('rider-vehicle').value = '';
    openModal('add-rider-modal');
}

function submitNewRider(e) {
    e.preventDefault();
    const name = document.getElementById('rider-name').value.trim();
    const mobile = document.getElementById('rider-mobile').value.trim();
    const vehicle_number = document.getElementById('rider-vehicle').value.trim();

    if (!name || !mobile) {
        showToast("Rider name and mobile are required", "error");
        return;
    }

    fetch('/api/riders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mobile, vehicle_number })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            showToast(`Delivery Rider ${name} added successfully!`);
            closeModal('add-rider-modal');
            fetchMapLocations();
        } else {
            showToast(data.message || "Error adding delivery rider", "error");
        }
    })
    .catch(err => {
        console.error("Error adding rider:", err);
        showToast("Error adding rider: " + err.message, "error");
    });
}

function deleteRider(riderId) {
    if (confirm("Are you sure you want to delete this delivery rider location?")) {
        fetch(`/api/riders/${riderId}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast("Delivery rider deleted successfully!");
                } else {
                    showToast(data.message || "Failed to delete rider", "error");
                }
                document.getElementById('detail-drawer').classList.add('hidden');
                fetchMapLocations();
            })
            .catch(err => {
                console.error("Error deleting rider:", err);
                showToast("Error deleting rider: " + err.message, "error");
            });
    }
}

// ----------------- DRAWER / POPUP DETAILS -----------------

function openDrawerForItem(item) {
    const drawer = document.getElementById('detail-drawer');
    const content = document.getElementById('drawer-content');

    let badgeClass = 'shop';
    if (item.type === 'user') badgeClass = 'user';
    if (item.type === 'order') badgeClass = 'order';
    if (item.type === 'rider') badgeClass = 'rider';

    let html = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
            <span class="search-result-icon ${badgeClass}" style="width:40px; height:40px; font-size:18px;">
                <i class="fa-solid fa-${item.type === 'shop' ? 'store' : (item.type === 'user' ? 'user' : (item.type === 'rider' ? 'motorcycle' : 'bag-shopping'))}"></i>
            </span>
            <div>
                <span style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); font-weight:700;">${item.type.toUpperCase()} LOCATION</span>
                <h2 style="font-family:var(--font-heading); font-size:18px; color:var(--text-primary); margin-top:2px;">${item.name}</h2>
            </div>
        </div>
        
        <div style="background:var(--bg-input); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:20px;">
    `;

    if (item.type === 'shop') {
        let partnerBadge = item.is_partner 
            ? `<span style="background:rgba(16,185,129,0.15); color:#10B981; border:1px solid rgba(16,185,129,0.4); padding:4px 10px; border-radius:14px; font-size:12px; font-weight:700;"><i class="fa-solid fa-circle-check"></i> ${item.partner_status || 'Verified Partner'}</span>`
            : `<span style="background:rgba(239,68,68,0.15); color:#EF4444; border:1px solid rgba(239,68,68,0.4); padding:4px 10px; border-radius:14px; font-size:12px; font-weight:700;"><i class="fa-solid fa-clock"></i> Pending Tie-Up</span>`;

        html += `
            <div style="margin-bottom:14px;">${partnerBadge}</div>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Owner:</strong> ${item.owner_name}</p>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Mobile:</strong> <a href="tel:${item.mobile}" style="color:var(--accent-emerald); text-decoration:none;">${item.mobile}</a></p>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Category:</strong> ${item.category}</p>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Total Orders Fulfilled:</strong> <span style="background:rgba(16,185,129,0.2); color:#6EE7B7; padding:2px 8px; border-radius:10px; font-weight:700;">${item.total_fulfilled || 0} Orders</span></p>
        `;
    } else if (item.type === 'user') {
        const tier = item.customer_tier || 'normal';
        let tierBadgeHtml = '';
        if (tier === 'premium') {
            tierBadgeHtml = `<span style="background:linear-gradient(135deg, #F59E0B, #D97706); color:#FFF; padding:5px 12px; border-radius:14px; font-size:12px; font-weight:800; border:1px solid #FEF08A; box-shadow:0 0 12px rgba(245,158,11,0.6); display:inline-flex; align-items:center; gap:6px;"><i class="fa-solid fa-crown"></i> Premium Customer (>10 Orders)</span>`;
        } else if (tier === 'active') {
            tierBadgeHtml = `<span style="background:rgba(16,185,129,0.2); color:#6EE7B7; border:1px solid rgba(16,185,129,0.6); padding:5px 12px; border-radius:14px; font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:6px;"><i class="fa-solid fa-user-check"></i> Active Customer (>2 Orders)</span>`;
        } else {
            tierBadgeHtml = `<span style="background:rgba(59,130,246,0.2); color:#93C5FD; border:1px solid rgba(59,130,246,0.6); padding:5px 12px; border-radius:14px; font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:6px;"><i class="fa-solid fa-user"></i> Normal Customer (1 Order)</span>`;
        }

        html += `
            <div style="margin-bottom:14px;">${tierBadgeHtml}</div>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Mobile:</strong> <a href="tel:${item.mobile}" style="color:var(--accent-blue); text-decoration:none;">${item.mobile}</a></p>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Address:</strong> ${item.address || 'Takhatpur'}</p>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Total Orders Placed:</strong> <span id="drawer-user-order-badge" style="background:rgba(255,255,255,0.1); color:#FFF; padding:2px 8px; border-radius:10px; font-weight:700;">${item.total_orders || 0} Orders</span></p>

            <!-- Admin Order Count Edit Controls -->
            <div style="margin-top:14px; padding:12px; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.3); border-radius:8px;">
                <label style="font-size:12px; color:#93C5FD; font-weight:600; display:block; margin-bottom:6px;">
                    <i class="fa-solid fa-pen-to-square"></i> Admin: Set/Update Order Count
                </label>
                <div style="display:flex; gap:8px;">
                    <input type="number" id="drawer-order-count-input" value="${item.total_orders || 0}" min="0" style="width:90px; background:#1F2937; border:1px solid rgba(255,255,255,0.2); color:#fff; padding:6px 10px; border-radius:6px; font-weight:700;">
                    <button onclick="updateUserOrderCount(${item.id})" class="btn btn-sm btn-blue"><i class="fa-solid fa-floppy-disk"></i> Update</button>
                </div>
            </div>

            <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--border-color);">
                <h4 style="font-size:13px; color:var(--text-secondary); margin-bottom:10px;"><i class="fa-solid fa-list-check"></i> User Order History:</h4>
                <div id="user-order-history-list">Loading orders...</div>
            </div>
        `;

        setTimeout(() => {
            fetch(`/api/users/${item.id}/orders`)
                .then(res => res.json())
                .then(orders => {
                    const historyContainer = document.getElementById('user-order-history-list');
                    if (!historyContainer) return;
                    if (!orders || orders.length === 0) {
                        historyContainer.innerHTML = '<div style="font-size:12px; color:var(--text-muted);">No app order history entries yet</div>';
                        return;
                    }
                    let listHtml = '';
                    orders.forEach(ord => {
                        let stColor = ord.status === 'delivered' ? '#10B981' : (ord.status === 'cancelled' ? '#EF4444' : '#F59E0B');
                        listHtml += `
                            <div class="user-order-card">
                                <div>
                                    <div class="order-id">Order #${ord.id} - ₹${ord.amount}</div>
                                    <div class="order-shop">${ord.shop_name || 'Hamar Bazar Partner Store'}</div>
                                </div>
                                <span style="font-size:10px; font-weight:700; color:${stColor}; background:${stColor}22; padding:2px 6px; border-radius:8px;">${ord.status.toUpperCase()}</span>
                            </div>
                        `;
                    });
                    historyContainer.innerHTML = listHtml;
                });
        }, 100);

    } else if (item.type === 'rider') {
        let riderBadge = `<span style="background:rgba(139,92,246,0.2); color:#C4B5FD; border:1px solid rgba(139,92,246,0.6); padding:4px 10px; border-radius:14px; font-size:12px; font-weight:700; display:inline-flex; align-items:center; gap:6px;"><i class="fa-solid fa-motorcycle"></i> ${item.status ? item.status.toUpperCase() : 'ONLINE'}</span>`;

        html += `
            <div style="margin-bottom:14px;">${riderBadge}</div>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Mobile:</strong> <a href="tel:${item.mobile}" style="color:#C4B5FD; text-decoration:none;">${item.mobile}</a></p>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Vehicle Number:</strong> ${item.vehicle_number || 'Delivery Bike'}</p>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Live Speed:</strong> <span style="color:#FFF; font-weight:700;">${item.speed || 0} km/h</span></p>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Phone Battery:</strong> <span style="color:#FFF; font-weight:700;">${item.battery || 100}%</span></p>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Last GPS Ping:</strong> <span style="color:var(--text-muted); font-size:12px;">${item.last_updated || 'Just now'}</span></p>
        `;
    } else if (item.type === 'order') {
        let statusColor = '#F59E0B';
        if (item.status === 'delivered') statusColor = '#10B981';
        if (item.status === 'cancelled') statusColor = '#EF4444';

        html += `
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Amount:</strong> ₹${item.amount}</p>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Customer:</strong> ${item.user_name || 'N/A'}</p>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Fulfilled By:</strong> ${item.shop_name || 'N/A'}</p>
            <p style="margin-bottom:8px; font-size:14px;"><strong style="color:var(--text-secondary);">Status:</strong> <span style="background:${statusColor}22; color:${statusColor}; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">${item.status.toUpperCase()}</span></p>
            
            <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border-color);">
                <label style="font-size:12px; color:var(--text-secondary); display:block; margin-bottom:6px;">Update Order Status:</label>
                <select id="update-order-status-select" onchange="changeOrderStatus(${item.id}, this.value)" style="width:100%; background:var(--bg-card-solid); border:1px solid var(--border-color); color:#fff; padding:8px; border-radius:6px;">
                    <option value="pending" ${item.status==='pending'?'selected':''}>Pending</option>
                    <option value="delivered" ${item.status==='delivered'?'selected':''}>Delivered</option>
                    <option value="cancelled" ${item.status==='cancelled'?'selected':''}>Cancelled</option>
                </select>
            </div>
        `;
    }

    html += `
            <div style="margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.05); font-size:12px; color:var(--text-muted);">
                <i class="fa-solid fa-location-dot"></i> Coordinates: ${item.lat}, ${item.lng}
            </div>
        </div>
    `;

    // DELETE BUTTONS FOR ALL MARKER TYPES
    if (item.type === 'order') {
        html += `
            <button onclick="deleteOrder(${item.id})" class="btn btn-danger" style="width:100%; justify-content:center;">
                <i class="fa-solid fa-trash-can"></i> Delete Order Location
            </button>
        `;
    } else if (item.type === 'user') {
        html += `
            <button onclick="deleteUser(${item.id})" class="btn btn-danger" style="width:100%; justify-content:center;">
                <i class="fa-solid fa-trash-can"></i> Delete User Location
            </button>
        `;
    } else if (item.type === 'shop') {
        html += `
            <button onclick="deleteShop(${item.id})" class="btn btn-danger" style="width:100%; justify-content:center;">
                <i class="fa-solid fa-trash-can"></i> Delete Shop Location
            </button>
        `;
    } else if (item.type === 'rider') {
        html += `
            <button onclick="deleteRider(${item.id})" class="btn btn-danger" style="width:100%; justify-content:center;">
                <i class="fa-solid fa-trash-can"></i> Delete Rider Location
            </button>
        `;
    }

    content.innerHTML = html;
    drawer.classList.remove('hidden');
}

function changeOrderStatus(orderId, newStatus) {
    fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            showToast(`Order #${orderId} status updated to ${newStatus}`);
            fetchMapLocations();
            document.getElementById('detail-drawer').classList.add('hidden');
        }
    });
}

// ----------------- DB BACKUP & RESTORE HANDLERS -----------------

function downloadDbBackup() {
    showToast("Downloading Database Backup (.db)...");
    window.location.href = '/api/db/download';
}

function openRestoreDbModal() {
    const fileInput = document.getElementById('db-file-input');
    if (fileInput) fileInput.value = '';
    openModal('restore-db-modal');
}

function submitRestoreDb(e) {
    e.preventDefault();
    const fileInput = document.getElementById('db-file-input');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast("Please select a .db or .json file to restore", "error");
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    showToast("Uploading and restoring database...");

    fetch('/api/db/upload', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            showToast("Database restored successfully!");
            closeModal('restore-db-modal');
            fetchMapLocations();
        } else {
            showToast(data.message || "Failed to restore database", "error");
        }
    })
    .catch(err => {
        console.error("Error restoring database:", err);
        showToast("Error restoring database: " + err.message, "error");
    });
}

// ----------------- SEARCH & FILTERS -----------------

function setupEventListeners() {
    document.getElementById('add-location-btn').addEventListener('click', toggleAddLocationMode);
    document.getElementById('cancel-add-mode-btn').addEventListener('click', toggleAddLocationMode);
    document.getElementById('api-key-btn').addEventListener('click', () => openModal('api-key-modal'));
    
    const downloadBtn = document.getElementById('download-db-btn');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadDbBackup);
    
    const uploadBtn = document.getElementById('upload-db-btn');
    if (uploadBtn) uploadBtn.addEventListener('click', openRestoreDbModal);

    ['filter-shop', 'filter-user', 'filter-order', 'filter-rider'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('change', (e) => {
                const chip = e.target.closest('.filter-chip');
                if (e.target.checked) chip.classList.add('active');
                else chip.classList.remove('active');
                renderMarkers();
            });
        }
    });

    document.getElementById('close-drawer-btn').addEventListener('click', () => {
        document.getElementById('detail-drawer').classList.add('hidden');
    });

    const searchInput = document.getElementById('search-input');
    const searchDropdown = document.getElementById('search-results-dropdown');
    const clearBtn = document.getElementById('clear-search-btn');

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length > 0) clearBtn.style.display = 'block';
        else clearBtn.style.display = 'none';

        if (query.length < 2) {
            searchDropdown.classList.add('hidden');
            return;
        }

        fetch(`/api/search?q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(results => {
                if (results.length === 0) {
                    searchDropdown.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted); font-size:13px;">No locations found</div>';
                } else {
                    let html = '';
                    results.forEach(res => {
                        html += `
                            <div class="search-result-item" onclick="panToSearchResult(${res.lat}, ${res.lng}, '${res.type}', ${res.id})">
                                <div class="search-result-icon ${res.type}">
                                    <i class="fa-solid fa-${res.type === 'shop' ? 'store' : (res.type === 'user' ? 'user' : 'bag-shopping')}"></i>
                                </div>
                                <div class="search-result-info">
                                    <div class="search-result-title">${res.name}</div>
                                    <div class="search-result-sub">${res.subtitle}</div>
                                </div>
                            </div>
                        `;
                    });
                    searchDropdown.innerHTML = html;
                }
                searchDropdown.classList.remove('hidden');
            });
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        searchDropdown.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchDropdown.classList.add('hidden');
        }
    });
}

function panToSearchResult(lat, lng, type, id) {
    document.getElementById('search-results-dropdown').classList.add('hidden');

    if (mapEngineType === 'leaflet') {
        mapInstance.flyTo([lat, lng], 17, { duration: 1.5 });
    } else if (mapEngineType === 'google') {
        mapInstance.panTo({ lat: lat, lng: lng });
        mapInstance.setZoom(17);
    }

    const targetItem = allLocations.find(loc => loc.type === type && loc.id === id);
    if (targetItem) {
        openDrawerForItem(targetItem);
    }
}

function submitApiKey(e) {
    e.preventDefault();
    const key = document.getElementById('gmap-api-key').value.trim();

    fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ google_maps_api_key: key })
    })
    .then(res => res.json())
    .then(data => {
        showToast("Settings saved! Reloading map...");
        closeModal('api-key-modal');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    });
}

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toast.innerHTML = `
        <i class="fa-solid fa-${type === 'error' ? 'circle-exclamation' : 'circle-check'}"></i>
        <span>${msg}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 4000);
}
