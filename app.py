import os
import json
import base64
from datetime import datetime
from flask import Flask, jsonify, request, Response, send_from_directory
from flask_cors import CORS
from scraper import scrape_google_maps

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'leads_db.json')

def init_db():
    if not os.path.exists(DB_PATH):
        default_db = {
            'leads': [],
            'searches': []
        }
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(default_db, f, indent=2, ensure_ascii=False)

def read_db():
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print("Error reading database, resetting...", e)
        return {'leads': [], 'searches': []}

def write_db(data):
    try:
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Error writing database", e)

@app.route('/')
def index():
    return app.send_static_file('index.html')

# Serve other static files (css, js)
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# GET dashboard statistics
@app.route('/api/stats', methods=['GET'])
def get_stats():
    db = read_db()
    leads = db.get('leads', [])
    searches = db.get('searches', [])
    
    total_leads = len(leads)
    contactable = len([l for l in leads if l.get('phone') or (l.get('emails') and len(l['emails']) > 0)])
    with_emails = len([l for l in leads if l.get('emails') and len(l['emails']) > 0])
    niches = len(set(l.get('category', '') for l in leads))
    
    return jsonify({
        'totalLeads': total_leads,
        'contactable': contactable,
        'withEmails': with_emails,
        'niches': niches,
        'searchesCount': len(searches)
    })

# GET all leads
@app.route('/api/leads', methods=['GET'])
def get_leads():
    db = read_db()
    return jsonify(db.get('leads', []))

# DELETE single lead
@app.route('/api/leads/<id>', methods=['DELETE'])
def delete_lead(id):
    db = read_db()
    db['leads'] = [l for l in db.get('leads', []) if l.get('id') != id]
    write_db(db)
    return jsonify({'success': True, 'message': 'Lead eliminado correctamente'})

# CLEAR all portfolio
@app.route('/api/clear-leads', methods=['DELETE'])
def clear_leads():
    db = read_db()
    db['leads'] = []
    write_db(db)
    return jsonify({'success': True, 'message': 'Cartera vaciada correctamente'})

# GET search history
@app.route('/api/searches', methods=['GET'])
def get_searches():
    db = read_db()
    return jsonify(db.get('searches', []))

# Real-time search log stream via Server-Sent Events (SSE)
@app.route('/api/search/stream')
def search_stream():
    niche = request.args.get('niche', '').strip()
    location = request.args.get('location', '').strip()
    limit = int(request.args.get('limit', 10))

    if not niche or not location:
        return jsonify({'error': 'Categoría y Ubicación son requeridos'}), 400

    def generate_events():
        scraped_leads = []

        def callback(progress_data):
            # Capture the intermediate scraped details to accumulate them
            if progress_data.get('type') == 'detail-end':
                scraped_leads.append(progress_data['business'])
            # Yield event to frontend
            yield f"data: {json.dumps(progress_data, ensure_ascii=False)}\n\n"

        # Start search
        try:
            results = scrape_google_maps(niche, location, limit, progress_callback=callback)
            
            # Save results into database
            db = read_db()
            new_leads_count = 0
            
            def normalize_name(name):
                return "".join(c for c in name.lower() if c.isalnum()) if name else ""

            for item in results:
                # Generate unique ID
                maps_url = item.get('mapsUrl', '')
                if '/place/' in maps_url:
                    lead_id = maps_url.split('/place/')[1].split('/')[0]
                else:
                    lead_id = base64.b64encode(item['name'].encode('utf-8')).decode('utf-8')[:16]
                
                item['id'] = lead_id
                item['location'] = location
                item['scrapedAt'] = datetime.utcnow().isoformat() + 'Z'
                
                # Check duplication by URL or normalized name
                norm_name = normalize_name(item['name'])
                exists = any(
                    l.get('mapsUrl') == item.get('mapsUrl') or 
                    normalize_name(l.get('name', '')) == norm_name
                    for l in db['leads']
                )
                if not exists:
                    db['leads'].append(item)
                    new_leads_count += 1

            # Save search record
            db['searches'].append({
                'id': base64.b64encode(f"{niche}-{location}-{datetime.utcnow().isoformat()}".encode('utf-8')).decode('utf-8')[:12],
                'niche': niche,
                'location': location,
                'resultsCount': len(results),
                'newLeadsCount': new_leads_count,
                'date': datetime.utcnow().isoformat() + 'Z'
            })
            
            write_db(db)

            # Signal completion
            complete_data = {
                'type': 'complete',
                'resultsCount': len(results),
                'newLeadsCount': new_leads_count
            }
            yield f"data: {json.dumps(complete_data, ensure_ascii=False)}\n\n"

        except Exception as e:
            error_data = {
                'type': 'error',
                'message': str(e)
            }
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"

    # Set response headers for SSE streaming
    headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        'Connection': 'keep-alive'
    }
    return Response(generate_events(), headers=headers)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f"Server starting on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
