import re
import time
from urllib.parse import urlparse, urljoin
import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

def clean_emails(emails):
    if not emails:
        return []
    invalid_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.css', '.js']
    ignored_domains = ['sentry.io', 'wixpress.com', 'google.com', 'example.com', 'test.com', 'domain.com', 'sentry-cdn.com']
    cleaned = []
    for email in set(e.strip().lower() for e in emails):
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
            continue
        if any(email.endswith(ext) for ext in invalid_extensions):
            continue
        if any(domain in email for domain in ignored_domains):
            continue
        cleaned.append(email)
    return cleaned

def scrape_website_contact_info(url):
    result = {
        'emails': [],
        'facebook': '',
        'instagram': '',
        'twitter': '',
        'linkedin': '',
        'youtube': ''
    }

    if not url or 'google.com' in url or 'facebook.com' in url:
        return result

    if not re.match(r'^https?://', url, re.IGNORECASE):
        url = 'http://' + url

    visited = set()
    pages_to_scrape = [url]
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
    }

    def scrape_page(page_url):
        if page_url in visited or len(visited) >= 3:
            return
        visited.add(page_url)

        try:
            response = requests.get(page_url, headers=headers, timeout=8, verify=False)
            if response.status_code != 200:
                return

            html = response.text
            if not html:
                return
            
            soup = BeautifulSoup(html, 'html.parser')

            # Extract emails via regex
            email_regex = r'[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+'
            emails = re.findall(email_regex, html)
            if emails:
                result['emails'].extend(emails)

            # Check mailto links
            for mailto_link in soup.select('a[href^="mailto:"]'):
                href = mailto_link.get('href')
                email = href.replace('mailto:', '').split('?')[0]
                if email:
                    result['emails'].append(email)

            # Check social links
            for link in soup.select('a[href]'):
                href = link.get('href').lower()
                orig_href = link.get('href')
                if 'facebook.com/' in href and not result['facebook']:
                    result['facebook'] = orig_href
                if 'instagram.com/' in href and not result['instagram']:
                    result['instagram'] = orig_href
                if 'twitter.com/' in href and not result['twitter']:
                    result['twitter'] = orig_href
                if 'linkedin.com/' in href and not result['linkedin']:
                    result['linkedin'] = orig_href
                if 'youtube.com/' in href and not result['youtube']:
                    result['youtube'] = orig_href

            # Queue contact/about links from homepage
            if len(visited) == 1:
                hostname = urlparse(page_url).hostname
                for a_tag in soup.find_all('a', href=True):
                    text = a_tag.get_text().lower()
                    href = a_tag['href']
                    
                    if any(kw in text for kw in ['contact', 'contacto', 'about', 'nosotros', 'quienes', 'donde']):
                        try:
                            absolute_url = urljoin(page_url, href)
                            # Only queue if same hostname
                            if urlparse(absolute_url).hostname == hostname:
                                pages_to_scrape.append(absolute_url)
                        except Exception:
                            pass
        except Exception:
            pass

    # Process pages queue
    for current_url in pages_to_scrape:
        if len(visited) >= 3:
            break
        scrape_page(current_url)

    result['emails'] = clean_emails(result['emails'])
    return result

