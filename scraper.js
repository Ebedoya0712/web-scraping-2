import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import * as cheerio from 'cheerio';

puppeteer.use(StealthPlugin());

// Clean up emails from matches
function cleanEmails(emails) {
  if (!emails) return [];
  const invalidExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.css', '.js'];
  return [...new Set(emails.map(e => e.trim().toLowerCase()))].filter(email => {
    // Basic regex validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    // Remove image/asset false positives
    return !invalidExtensions.some(ext => email.endsWith(ext));
  });
}

// Scrape email & socials from a website URL
export async function scrapeWebsiteContactInfo(url) {
  const result = {
    emails: [],
    facebook: '',
    instagram: '',
    twitter: '',
    linkedin: '',
    youtube: ''
  };

  if (!url || url.includes('google.com') || url.includes('facebook.com')) {
    return result;
  }

  // Ensure URL has protocol
  let targetUrl = url;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'http://' + targetUrl;
  }

  const visited = new Set();
  const pagesToScrape = [targetUrl];

  async function scrapePage(pageUrl) {
    if (visited.has(pageUrl) || visited.size >= 3) return; // limit to 3 pages per business
    visited.add(pageUrl);

    try {
      const response = await axios.get(pageUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
        },
        validateStatus: false
      });

      if (response.status !== 200) return;

      const html = response.data;
      if (typeof html !== 'string') return;
      const $ = cheerio.load(html);

      // Extract emails using regex
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
      const matches = html.match(emailRegex);
      if (matches) {
        result.emails.push(...matches);
      }

      // Check mailto links
      $('a[href^="mailto:"]').each((i, el) => {
        const mailto = $(el).attr('href').replace(/^mailto:/i, '').split('?')[0];
        if (mailto) result.emails.push(mailto);
      });

      // Extract socials
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href').toLowerCase();
        if (href.includes('facebook.com/') && !result.facebook) {
          result.facebook = $(el).attr('href');
        }
        if (href.includes('instagram.com/') && !result.instagram) {
          result.instagram = $(el).attr('href');
        }
        if (href.includes('twitter.com/') && !result.twitter) {
          result.twitter = $(el).attr('href');
        }
        if (href.includes('linkedin.com/') && !result.linkedin) {
          result.linkedin = $(el).attr('href');
        }
        if (href.includes('youtube.com/') && !result.youtube) {
          result.youtube = $(el).attr('href');
        }
      });

      // Find Contact/About links to queue them for scraping
      if (visited.size === 1) { // Only queue from main homepage
        $('a').each((i, el) => {
          const text = $(el).text().toLowerCase();
          const href = $(el).attr('href');
          if (!href) return;

          if (text.includes('contact') || text.includes('contacto') || text.includes('about') || text.includes('nosotros') || text.includes('quienes') || text.includes('donde')) {
            try {
              const absoluteUrl = new URL(href, pageUrl).toString();
              // Only scan pages on the same domain
              if (new URL(absoluteUrl).hostname === new URL(pageUrl).hostname) {
                pagesToScrape.push(absoluteUrl);
              }
            } catch (e) {
              // ignore invalid URL
            }
          }
        });
      }

    } catch (error) {
      // Ignore network errors for single pages
    }
  }

  // Crawl queued pages
  for (let i = 0; i < pagesToScrape.length; i++) {
    if (visited.size >= 3) break;
    await scrapePage(pagesToScrape[i]);
  }

  result.emails = cleanEmails(result.emails);
  return result;
}

