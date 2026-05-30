import os
import json
import base64
import random
from datetime import datetime
from flask import Flask, jsonify, request, Response, send_from_directory
from flask_cors import CORS
from scraper import scrape_google_maps

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'leads_db.json')

# ──────────────────────────────────────────────
# OUTREACH MESSAGE GENERATOR (Smart Templates)
# ──────────────────────────────────────────────

def generate_outreach_message(lead, demo_url=None):
    """Generate a unique outreach message using smart template combination."""
    name = lead.get('name', 'su negocio')
    has_website = bool(lead.get('website'))
    rating = lead.get('rating', 0)
    reviews = lead.get('reviewsCount', 0)
    category = lead.get('category', '')
    location = lead.get('location', '')
    location_short = location.split(',')[0] if location else 'su zona'

    if not has_website:
        return _generate_no_web_message(name, category, location_short, rating, reviews, demo_url)
    else:
        return _generate_has_web_message(name, category, location_short, rating, reviews, lead.get('website', ''))


def _generate_no_web_message(name, category, location, rating, reviews, demo_url):
    """Messages for businesses WITHOUT a website."""
    demo_link = demo_url or 'https://capitask-software.netlify.app/'

    greetings = [
        "Hola, buenas",
        "¡Hola! Buen día",
        "Hola, ¿cómo están?",
        "¡Buenas tardes!",
        "Hola, un gusto saludarles",
    ]

    intros = [
        f'He visto que su negocio "{name}" aún no cuenta con una página web propia.',
        f'Noté que "{name}" no tiene presencia web y me llamó la atención porque tienen un excelente negocio.',
        f'Estuve revisando negocios de {category} en {location} y vi que "{name}" todavía no tiene sitio web.',
        f'Vi su negocio "{name}" en Google Maps y noté que no cuentan con una página web.',
        f'Encontré "{name}" con {rating} estrellas en Google Maps, un negocio increíble que merece tener presencia digital.',
    ]

    presentations = [
        'Me presento, soy Eliecer Bedoya, programador web y encargado de la empresa Capitask.',
        'Soy Eliecer Bedoya, desarrollador web profesional de Capitask.',
        'Mi nombre es Eliecer Bedoya, lidero el equipo de desarrollo en Capitask.',
        'Soy Eliecer Bedoya de Capitask, nos dedicamos a crear páginas web profesionales para negocios como el suyo.',
    ]

    offers = [
        f'Le he preparado una propuesta visual de cómo podría lucir su página web. Puede verla aquí: {demo_link}',
        f'Me tomé la libertad de diseñar un prototipo de página web para su negocio. Échele un vistazo: {demo_link}',
        f'Creé una demo personalizada para que vea cómo quedaría su sitio web profesional: {demo_link}',
        f'Preparé un ejemplo de sitio web pensado especialmente para su negocio, puede revisarlo aquí: {demo_link}',
    ]

    closings = [
        '¿Le gustaría que coordinemos una breve reunión para revisarlo juntos? ¡Quedo atento!',
        '¿Le interesaría agendar una llamada rápida de 5 minutos para mostrarle la propuesta completa? ¡Saludos!',
        '¿Podríamos tener una conversación breve al respecto? Estoy a su disposición. ¡Un saludo!',
        'Si le interesa, con gusto le explico los detalles. ¿Cuándo le quedaría bien conversar?',
        '¿Estaría abierto a que le presente la propuesta sin compromiso? ¡Quedo pendiente de su respuesta!',
    ]

    portfolio = random.choice([
        f'\n\nConozca más sobre nuestros servicios: https://capitask-software.netlify.app/',
        f'\n\nPuede ver nuestro portafolio completo aquí: https://capitask-software.netlify.app/',
        '',
    ])

    msg = f"{random.choice(greetings)}. {random.choice(intros)}\n\n{random.choice(presentations)}\n\n{random.choice(offers)}{portfolio}\n\n{random.choice(closings)}"
    return msg


