import os
import sqlite3
import json
import datetime
from flask import Flask, render_template, request, jsonify, session, send_file

app = Flask(__name__)
app.secret_key = 'hamar_bazar_admin_secret_key_takhatpur'
DB_FILE = os.path.join(os.path.dirname(__file__), 'hamar_bazar.db')
CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'config.json')

# Exact Takhatpur Town Center Coordinates
TAKHATPUR_CENTER_LAT = 22.1448
TAKHATPUR_CENTER_LNG = 81.8698

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(reset=False):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if reset:
        cursor.execute('DROP TABLE IF EXISTS orders')
        cursor.execute('DROP TABLE IF EXISTS shops')
        cursor.execute('DROP TABLE IF EXISTS users')
        conn.commit()
    
    # Users Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mobile TEXT NOT NULL,
            address TEXT,
            manual_order_count INTEGER DEFAULT 0,
            latitude REAL,
            longitude REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Ensure manual_order_count column exists
    cursor.execute("PRAGMA table_info(users)")
    cols = [r["name"] for r in cursor.fetchall()]
    if "manual_order_count" not in cols:
        cursor.execute("ALTER TABLE users ADD COLUMN manual_order_count INTEGER DEFAULT 0")
        conn.commit()
    
    # Shops Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS shops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            owner_name TEXT NOT NULL,
            mobile TEXT NOT NULL,
            category TEXT NOT NULL,
            is_partner INTEGER DEFAULT 1,
            partner_status TEXT DEFAULT 'Verified Partner',
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Ensure is_partner and partner_status columns exist
    cursor.execute("PRAGMA table_info(shops)")
    s_cols = [r["name"] for r in cursor.fetchall()]
    if "is_partner" not in s_cols:
        cursor.execute("ALTER TABLE shops ADD COLUMN is_partner INTEGER DEFAULT 1")
    if "partner_status" not in s_cols:
        cursor.execute("ALTER TABLE shops ADD COLUMN partner_status TEXT DEFAULT 'Verified Partner'")
    conn.commit()

    # Orders Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            shop_id INTEGER,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            delivery_latitude REAL NOT NULL,
            delivery_longitude REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (shop_id) REFERENCES shops (id)
        )
    ''')
    
    # Delivery Riders Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS riders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mobile TEXT NOT NULL,
            vehicle_number TEXT,
            status TEXT DEFAULT 'online',
            latitude REAL,
            longitude REAL,
            speed REAL DEFAULT 0,
            battery INTEGER DEFAULT 100,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Seed data if empty
    cursor.execute('SELECT COUNT(*) FROM shops')
    if cursor.fetchone()[0] == 0:
        print("Seeding initial Takhatpur Tie-up Shops & User Data...")
        shops = [
            ("Sharma Kirana & General Store", "Ramesh Sharma", "9827100101", "Kirana & Grocery", 1, "Verified Partner", 22.1452, 81.8695),
            ("Gupta Sweets & Bakers", "Sanjay Gupta", "9827100102", "Sweets & Bakery", 1, "Gold Partner", 22.1438, 81.8710),
            ("Verma Electronics & Mobile", "Alok Verma", "9827100103", "Electronics", 1, "Verified Partner", 22.1465, 81.8680),
            ("Takhatpur Medical Hall", "Dr. Rajesh Sahu", "9827100104", "Pharmacy", 1, "Verified Partner", 22.1425, 81.8725),
            ("Chhattisgarh Vegetables & Fresh", "Santosh Patel", "9827100105", "Vegetables", 1, "Verified Partner", 22.1480, 81.8665),
            ("New City Garments", "Mahesh Kumar", "9827100106", "Clothing", 0, "Pending Tie-up", 22.1442, 81.8702)
        ]
        cursor.executemany('''
            INSERT INTO shops (name, owner_name, mobile, category, is_partner, partner_status, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', shops)
        
        users = [
            ("Rahul Verma", "9755100201", "Ward No. 4, Main Road, Takhatpur", 1, 22.1460, 81.8690),
            ("Pooja Sahu", "9755100202", "Near Old Bus Stand, Takhatpur", 3, 22.1420, 81.8730),
            ("Amit Patel", "9755100203", "Naya Para, Ward No. 8, Takhatpur", 1, 22.1490, 81.8650),
            ("Suman Singh (VIP)", "9755100204", "Station Road, Takhatpur", 12, 22.1415, 81.8705),
            ("Vikram Yaduvanshi", "9755100205", "College Road, Takhatpur", 5, 22.1472, 81.8740)
        ]
        cursor.executemany('''
            INSERT INTO users (name, mobile, address, manual_order_count, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', users)
        
        orders = [
            (1, 1, 450.00, 'delivered', 22.1460, 81.8690),
            (2, 2, 820.50, 'pending', 22.1420, 81.8730),
            (2, 4, 150.00, 'delivered', 22.1420, 81.8730),
            (2, 1, 650.00, 'delivered', 22.1420, 81.8730),
            (3, 4, 1200.00, 'delivered', 22.1490, 81.8650),
            (4, 3, 350.00, 'pending', 22.1415, 81.8705),
            (5, 5, 2100.00, 'cancelled', 22.1472, 81.8740),
            (5, 1, 680.00, 'delivered', 22.1472, 81.8740),
            (5, 2, 950.00, 'delivered', 22.1472, 81.8740),
            (5, 4, 420.00, 'delivered', 22.1472, 81.8740)
        ]
        cursor.executemany('''
            INSERT INTO orders (user_id, shop_id, amount, status, delivery_latitude, delivery_longitude)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', orders)
        
        riders = [
            ("Ramesh Delivery Rider", "9876543210", "CG 10 AB 1234", "online", 22.1440, 81.8700, 24.5, 92),
            ("Suresh Delivery Rider", "9876543211", "CG 10 CD 5678", "delivering", 22.1462, 81.8675, 31.0, 78)
        ]
        cursor.executemany('''
            INSERT INTO riders (name, mobile, vehicle_number, status, latitude, longitude, speed, battery)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', riders)
        
    conn.commit()
    conn.close()

def get_config():
    default_config = {
        "google_maps_api_key": os.environ.get("GOOGLE_MAPS_API_KEY", ""),
        "center_lat": TAKHATPUR_CENTER_LAT,
        "center_lng": TAKHATPUR_CENTER_LNG,
        "default_zoom": 15,
        "area_name": "Takhatpur Town, Bilaspur (C.G.)"
    }
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                saved = json.load(f)
                default_config.update(saved)
        except Exception as e:
            print("Config read error:", e)
    return default_config

def save_config(new_config):
    cfg = get_config()
    cfg.update(new_config)
    with open(CONFIG_FILE, 'w') as f:
        json.dump(cfg, f, indent=2)
    return cfg

init_db(reset=False)

# ----------------- ROUTES -----------------

@app.route('/')
def index():
    cfg = get_config()
    return render_template('index.html', config=cfg)

@app.route('/api/config', methods=['GET', 'POST'])
def handle_config():
    if request.method == 'POST':
        data = request.json or {}
        key = data.get('google_maps_api_key', '').strip()
        updated = save_config({"google_maps_api_key": key})
        return jsonify({"status": "success", "config": updated})
    return jsonify(get_config())

# Unified Map Locations endpoint
@app.route('/api/map/locations', methods=['GET'])
def get_map_locations():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    locations = []
    
    # Shops with tie-up status & total orders fulfilled
    cursor.execute('''
        SELECT s.id, s.name, s.owner_name, s.mobile, s.category, s.is_partner, s.partner_status,
               s.latitude, s.longitude, COUNT(o.id) as total_fulfilled
        FROM shops s
        LEFT JOIN orders o ON s.id = o.shop_id
        GROUP BY s.id
    ''')
    for row in cursor.fetchall():
        locations.append({
            "id": row["id"],
            "type": "shop",
            "name": row["name"],
            "owner_name": row["owner_name"],
            "mobile": row["mobile"],
            "category": row["category"],
            "is_partner": bool(row["is_partner"]),
            "partner_status": row["partner_status"],
            "total_fulfilled": row["total_fulfilled"],
            "lat": row["latitude"],
            "lng": row["longitude"]
        })
        
    # Users with combined orders count & customer tier classification
    cursor.execute('''
        SELECT u.id, u.name, u.mobile, u.address, u.manual_order_count, u.latitude, u.longitude,
               COUNT(o.id) as real_orders_count, COALESCE(SUM(o.amount), 0) as total_spent
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        WHERE u.latitude IS NOT NULL AND u.longitude IS NOT NULL
        GROUP BY u.id
    ''')
    for row in cursor.fetchall():
        real_count = row["real_orders_count"] or 0
        manual_count = row["manual_order_count"] or 0
        final_orders_count = max(real_count, manual_count)
        
        # Tier logic:
        # > 10 orders = Premium Customer (Gold)
        # > 2 orders = Active Customer (Green)
        # 1 or fewer orders = Normal Customer (Blue)
        if final_orders_count > 10:
            customer_tier = "premium"
            tier_label = "Premium Customer"
        elif final_orders_count > 2:
            customer_tier = "active"
            tier_label = "Active Customer"
        else:
            customer_tier = "normal"
            tier_label = "Normal Customer"
        
        locations.append({
            "id": row["id"],
            "type": "user",
            "name": row["name"],
            "mobile": row["mobile"],
            "address": row["address"],
            "manual_order_count": manual_count,
            "total_orders": final_orders_count,
            "customer_tier": customer_tier,
            "tier_label": tier_label,
            "total_spent": row["total_spent"],
            "lat": row["latitude"],
            "lng": row["longitude"]
        })
        
    # Active Delivery Riders
    cursor.execute('''
        SELECT id, name, mobile, vehicle_number, status, latitude, longitude, speed, battery, last_updated
        FROM riders
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND status != 'offline'
    ''')
    for row in cursor.fetchall():
        locations.append({
            "id": row["id"],
            "type": "rider",
            "name": row["name"],
            "mobile": row["mobile"],
            "vehicle_number": row["vehicle_number"],
            "status": row["status"],
            "speed": row["speed"] or 0,
            "battery": row["battery"] or 100,
            "last_updated": row["last_updated"],
            "lat": row["latitude"],
            "lng": row["longitude"]
        })
        
    conn.close()
    return jsonify(locations)

# ----------------- DELIVERY RIDER ROUTES -----------------

@app.route('/rider')
def rider_page():
    return render_template('rider.html')

@app.route('/api/riders', methods=['GET', 'POST'])
def handle_riders():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.json or {}
        name = data.get('name', '').strip()
        mobile = data.get('mobile', '').strip()
        vehicle_number = data.get('vehicle_number', '').strip()
        
        if not name or not mobile:
            conn.close()
            return jsonify({"status": "error", "message": "Name and mobile number are required"}), 400
            
        cursor.execute('''
            INSERT INTO riders (name, mobile, vehicle_number, status, latitude, longitude)
            VALUES (?, ?, ?, 'online', 22.1448, 81.8698)
        ''', (name, mobile, vehicle_number))
        conn.commit()
        rider_id = cursor.lastrowid
        conn.close()
        return jsonify({"status": "success", "message": f"Delivery rider {name} added!", "rider_id": rider_id})
        
    cursor.execute("SELECT * FROM riders")
    riders = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(riders)

@app.route('/api/rider/location', methods=['POST'])
def update_rider_location():
    data = request.json or {}
    rider_id = data.get('rider_id')
    lat = data.get('latitude')
    lng = data.get('longitude')
    speed = data.get('speed', 0)
    battery = data.get('battery', 100)
    status = data.get('status', 'online')
    
    if not rider_id or lat is None or lng is None:
        return jsonify({"status": "error", "message": "rider_id, latitude, and longitude are required"}), 400
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE riders
            SET latitude = ?, longitude = ?, speed = ?, battery = ?, status = ?, last_updated = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (float(lat), float(lng), float(speed), int(battery), status, int(rider_id)))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Live rider location updated successfully"})
    except Exception as e:
        print("Error updating rider location:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/riders/<int:rider_id>', methods=['DELETE', 'POST'])
def delete_rider(rider_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM riders WHERE id = ?", (rider_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": f"Rider #{rider_id} deleted successfully"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Detailed User Info endpoint with user's complete order history list
@app.route('/api/users/<int:user_id>/orders', methods=['GET'])
def user_orders(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT o.*, s.name as shop_name 
        FROM orders o
        LEFT JOIN shops s ON o.shop_id = s.id
        WHERE o.user_id = ?
        ORDER BY o.id DESC
    ''', (user_id,))
    orders = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(orders)

# Direct endpoint to set/update user order count manually
@app.route('/api/users/<int:user_id>/order_count', methods=['PUT'])
def update_user_order_count(user_id):
    data = request.json or {}
    order_count = data.get('manual_order_count')
    if order_count is None or int(order_count) < 0:
        return jsonify({"status": "error", "message": "Valid order count required"}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET manual_order_count=? WHERE id=?', (int(order_count), user_id))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": f"User order count updated to {order_count}"})

# Delete User endpoint
@app.route('/api/users/<int:user_id>', methods=['DELETE', 'POST'])
def delete_user(user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM orders WHERE user_id = ?', (user_id,))
        cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": f"User #{user_id} deleted successfully"})
    except Exception as e:
        print(f"Error deleting user {user_id}: {e}")
        return jsonify({"status": "error", "message": f"Failed to delete user: {str(e)}"}), 500

# Shops CRUD
@app.route('/api/shops', methods=['GET', 'POST'])
def handle_shops():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.json or {}
        name = data.get('name')
        owner_name = data.get('owner_name', '')
        mobile = data.get('mobile', '')
        category = data.get('category', 'General Store')
        partner_status = data.get('partner_status', 'Verified Partner')
        is_partner = 1 if partner_status != 'Pending Tie-up' else 0
        lat = data.get('latitude')
        lng = data.get('longitude')
        
        if not name or lat is None or lng is None:
            conn.close()
            return jsonify({"status": "error", "message": "Name, latitude and longitude are required"}), 400
            
        cursor.execute('''
            INSERT INTO shops (name, owner_name, mobile, category, is_partner, partner_status, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (name, owner_name, mobile, category, is_partner, partner_status, float(lat), float(lng)))
        shop_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute('SELECT * FROM shops WHERE id = ?', (shop_id,))
        new_shop = dict(cursor.fetchone())
        conn.close()
        return jsonify({"status": "success", "shop": new_shop})
        
    cursor.execute('SELECT * FROM shops ORDER BY id DESC')
    shops = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(shops)

@app.route('/api/shops/<int:shop_id>', methods=['GET', 'PUT', 'DELETE'])
def shop_detail(shop_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM shops WHERE id = ?', (shop_id,))
    shop = cursor.fetchone()
    if not shop:
        conn.close()
        return jsonify({"status": "error", "message": "Shop not found"}), 404
        
    if request.method == 'DELETE':
        cursor.execute('DELETE FROM orders WHERE shop_id = ?', (shop_id,))
        cursor.execute('DELETE FROM shops WHERE id = ?', (shop_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "Shop deleted successfully"})
        
    if request.method == 'PUT':
        data = request.json or {}
        name = data.get('name', shop['name'])
        owner_name = data.get('owner_name', shop['owner_name'])
        mobile = data.get('mobile', shop['mobile'])
        category = data.get('category', shop['category'])
        partner_status = data.get('partner_status', shop['partner_status'])
        is_partner = 1 if partner_status != 'Pending Tie-up' else 0
        lat = data.get('latitude', shop['latitude'])
        lng = data.get('longitude', shop['longitude'])
        
        cursor.execute('''
            UPDATE shops 
            SET name=?, owner_name=?, mobile=?, category=?, is_partner=?, partner_status=?, latitude=?, longitude=?
            WHERE id=?
        ''', (name, owner_name, mobile, category, is_partner, partner_status, float(lat), float(lng), shop_id))
        conn.commit()
        
        cursor.execute('SELECT * FROM shops WHERE id = ?', (shop_id,))
        updated = dict(cursor.fetchone())
        conn.close()
        return jsonify({"status": "success", "shop": updated})
        
    conn.close()
    return jsonify(dict(shop))

@app.route('/api/shops/<int:shop_id>/location', methods=['PUT'])
def update_shop_location(shop_id):
    data = request.json or {}
    lat = data.get('latitude')
    lng = data.get('longitude')
    if lat is None or lng is None:
        return jsonify({"status": "error", "message": "Latitude and longitude required"}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE shops SET latitude=?, longitude=? WHERE id=?', (float(lat), float(lng), shop_id))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "Shop location updated"})

# Users CRUD & Add User with manual_order_count
@app.route('/api/users', methods=['GET', 'POST'])
def handle_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.json or {}
        name = data.get('name')
        mobile = data.get('mobile', '')
        address = data.get('address', '')
        manual_order_count = int(data.get('manual_order_count', 1))
        lat = data.get('latitude')
        lng = data.get('longitude')
        
        if not name:
            conn.close()
            return jsonify({"status": "error", "message": "User name is required"}), 400
            
        cursor.execute('''
            INSERT INTO users (name, mobile, address, manual_order_count, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (name, mobile, address, manual_order_count, float(lat) if lat else None, float(lng) if lng else None))
        user_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        new_user = dict(cursor.fetchone())
        conn.close()
        return jsonify({"status": "success", "user": new_user})
        
    cursor.execute('SELECT * FROM users ORDER BY id DESC')
    users = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(users)

@app.route('/api/users/<int:user_id>/location', methods=['PUT'])
def update_user_location(user_id):
    data = request.json or {}
    lat = data.get('latitude')
    lng = data.get('longitude')
    if lat is None or lng is None:
        return jsonify({"status": "error", "message": "Latitude and longitude required"}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET latitude=?, longitude=? WHERE id=?', (float(lat), float(lng), user_id))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "User location updated"})

# Orders CRUD & Delete Order
@app.route('/api/orders', methods=['GET', 'POST'])
def handle_orders():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.json or {}
        user_id = data.get('user_id')
        shop_id = data.get('shop_id')
        amount = data.get('amount')
        lat = data.get('delivery_latitude')
        lng = data.get('delivery_longitude')
        status = data.get('status', 'pending')
        
        if amount is None or lat is None or lng is None:
            conn.close()
            return jsonify({"status": "error", "message": "Amount, delivery latitude and longitude required"}), 400
            
        cursor.execute('''
            INSERT INTO orders (user_id, shop_id, amount, status, delivery_latitude, delivery_longitude)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, shop_id, float(amount), status, float(lat), float(lng)))
        order_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute('SELECT * FROM orders WHERE id = ?', (order_id,))
        new_order = dict(cursor.fetchone())
        conn.close()
        return jsonify({"status": "success", "order": new_order})
        
    cursor.execute('''
        SELECT o.*, u.name as user_name, s.name as shop_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN shops s ON o.shop_id = s.id
        ORDER BY o.id DESC
    ''')
    orders = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(orders)

@app.route('/api/orders/<int:order_id>', methods=['DELETE'])
def delete_order(order_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM orders WHERE id = ?', (order_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": f"Order #{order_id} deleted successfully"})

@app.route('/api/orders/<int:order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    data = request.json or {}
    status = data.get('status')
    if not status or status not in ['pending', 'delivered', 'cancelled']:
        return jsonify({"status": "error", "message": "Valid status (pending, delivered, cancelled) required"}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE orders SET status=? WHERE id=?', (status, order_id))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": f"Order status updated to {status}"})

# Search endpoint
@app.route('/api/search', methods=['GET'])
def search_locations():
    query = request.args.get('q', '').strip().lower()
    if not query:
        return jsonify([])
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    results = []
    
    # Search Shops
    cursor.execute('''
        SELECT id, name, owner_name, mobile, category, partner_status, latitude, longitude 
        FROM shops 
        WHERE LOWER(name) LIKE ? OR LOWER(owner_name) LIKE ? OR mobile LIKE ?
    ''', (f'%{query}%', f'%{query}%', f'%{query}%'))
    for r in cursor.fetchall():
        results.append({
            "id": r["id"],
            "type": "shop",
            "name": r["name"],
            "subtitle": f"Shop ({r['category']}) • {r['partner_status']} • {r['owner_name']}",
            "lat": r["latitude"],
            "lng": r["longitude"]
        })
        
    # Search Users
    cursor.execute('''
        SELECT u.id, u.name, u.mobile, u.address, u.manual_order_count, u.latitude, u.longitude, COUNT(o.id) as real_count
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        WHERE (LOWER(u.name) LIKE ? OR u.mobile LIKE ?) AND u.latitude IS NOT NULL
        GROUP BY u.id
    ''', (f'%{query}%', f'%{query}%'))
    for r in cursor.fetchall():
        cnt = max(r["real_count"] or 0, r["manual_order_count"] or 0)
        results.append({
            "id": r["id"],
            "type": "user",
            "name": r["name"],
            "subtitle": f"User ({cnt} Orders) • {r['mobile']}",
            "lat": r["latitude"],
            "lng": r["longitude"]
        })
        
    # Search Orders
    cursor.execute('''
        SELECT o.id, o.amount, o.status, o.delivery_latitude, o.delivery_longitude, u.name as user_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE CAST(o.id AS TEXT) LIKE ? OR LOWER(u.name) LIKE ?
    ''', (f'%{query}%', f'%{query}%'))
    for r in cursor.fetchall():
        results.append({
            "id": r["id"],
            "type": "order",
            "name": f"Order #{r['id']} (₹{r['amount']})",
            "subtitle": f"Order • Status: {r['status'].capitalize()} • Customer: {r['user_name'] or 'Unknown'}",
            "lat": r["delivery_latitude"],
            "lng": r["delivery_longitude"]
        })
        
    conn.close()
    return jsonify(results)

# ----------------- DB BACKUP & RESTORE ROUTES -----------------

@app.route('/api/db/download', methods=['GET'])
def download_db():
    try:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"hamar_bazar_backup_{timestamp}.db"
        return send_file(DB_FILE, as_attachment=True, download_name=filename, mimetype='application/x-sqlite3')
    except Exception as e:
        print("Error downloading database:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/db/export-json', methods=['GET'])
def export_db_json():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM shops")
        shops = [dict(r) for r in cursor.fetchall()]
        
        cursor.execute("SELECT * FROM users")
        users = [dict(r) for r in cursor.fetchall()]
        
        cursor.execute("SELECT * FROM orders")
        orders = [dict(r) for r in cursor.fetchall()]
        
        cursor.execute("SELECT * FROM riders")
        riders = [dict(r) for r in cursor.fetchall()]
        
        conn.close()
        
        backup_data = {
            "exported_at": datetime.datetime.now().isoformat(),
            "shops": shops,
            "users": users,
            "orders": orders,
            "riders": riders
        }
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"hamar_bazar_backup_{timestamp}.json"
        
        response = jsonify(backup_data)
        response.headers["Content-Disposition"] = f"attachment; filename={filename}"
        return response
    except Exception as e:
        print("Error exporting JSON database:", e)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/db/upload', methods=['POST'])
def upload_db():
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400
        
    uploaded_file = request.files['file']
    if not uploaded_file or uploaded_file.filename == '':
        return jsonify({"status": "error", "message": "Selected file is empty"}), 400
        
    fname = uploaded_file.filename.lower()
    
    try:
        if fname.endswith('.json'):
            content = json.load(uploaded_file)
            shops = content.get('shops', [])
            users = content.get('users', [])
            orders = content.get('orders', [])
            riders = content.get('riders', [])
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM orders")
            cursor.execute("DELETE FROM shops")
            cursor.execute("DELETE FROM users")
            cursor.execute("DELETE FROM riders")
            
            for s in shops:
                cursor.execute('''
                    INSERT INTO shops (id, name, owner_name, mobile, category, is_partner, partner_status, latitude, longitude)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (s.get('id'), s['name'], s.get('owner_name', ''), s.get('mobile', ''), s.get('category', 'General'), s.get('is_partner', 1), s.get('partner_status', 'Verified Partner'), s['latitude'], s['longitude']))
                
            for u in users:
                cursor.execute('''
                    INSERT INTO users (id, name, mobile, address, manual_order_count, latitude, longitude)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (u.get('id'), u['name'], u.get('mobile', ''), u.get('address', ''), u.get('manual_order_count', 0), u.get('latitude'), u.get('longitude')))
                
            for o in orders:
                cursor.execute('''
                    INSERT INTO orders (id, user_id, shop_id, amount, status, delivery_latitude, delivery_longitude)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (o.get('id'), o.get('user_id'), o.get('shop_id'), o['amount'], o.get('status', 'pending'), o['delivery_latitude'], o['delivery_longitude']))
                
            for r in riders:
                cursor.execute('''
                    INSERT INTO riders (id, name, mobile, vehicle_number, status, latitude, longitude, speed, battery)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (r.get('id'), r['name'], r.get('mobile', ''), r.get('vehicle_number', ''), r.get('status', 'online'), r.get('latitude', 22.1448), r.get('longitude', 81.8698), r.get('speed', 0), r.get('battery', 100)))
                
            conn.commit()
            conn.close()
            
            return jsonify({"status": "success", "message": "JSON Database with Riders restored successfully!"})
            
        elif fname.endswith(('.db', '.sqlite', '.sqlite3')):
            temp_path = os.path.join(os.path.dirname(__file__), 'temp_upload.db')
            uploaded_file.save(temp_path)
            
            test_conn = sqlite3.connect(temp_path)
            test_cursor = test_conn.cursor()
            test_cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [t[0] for t in test_cursor.fetchall()]
            test_conn.close()
            
            if 'shops' not in tables and 'users' not in tables:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                return jsonify({"status": "error", "message": "Uploaded file is not a valid Hamar Bazar SQLite database"}), 400
                
            if os.path.exists(DB_FILE):
                try:
                    os.remove(DB_FILE)
                except Exception as ex:
                    print("Remove warning:", ex)
                    
            if os.path.exists(temp_path):
                import shutil
                shutil.copyfile(temp_path, DB_FILE)
                os.remove(temp_path)
            
            init_db(reset=False)
            
            return jsonify({"status": "success", "message": "SQLite Database file restored successfully!"})
        else:
            return jsonify({"status": "error", "message": "Invalid file format. Please upload a .db or .json file"}), 400
            
    except Exception as e:
        print("Error restoring database:", e)
        return jsonify({"status": "error", "message": f"Restore failed: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting Hamar Bazar Location Manager on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