def scrape_google_maps(niche, location, limit=10, progress_callback=None):
    def log(event_type, **kwargs):
        if progress_callback:
            progress_callback({'type': event_type, **kwargs})

    query = f"{niche} {location}"
    log('info', message=f'Iniciando búsqueda para: "{query}"...')

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security'
            ]
        )
        
        # Create context and page
        context = browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = context.new_page()
        stealth_obj = Stealth()
        stealth_obj.apply_stealth_sync(page)

        search_url = f"https://www.google.com/maps/search/{re.sub(r'\s+', '+', query)}"
        try:
            page.goto(search_url, wait_until='domcontentloaded', timeout=30000)
        except Exception:
            pass

        log('info', message='Página de Google Maps cargada. Cargando resultados...')

        results = []
        visited_urls = set()

        # Wait for the feed scroll container
        feed_selector = 'div[role="feed"]'
        try:
            page.wait_for_selector(feed_selector, timeout=15000)
        except Exception:
            log('warning', message='No se encontró el contenedor de lista múltiple. ¿Google Maps redirigió a un solo comercio?')

        scroll_attempts = 0
        max_scroll_attempts = 30
        is_end = False

        # Scroll loop
        while len(results) < limit and scroll_attempts < max_scroll_attempts and not is_end:
            # Extract names and links of matching businesses
            places = page.evaluate('''() => {
                const links = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
                return links.map(link => {
                    let title = link.getAttribute('aria-label') || '';
                    if (!title) {
                        const parent = link.closest('.Nv2y1d') || link.parentElement;
                        title = parent?.querySelector('.qBF1Pd')?.textContent || '';
                    }
                    return {
                        title: title.trim(),
                        url: link.href
                    };
                }).filter(p => p.title && p.url);
            }''')

            for place in places:
                url = place['url']
                if url not in visited_urls and len(results) < limit:
                    visited_urls.add(url)
                    results.append({
                        'name': place['title'],
                        'mapsUrl': url,
                        'phone': '',
                        'website': '',
                        'rating': 0.0,
                        'reviewsCount': 0,
                        'address': '',
                        'category': niche
                    })

            log('progress', count=len(results), limit=limit, message=f'Encontrados {len(results)} comercios en la lista...')

            if len(results) >= limit:
                break

            # Scroll down the feed element
            scrolled = page.evaluate(f'''() => {{
                const feed = document.querySelector('{feed_selector}');
                if (feed) {{
                    feed.scrollBy(0, 1000);
                    return true;
                }}
                window.scrollBy(0, 1000);
                return false;
            }}''')

            time.sleep(2.0)

            # Check for end of list
            end_of_list = page.evaluate('''() => {
                return document.body.textContent.includes('Has llegado al final de la lista') || 
                       document.body.textContent.includes('No hay más resultados');
            }''')

            if end_of_list:
                is_end = True
                log('info', message='Se alcanzó el final de la lista de Google Maps.')

            scroll_attempts += 1

        log('info', message=f'Extrayendo información detallada para los {len(results)} comercios...')

        # Details extraction
        for i, business in enumerate(results):
            log('detail-start', index=i, total=len(results), name=business['name'])

            try:
                page.goto(business['mapsUrl'], wait_until='domcontentloaded', timeout=20000)
                # Wait for main business title panel to render
                try:
                    page.wait_for_selector('h1.DUwDvf', timeout=8000)
                except Exception:
                    pass
                time.sleep(1.2)

                details = page.evaluate('''() => {
                    const ratingText = document.querySelector('div.F7nice span[aria-hidden="true"]')?.textContent;
                    const reviewsText = document.querySelector('div.F7nice button[aria-label*="reseña"]')?.textContent || 
                                        document.querySelector('div.F7nice button[aria-label*="reviews"]')?.textContent ||
                                        document.querySelector('div.F7nice button')?.textContent || '';
                    
                    const rating = ratingText ? parseFloat(ratingText.replace(',', '.')) : 0;
                    let reviewsCount = 0;
                    if (reviewsText) {
                        const numMatch = reviewsText.match(/\\d+/);
                        if (numMatch) reviewsCount = parseInt(numMatch[0]);
                    }

                    // Language-independent address parsing (splits on the first colon)
                    const addressBtn = document.querySelector('button[data-item-id="address"]');
                    const addressLabel = addressBtn?.getAttribute('aria-label') || '';
                    const address = addressLabel.includes(':') ? addressLabel.substring(addressLabel.indexOf(':') + 1).trim() : addressLabel;

                    // Language-independent phone parsing from attribute data-item-id
                    const phoneBtn = document.querySelector('button[data-item-id^="phone:tel:"]');
                    let phone = '';
                    if (phoneBtn) {
                        const itemId = phoneBtn.getAttribute('data-item-id') || '';
                        phone = itemId.replace('phone:tel:', '').replace(/\\s+/g, '').trim();
                    }
                    if (!phone && phoneBtn) {
                        const phoneLabel = phoneBtn.getAttribute('aria-label') || '';
                        phone = phoneLabel.includes(':') ? phoneLabel.substring(phoneLabel.indexOf(':') + 1).replace(/\\s+/g, '').trim() : phoneLabel.replace(/\\s+/g, '').trim();
                    }

                    const websiteBtn = document.querySelector('a[data-item-id="authority"]');
                    const website = websiteBtn?.getAttribute('href') || '';

                    return { rating, reviewsCount, address, phone, website };
                }''')

                business['rating'] = details.get('rating', 0.0) or 0.0
                business['reviewsCount'] = details.get('reviewsCount', 0) or 0
                business['address'] = details.get('address', '') or ''
                business['phone'] = details.get('phone', '') or ''
                business['website'] = details.get('website', '') or ''

                if business['website']:
                    log('info', message=f"Buscando correos y redes sociales en: {business['website']}...")
                    contact = scrape_website_contact_info(business['website'])
                    business['emails'] = contact['emails']
                    business['facebook'] = contact['facebook']
                    business['instagram'] = contact['instagram']
                    business['twitter'] = contact['twitter']
                    business['linkedin'] = contact['linkedin']
                    business['youtube'] = contact['youtube']
                else:
                    business['emails'] = []
                    business['facebook'] = ''
                    business['instagram'] = ''
                    business['twitter'] = ''
                    business['linkedin'] = ''
                    business['youtube'] = ''

                log('detail-end', index=i, total=len(results), business=business)

            except Exception as e:
                log('warning', message=f"Error extrayendo detalles de \"{business['name']}\": {str(e)}")

        browser.close()
        log('done', results=results)
        return results