def _generate_has_web_message(name, category, location, rating, reviews, website):
    """Messages for businesses WITH a website."""
    web_short = website.replace('https://', '').replace('http://', '').replace('www.', '').rstrip('/')

    greetings = [
        "Hola, buenas",
        "¡Hola! Buen día",
        "Hola, ¿cómo están?",
        "¡Buenas tardes!",
        "Hola, un gusto saludarles",
    ]

    intros = [
        f'Vi su negocio "{name}" en Google Maps y estuve revisando su sitio web ({web_short}).',
        f'Encontré "{name}" con {rating} estrellas y revisé su página web actual.',
        f'Estuve analizando negocios de {category} en {location} y su sitio web llamó mi atención.',
        f'Noté que "{name}" tiene un sitio web activo y quería compartirle algunas observaciones.',
        f'Revisé su presencia digital de "{name}" y encontré oportunidades interesantes para mejorar su alcance.',
    ]

    presentations = [
        'Soy Eliecer Bedoya de Capitask, nos especializamos en desarrollo web profesional.',
        'Me presento, soy Eliecer Bedoya, desarrollador web de la empresa Capitask.',
        'Mi nombre es Eliecer Bedoya, lidero el equipo técnico de Capitask.',
        'Soy Eliecer Bedoya, programador web y encargado de Capitask.',
    ]

    observations = [
        'Noté algunas oportunidades de mejora en la velocidad de carga y el diseño móvil que podrían ayudarles a captar más clientes.',
        'Detecté que su sitio podría optimizarse para aparecer mejor posicionado en Google y atraer más visitas.',
        'Vi que hay margen para mejorar la experiencia de usuario en celulares y la velocidad de su página.',
        'Identifiqué áreas donde un rediseño moderno podría aumentar significativamente sus consultas y ventas online.',
        'Encontré puntos de mejora en su web que, con ajustes estratégicos, podrían multiplicar sus clientes digitales.',
    ]

    closings = [
        '¿Estaría abierto a que le envíe una propuesta rápida y sin compromiso? ¡Saludos!',
        '¿Le interesaría una auditoría gratuita de 2 minutos de su sitio? Estoy a su disposición.',
        '¿Podríamos tener una llamada breve para mostrarle las mejoras? ¡Quedo pendiente!',
        'Si le interesa, puedo preparar una propuesta personalizada sin costo. ¿Qué le parece?',
        '¿Le gustaría ver cómo podría lucir su sitio web mejorado? ¡Con gusto se lo muestro!',
    ]

    portfolio = f'\n\nConozca nuestro trabajo: https://capitask-software.netlify.app/'

    msg = f"{random.choice(greetings)}. {random.choice(intros)}\n\n{random.choice(presentations)}\n\n{random.choice(observations)}{portfolio}\n\n{random.choice(closings)}"
    return msg

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
        import queue
        import threading

        event_queue = queue.Queue()

        def callback(progress_data):
            if progress_data.get('type') == 'detail-end':
                pass  # will be sent directly via queue
            event_queue.put(progress_data)

        def run_scraper():
            try:
                results = scrape_google_maps(niche, location, limit, progress_callback=callback)
                
                # Save results into database
                db = read_db()
                new_leads_count = 0
                
                def normalize_name(name):
                    return "".join(c for c in name.lower() if c.isalnum()) if name else ""

                for item in results:
                    maps_url = item.get('mapsUrl', '')
                    if '/place/' in maps_url:
                        lead_id = maps_url.split('/place/')[1].split('/')[0]
                    else:
                        lead_id = base64.b64encode(item['name'].encode('utf-8')).decode('utf-8')[:16]
                    
                    item['id'] = lead_id
                    item['location'] = location
                    item['scrapedAt'] = datetime.utcnow().isoformat() + 'Z'
                    
                    norm_name = normalize_name(item['name'])
                    exists = any(
                        l.get('mapsUrl') == item.get('mapsUrl') or 
                        normalize_name(l.get('name', '')) == norm_name
                        for l in db['leads']
                    )
                    if not exists:
                        db['leads'].append(item)
                        new_leads_count += 1

                db['searches'].append({
                    'id': base64.b64encode(f"{niche}-{location}-{datetime.utcnow().isoformat()}".encode('utf-8')).decode('utf-8')[:12],
                    'niche': niche,
                    'location': location,
                    'resultsCount': len(results),
                    'newLeadsCount': new_leads_count,
                    'date': datetime.utcnow().isoformat() + 'Z'
                })
                
                write_db(db)

                event_queue.put({
                    'type': 'complete',
                    'resultsCount': len(results),
                    'newLeadsCount': new_leads_count
                })

            except Exception as e:
                event_queue.put({'type': 'error', 'message': str(e)})
            finally:
                event_queue.put(None)  # Sentinel to signal end

        thread = threading.Thread(target=run_scraper, daemon=True)
        thread.start()

        while True:
            try:
                event = event_queue.get(timeout=120)
                if event is None:
                    break
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            except queue.Empty:
                # Send a keepalive comment to prevent timeout
                yield ": keepalive\n\n"
                break

    # Set response headers for SSE streaming
    headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        'Connection': 'keep-alive'
    }
    return Response(generate_events(), headers=headers)

# Generate unique outreach message
@app.route('/api/generate-message', methods=['POST'])
def api_generate_message():
    data = request.get_json()
    lead = data.get('lead', {})
    demo_url = data.get('demoUrl', None)

    if not lead.get('name'):
        return jsonify({'error': 'Lead data is required'}), 400

    message = generate_outreach_message(lead, demo_url)
    return jsonify({'message': message})

# Mark lead as contacted
@app.route('/api/leads/<id>/contacted', methods=['PATCH'])
def mark_contacted(id):
    db = read_db()
    for lead in db.get('leads', []):
        if lead.get('id') == id:
            lead['contacted'] = True
            lead['contactedAt'] = datetime.utcnow().isoformat() + 'Z'
            write_db(db)
            return jsonify({'success': True, 'message': 'Lead marcado como contactado'})
    return jsonify({'success': False, 'message': 'Lead no encontrado'}), 404

# Unmark lead as contacted
@app.route('/api/leads/<id>/uncontacted', methods=['PATCH'])
def unmark_contacted(id):
    db = read_db()
    for lead in db.get('leads', []):
        if lead.get('id') == id:
            lead['contacted'] = False
            lead.pop('contactedAt', None)
            write_db(db)
            return jsonify({'success': True, 'message': 'Lead desmarcado'})
    return jsonify({'success': False, 'message': 'Lead no encontrado'}), 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    print(f"Server starting on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