// Scrape Google Maps results
export async function scrapeGoogleMaps(niche, location, limit = 10, onProgress = () => {}) {
  const query = `${niche} ${location}`;
  onProgress({ type: 'info', message: `Iniciando búsqueda para: "${query}"...` });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  onProgress({ type: 'info', message: 'Página de Google Maps cargada. Cargando resultados...' });

  const results = [];
  const visitedUrls = new Set();

  try {
    // Wait for the feed container (where list of businesses is shown)
    // On Google Maps, the left pane has role="feed"
    const feedSelector = 'div[role="feed"]';
    try {
      await page.waitForSelector(feedSelector, { timeout: 15000 });
    } catch (e) {
      // Maybe only one business loaded directly
      onProgress({ type: 'warning', message: 'No se encontró el contenedor de lista múltiple. ¿Google Maps redirigió a un solo comercio?' });
    }

    let isEnd = false;
    let scrollAttempts = 0;
    const maxScrollAttempts = 30;

    // Scroll loop to load elements
    while (results.length < limit && scrollAttempts < maxScrollAttempts && !isEnd) {
      // Get all list items that are clickable places
      const places = await page.evaluate(() => {
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
      });

      // Add newly found places to our tracking set
      for (const place of places) {
        if (!visitedUrls.has(place.url) && results.length < limit) {
          visitedUrls.add(place.url);
          results.push({
            name: place.title,
            mapsUrl: place.url,
            phone: '',
            website: '',
            rating: 0,
            reviewsCount: 0,
            address: '',
            category: niche
          });
        }
      }

      onProgress({ type: 'progress', count: results.length, limit, message: `Encontrados ${results.length} comercios en la lista...` });

      if (results.length >= limit) break;

      // Scroll the container
      const scrolled = await page.evaluate((selector) => {
        const feed = document.querySelector(selector);
        if (feed) {
          feed.scrollBy(0, 1000);
          return true;
        }
        window.scrollBy(0, 1000);
        return false;
      }, feedSelector);

      await new Promise(r => setTimeout(r, 2000));

      // Check if we hit the end of the list
      const endOfList = await page.evaluate(() => {
        return document.body.textContent.includes('Has llegado al final de la lista') || 
               document.body.textContent.includes('No hay más resultados');
      });

      if (endOfList) {
        isEnd = true;
        onProgress({ type: 'info', message: 'Se alcanzó el final de la lista de Google Maps.' });
      }

      scrollAttempts++;
    }

    onProgress({ type: 'info', message: `Extrayendo información detallada para los ${results.length} comercios...` });

    // Detail extraction loop
    for (let i = 0; i < results.length; i++) {
      const business = results[i];
      onProgress({ type: 'detail-start', index: i, total: results.length, name: business.name });

      try {
        await page.goto(business.mapsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait a second for full detail panel render
        await new Promise(r => setTimeout(r, 1500));

        const details = await page.evaluate(() => {
          // Rating and reviews
          const ratingText = document.querySelector('div.F7nice span[aria-hidden="true"]')?.textContent;
          const reviewsText = document.querySelector('div.F7nice button[aria-label*="reseña"]')?.textContent || 
                              document.querySelector('div.F7nice button[aria-label*="reviews"]')?.textContent;
          
          const rating = ratingText ? parseFloat(ratingText.replace(',', '.')) : 0;
          let reviewsCount = 0;
          if (reviewsText) {
            const numMatch = reviewsText.match(/\d+/);
            if (numMatch) reviewsCount = parseInt(numMatch[0]);
          }

          // Address
          const addressBtn = document.querySelector('button[data-item-id="address"]');
          const address = addressBtn?.getAttribute('aria-label')?.replace(/^Dirección:\s*/i, '') || '';

          // Phone
          // Select buttons with data-item-id="phone:tel:"
          const phoneBtn = document.querySelector('button[data-item-id^="phone:tel:"]');
          const phone = phoneBtn?.getAttribute('aria-label')?.replace(/^Teléfono:\s*/i, '') || '';

          // Website
          const websiteBtn = document.querySelector('a[data-item-id="authority"]');
          const website = websiteBtn?.getAttribute('href') || '';

          return { rating, reviewsCount, address, phone, website };
        });

        // Update details
        business.rating = details.rating || 0;
        business.reviewsCount = details.reviewsCount || 0;
        business.address = details.address || '';
        business.phone = details.phone || '';
        business.website = details.website || '';

        // Scrape contact info from website if found
        if (business.website) {
          onProgress({ type: 'info', message: `Buscando correos y redes sociales en: ${business.website}...` });
          const contactInfo = await scrapeWebsiteContactInfo(business.website);
          business.emails = contactInfo.emails;
          business.facebook = contactInfo.facebook;
          business.instagram = contactInfo.instagram;
          business.twitter = contactInfo.twitter;
          business.linkedin = contactInfo.linkedin;
          business.youtube = contactInfo.youtube;
        } else {
          business.emails = [];
          business.facebook = '';
          business.instagram = '';
          business.twitter = '';
          business.linkedin = '';
          business.youtube = '';
        }

        onProgress({ 
          type: 'detail-end', 
          index: i, 
          total: results.length, 
          business 
        });

      } catch (err) {
        onProgress({ type: 'warning', message: `Error extrayendo detalles de "${business.name}": ${err.message}` });
      }
    }

  } catch (error) {
    onProgress({ type: 'error', message: `Error general en el scraper: ${error.message}` });
  } finally {
    await browser.close();
  }

  onProgress({ type: 'done', results });
  return results;
}
