// App state
let state = {
  activeView: 'dashboard',
  leads: [],
  searches: [],
  stats: {
    totalLeads: 0,
    contactable: 0,
    withEmails: 0,
    niches: 0,
    searchesCount: 0
  },
  settings: {
    deepScrape: true,
    delay: 8000
  },
  currentScrape: {
    running: false,
    foundCount: 0,
    totalLimit: 10
  }
};

// Autocomplete databases
const niches = [
  "Abogados y Asesorías", "Academias de Baile", "Academias de Idiomas", 
  "Agencias de Marketing Digital", "Agencias Inmobiliarias", "Arquitectos e Interioristas", 
  "Barberías", "Carpintería y Ebanistería", "Centros de Estética", 
  "Centros Veterinarios", "Clínicas Dentales", "Contabilidad y Fiscalidad", 
  "Electricistas", "Escuelas de Conducir", "Fisioterapeutas", "Fontaneros", 
  "Fotógrafos", "Gestorías", "Gimnasios y CrossFit", "Guarderías y Educación Infantil", 
  "Instaladores de Alarmas", "Instaladores Placas Solares", "Joyerías", 
  "Lavanderías y Tintorerías", "Mudanzas y Transporte", "Nutricionistas y Dietistas", 
  "Ópticas", "Peluquerías", "Personal Trainer", "Psicólogos y Terapeutas", 
  "Reformas y Construcción", "Restaurantes y Cafeterías", "Seguros", 
  "Talleres Mecánicos", "Yoga y Pilates"
];

const locations = [
  "Veracruz, Ver., México", "Monterrey, N.L., México", "Ciudad de México, CDMX",
  "Guadalajara, Jal., México", "Madrid, España", "Barcelona, Cataluña, España",
  "Miami, Florida, EE. UU.", "Buenos Aires, Argentina", "Santiago, Chile",
  "Bogotá, Colombia", "Lima, Perú", "Caracas, Venezuela",
  "Valencia, Carabobo, Venezuela", "Maracaibo, Zulia, Venezuela"
];

// DOM Elements
const views = {
  dashboard: document.getElementById('view-dashboard'),
  search: document.getElementById('view-search'),
  portfolio: document.getElementById('view-portfolio'),
  settings: document.getElementById('view-settings')
};

const navItems = document.querySelectorAll('.nav-item');
const newSearchBtns = document.querySelectorAll('.btn-search-nav, .btn-new-search');

// App Initiation
document.addEventListener('DOMContentLoaded', () => {
  initDate();
  setupNavigation();
  setupSearchActions();
  setupPortfolioActions();
  loadAllData();
});

// Load stats, leads, searches
async function loadAllData() {
  await fetchStats();
  await fetchLeads();
  await fetchSearches();
  
  renderDashboard();
  renderLeadsTable();
  renderHistory();
}

function initDate() {
  const options = { year: 'numeric', month: 'long' };
  const dateStr = new Date().toLocaleDateString('es-ES', options);
  document.getElementById('dashboard-date').innerText = dateStr;
  
  const hour = new Date().getHours();
  let greet = "Prospecta clientes inteligentes";
  if (hour < 12) greet = "Buenos días, a por nuevos clientes";
  else if (hour < 18) greet = "Buenas tardes, a por más leads";
  else greet = "Buenas noches, analiza tus campañas";
  
  document.getElementById('welcome-text').innerText = greet;
}

// Router/Navigation
function setupNavigation() {
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
    });
  });

  newSearchBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchView('search');
    });
  });
}

function switchView(viewName) {
  // Update nav UI
  navItems.forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle sections
  Object.keys(views).forEach(key => {
    if (key === viewName) {
      views[key].classList.remove('hidden');
    } else {
      views[key].classList.add('hidden');
    }
  });

  state.activeView = viewName;
}

// API Fetches
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    state.stats = await res.json();
  } catch (e) {
    console.error('Error fetching stats', e);
  }
}

async function fetchLeads() {
  try {
    const res = await fetch('/api/leads');
    state.leads = await res.json();
  } catch (e) {
    console.error('Error fetching leads', e);
  }
}

async function fetchSearches() {
  try {
    const res = await fetch('/api/searches');
    state.searches = await res.json();
  } catch (e) {
    console.error('Error fetching searches', e);
  }
}

// Render Dashboard
function renderDashboard() {
  document.getElementById('stat-total-leads').innerText = state.stats.totalLeads;
  document.getElementById('stat-contactable').innerText = state.stats.contactable;
  document.getElementById('stat-emails').innerText = state.stats.withEmails;
  document.getElementById('stat-niches').innerText = state.stats.niches;

  // Render Popular Niches Panel
  const nicheList = document.getElementById('popular-niches-list');
  nicheList.innerHTML = '';
  
  if (state.leads.length === 0) {
    nicheList.innerHTML = `<li class="niche-item-empty">No has realizado búsquedas aún.</li>`;
  } else {
    // Count occurrences of niches
    const counts = {};
    state.leads.forEach(l => {
      counts[l.category] = (counts[l.category] || 0) + 1;
    });

    const sortedNiches = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    sortedNiches.forEach(([name, count]) => {
      const li = document.createElement('li');
      li.className = 'niche-item';
      li.innerHTML = `
        <span class="niche-name">${name}</span>
        <span class="niche-count">${count} leads</span>
      `;
      nicheList.appendChild(li);
    });
  }

  // Draw Activity Bars
  const barsContainer = document.getElementById('activity-bars');
  barsContainer.innerHTML = '';
  
  // Group searches by date of last 7 days
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const activityData = new Array(7).fill(0);
  
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date();
    checkDate.setDate(today.getDate() - (6 - i));
    const dayLabel = days[checkDate.getDay()];
    
    // Count leads scraped on this day
    const leadsScrapedToday = state.leads.filter(l => {
      if (!l.scrapedAt) return false;
      const d = new Date(l.scrapedAt);
      return d.toDateString() === checkDate.toDateString();
    }).length;

    activityData[i] = {
      label: dayLabel,
      count: leadsScrapedToday
    };
  }

  const maxCount = Math.max(...activityData.map(d => d.count), 5); // at least 5 for scaling
  
  activityData.forEach(day => {
    const heightPercent = (day.count / maxCount) * 100;
    const barCol = document.createElement('div');
    barCol.className = 'chart-bar-col';
    barCol.innerHTML = `
      <div class="bar-fill" style="height: ${heightPercent}%" title="${day.count} leads"></div>
      <span class="bar-day">${day.label}</span>
    `;
    barsContainer.appendChild(barCol);
  });
}

// Render Search History
function renderHistory() {
  const container = document.getElementById('search-history-list');
  container.innerHTML = '';

  if (state.searches.length === 0) {
    container.innerHTML = '<div class="history-empty">Sin búsquedas previas</div>';
    return;
  }

  // Render recent 5 searches
  const recentSearches = [...state.searches].reverse().slice(0, 5);
  recentSearches.forEach(search => {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const formattedDate = new Date(search.date).toLocaleDateString('es-ES', {
      month: 'short',
      day: 'numeric'
    });

    item.innerHTML = `
      <div class="history-niche">${search.niche}</div>
      <div class="history-meta">
        <span>${search.location.split(',')[0]}</span>
        <span>+${search.resultsCount} leads</span>
      </div>
    `;

    item.addEventListener('click', () => {
      document.getElementById('search-niche').value = search.niche;
      document.getElementById('search-location').value = search.location;
      switchView('search');
    });

    container.appendChild(item);
  });
}

// Scraper Console logs
function logToConsole(message, type = 'system') {
  const consoleBody = document.getElementById('console-logs');
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  
  const time = new Date().toLocaleTimeString('es-ES');
  line.innerText = `[${time}] ${message}`;
  
  consoleBody.appendChild(line);
  consoleBody.scrollTop = consoleBody.scrollHeight;
}

// Live listings rendering
function appendLiveLead(name, contactStatus, statusClass) {
  const grid = document.getElementById('search-results-cards');
  
  // Remove empty card if it exists
  const empty = grid.querySelector('.live-lead-empty');
  if (empty) empty.remove();

  // Create card
  const card = document.createElement('div');
  card.className = 'lead-card';
  card.id = `live-card-${name.replace(/\s+/g, '-')}`;
  
  const cardIndex = grid.querySelectorAll('.lead-card').length + 1;

  card.innerHTML = `
    <div class="lead-card-header">
      <h3 class="lead-card-title">${name}</h3>
      <span class="lead-card-number">#${cardIndex}</span>
    </div>
    
    <div class="lead-card-details">
      <div class="lead-detail-item">
        <span class="lead-detail-icon">📍</span>
        <span class="lead-address-text">Cargando dirección...</span>
      </div>
      <div class="lead-detail-item">
        <span class="lead-detail-icon">📞</span>
        <span class="lead-phone-text">Espere...</span>
      </div>
    </div>

    <div class="lead-badge-container">
      <span class="lead-badge badge-reputacion">Espere...</span>
    </div>
  `;

  grid.insertBefore(card, grid.firstChild);
}

function updateLiveLead(business, searchLocation) {
  const name = business.name;
  const cardId = `live-card-${name.replace(/\s+/g, '-')}`;
  const card = document.getElementById(cardId);
  if (!card) return;

  // 1. Update Address
  const addressEl = card.querySelector('.lead-address-text');
  if (addressEl) addressEl.innerText = business.address || 'Sin dirección';

  // 2. Update Contact (Phone & Email)
  const phoneEl = card.querySelector('.lead-phone-text');
  if (phoneEl) {
    let detailsStr = business.phone || 'Sin teléfono';
    if (business.emails && business.emails.length > 0) {
      detailsStr += ` | ✉ ${business.emails[0]}`;
    }
    phoneEl.innerText = detailsStr;
  }

  // 3. Determine Opportunity Status
  let badgeClass = 'badge-hasweb';
  let badgeLabel = 'Ya tiene web';
  let oppTitle = 'Ya tiene web';
  let oppDesc = 'Negocio con sitio web activo. Es una posible oportunidad para ofrecer rediseño o campañas de marketing digital.';

  if (!business.website) {
    badgeClass = 'badge-ideal';
    badgeLabel = 'Oportunidad ideal';
    oppTitle = 'Oportunidad ideal';
    oppDesc = 'Negocio activo con reseñas pero **sin sitio web**. Perfil perfecto para ofrecer diseño y desarrollo de su página web.';
  } else if (business.rating && business.rating < 3.5) {
    badgeClass = 'badge-reputacion';
    badgeLabel = 'Mejorar Reputación';
    oppTitle = 'Mejorar Reputación';
    oppDesc = 'El negocio tiene bajas calificaciones de clientes. Ideal para ofrecer servicios de gestión de reseñas o SEO local.';
  }

  // Generate dynamic outreach script
  let outreachScript = "";
  const locationShort = searchLocation ? searchLocation.split(',')[0] : 'su zona';
  if (!business.website) {
    outreachScript = `Hola,\n\nVi su negocio "${name}" en Google Maps en ${locationShort} con una excelente puntuación de ${business.rating || 0} estrellas (${business.reviewsCount || 0} reseñas).\n\nMe di cuenta de que no tienen una página web. Ayudo a negocios locales a crear sitios web profesionales que traen más clientes de forma automática.\n\n¿Le interesaría ver una propuesta sencilla y gratuita para su negocio?\n\nSaludos!`;
  } else {
    outreachScript = `Hola,\n\nVi su negocio "${name}" en Google Maps y estuve revisando su sitio web (${business.website.replace(/^https?:\/\/(www\.)?/i, '')}).\n\nNoté algunas oportunidades de mejora en la velocidad y el diseño móvil que podrían estar haciéndole perder clientes potenciales frente a la competencia.\n\n¿Estaría abierto a que le envíe una auditoría rápida y gratuita de 2 minutos?\n\nSaludos!`;
  }

  // Update Badges & Ratings
  const badgeContainer = card.querySelector('.lead-badge-container');
  if (badgeContainer) {
    badgeContainer.innerHTML = `
      <span class="lead-badge ${badgeClass}">${badgeLabel}</span>
      ${business.rating ? `<span class="lead-badge badge-reputacion">⭐ ${business.rating} (${business.reviewsCount || 0} reseñas)</span>` : '<span class="lead-badge badge-reputacion">Sin reseñas</span>'}
    `;
  }

  // Add website if available
  const detailsContainer = card.querySelector('.lead-card-details');
  if (business.website && detailsContainer) {
    const webDiv = document.createElement('div');
    webDiv.className = 'lead-detail-item';
    webDiv.innerHTML = `
      <span class="lead-detail-icon">🌐</span>
      <a href="${business.website}" target="_blank" class="website-link" style="font-size: 13px;">${business.website.replace(/^https?:\/\/(www\.)?/i, '').substring(0, 25)}...</a>
    `;
    detailsContainer.appendChild(webDiv);
  }

  // Create Opportunity Box
  const oppBox = document.createElement('div');
  oppBox.className = 'opportunity-box';
  oppBox.innerHTML = `
    <div class="opportunity-title ${badgeClass.replace('badge-', '')}">
      <span>💡</span>
      <span>${oppTitle}</span>
    </div>
    <div class="opportunity-desc">${oppDesc}</div>
  `;

  // Create Outreach Script Box
  const outreachDiv = document.createElement('div');
  outreachDiv.className = 'outreach-box';
  
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'outreach-toggle';
  toggleBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; transform: rotate(0deg);"><polyline points="6 9 12 15 18 9"></polyline></svg>
    Ver Mensaje de Apertura
  `;

  const scriptContent = document.createElement('div');
  scriptContent.className = 'outreach-content';
  scriptContent.innerText = outreachScript;

  toggleBtn.addEventListener('click', () => {
    const isShown = scriptContent.style.display === 'block';
    scriptContent.style.display = isShown ? 'none' : 'block';
    toggleBtn.innerHTML = isShown ? `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
      Ver Mensaje de Apertura
    ` : `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><polyline points="18 15 12 9 6 15"></polyline></svg>
      Ocultar Mensaje
    `;
  });

  outreachDiv.appendChild(toggleBtn);
  outreachDiv.appendChild(scriptContent);

  card.appendChild(oppBox);
  card.appendChild(outreachDiv);
}

// Setup Search Controls
function setupSearchActions() {
  const randomNicheBtn = document.getElementById('btn-random-niche');
  const randomLocBtn = document.getElementById('btn-random-location');
  const startBtn = document.getElementById('start-scraping-btn');
  const progressPanel = document.getElementById('scraping-progress-panel');

  randomNicheBtn.addEventListener('click', () => {
    const idx = Math.floor(Math.random() * niches.length);
    document.getElementById('search-niche').value = niches[idx];
  });

  randomLocBtn.addEventListener('click', () => {
    const idx = Math.floor(Math.random() * locations.length);
    document.getElementById('search-location').value = locations[idx];
  });

  // Autocomplete suggestions using free OpenStreetMap Nominatim API
  const locInput = document.getElementById('search-location');
  const suggestionsBox = document.getElementById('location-suggestions');
  let debounceTimeout = null;

  locInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    const query = locInput.value.trim();

    if (query.length < 3) {
      suggestionsBox.style.display = 'none';
      return;
    }

    debounceTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&accept-language=es`);
        const data = await res.json();
        
        if (data && data.length > 0) {
          suggestionsBox.innerHTML = '';
          data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerText = item.display_name;
            div.addEventListener('click', () => {
              locInput.value = item.display_name;
              suggestionsBox.style.display = 'none';
            });
            suggestionsBox.appendChild(div);
          });
          suggestionsBox.style.display = 'block';
        } else {
          suggestionsBox.style.display = 'none';
        }
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      }
    }, 400);
  });

  // Close suggestions if clicking outside
  document.addEventListener('click', (e) => {
    if (e.target !== locInput && e.target !== suggestionsBox && !suggestionsBox.contains(e.target)) {
      suggestionsBox.style.display = 'none';
    }
  });

  startBtn.addEventListener('click', () => {
    const niche = document.getElementById('search-niche').value.trim();
    const location = document.getElementById('search-location').value.trim();
    const limit = parseInt(document.getElementById('search-limit').value);

    if (!niche || !location) {
      alert('Por favor complete la categoría y la ubicación antes de iniciar.');
      return;
    }

    // Toggle scraping state
    state.currentScrape.running = true;
    state.currentScrape.foundCount = 0;
    state.currentScrape.totalLimit = limit;
    
    // UI update
    startBtn.disabled = true;
    startBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon spinning">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
      </svg>
      Extrayendo...
    `;

    document.getElementById('progress-bar-fill').style.width = '0%';
    document.getElementById('progress-found-count').innerText = '0';
    document.getElementById('search-status-text').innerText = 'Iniciando navegador headless...';
    document.getElementById('search-results-cards').innerHTML = '<div class="live-lead-empty">Esperando datos de Google Maps...</div>';
    document.getElementById('console-logs').innerHTML = '<div class="log-line system">[Sistema] Sesión de scraping iniciada.</div>';
    
    progressPanel.classList.remove('hidden');

    // Create EventSource stream
    const streamUrl = `/api/search/stream?niche=${encodeURIComponent(niche)}&location=${encodeURIComponent(location)}&limit=${limit}`;
    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('SSE update:', data);

      if (data.type === 'info') {
        logToConsole(data.message, 'system');
      } else if (data.type === 'warning') {
        logToConsole(data.message, 'warning');
      } else if (data.type === 'error') {
        logToConsole(data.message, 'error');
        eventSource.close();
        resetSearchButton();
        alert(`Error en el scraper: ${data.message}`);
      } else if (data.type === 'progress') {
        state.currentScrape.foundCount = data.count;
        document.getElementById('progress-found-count').innerText = data.count;
        logToConsole(data.message, 'system');
        const pct = Math.min(50, (data.count / data.limit) * 50);
        document.getElementById('progress-bar-fill').style.width = `${pct}%`;
      } else if (data.type === 'detail-start') {
        document.getElementById('search-status-text').innerText = `Analizando detalles de: ${data.name} (${data.index + 1}/${data.total})`;
        logToConsole(`[${data.index + 1}/${data.total}] Extrayendo detalles de "${data.name}"...`, 'system');
        appendLiveLead(data.name, 'Pendiente...', 'pending');
      } else if (data.type === 'detail-end') {
        const business = data.business;
        const progressPct = 50 + Math.min(50, ((data.index + 1) / data.total) * 50);
        document.getElementById('progress-bar-fill').style.width = `${progressPct}%`;
        
        updateLiveLead(business, location);
        logToConsole(`[✓] Detalles listos para "${business.name}" - ${business.phone || 'Sin tel'} - ${business.emails?.join(', ') || 'Sin email'}.`, 'success');
      } else if (data.type === 'complete') {
        logToConsole(`Búsqueda completa. Encontrados: ${data.resultsCount} leads. Nuevos guardados: ${data.newLeadsCount}`, 'success');
        document.getElementById('progress-bar-fill').style.width = '100%';
        document.getElementById('search-status-text').innerText = 'Completado con éxito.';
        
        eventSource.close();
        resetSearchButton();
        loadAllData();
        alert(`Búsqueda finalizada. ${data.newLeadsCount} nuevos leads añadidos a tu cartera.`);
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource error:', err);
      logToConsole('Error de conexión o finalización inesperada del flujo.', 'error');
      eventSource.close();
      resetSearchButton();
    };
  });
}

function resetSearchButton() {
  const startBtn = document.getElementById('start-scraping-btn');
  state.currentScrape.running = false;
  startBtn.disabled = false;
  startBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
    Descubrir clientes
  `;
}

// Setup Leads Portfolio
function setupPortfolioActions() {
  const searchInput = document.getElementById('portfolio-search');
  const catFilter = document.getElementById('portfolio-filter-category');
  const contactFilter = document.getElementById('portfolio-filter-contact');
  const clearBtn = document.getElementById('clear-portfolio-btn');
  const exportBtn = document.getElementById('export-csv-btn');

  searchInput.addEventListener('input', renderLeadsTable);
  catFilter.addEventListener('change', renderLeadsTable);
  contactFilter.addEventListener('change', renderLeadsTable);

  clearBtn.addEventListener('click', async () => {
    if (confirm('¿Estás seguro de que quieres vaciar toda tu cartera de clientes? Esta acción no se puede deshacer.')) {
      try {
        const res = await fetch('/api/clear-leads', { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          alert(data.message);
          loadAllData();
        }
      } catch (e) {
        console.error('Error emptying portfolio', e);
      }
    }
  });

  exportBtn.addEventListener('click', () => {
    exportFilteredLeadsCSV();
  });
}

// Populate Category Filter dropdown dynamically
function updateCategoryFilterOptions() {
  const catFilter = document.getElementById('portfolio-filter-category');
  const currentVal = catFilter.value;
  
  // Extract unique categories
  const categories = [...new Set(state.leads.map(l => l.category))];
  
  catFilter.innerHTML = '<option value="">Todas las categorías</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.innerText = cat;
    catFilter.appendChild(opt);
  });
  
  catFilter.value = currentVal;
}

// Render Leads Table
function renderLeadsTable() {
  updateCategoryFilterOptions();

  const tbody = document.getElementById('leads-table-body');
  tbody.innerHTML = '';

  const query = document.getElementById('portfolio-search').value.toLowerCase();
  const category = document.getElementById('portfolio-filter-category').value;
  const contactType = document.getElementById('portfolio-filter-contact').value;

  // Filter leads
  const filtered = state.leads.filter(lead => {
    // Search query check
    const matchesSearch = 
      lead.name.toLowerCase().includes(query) ||
      (lead.address && lead.address.toLowerCase().includes(query)) ||
      (lead.category && lead.category.toLowerCase().includes(query)) ||
      (lead.phone && lead.phone.includes(query)) ||
      (lead.emails && lead.emails.some(e => e.toLowerCase().includes(query))) ||
      (lead.website && lead.website.toLowerCase().includes(query));

    // Category filter check
    const matchesCategory = !category || lead.category === category;

    // Contact filter check
    let matchesContact = true;
    if (contactType === 'contactable') {
      matchesContact = lead.phone || (lead.emails && lead.emails.length > 0);
    } else if (contactType === 'email') {
      matchesContact = lead.emails && lead.emails.length > 0;
    } else if (contactType === 'website') {
      matchesContact = !!lead.website;
    } else if (contactType === 'noweb') {
      matchesContact = !lead.website;
    }

    return matchesSearch && matchesCategory && matchesContact;
  });

  document.getElementById('table-info-text').innerText = `Mostrando ${filtered.length} de ${state.leads.length} leads`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="table-empty">No se encontraron leads con los filtros seleccionados.</td></tr>`;
    return;
  }

  filtered.forEach(lead => {
    const tr = document.createElement('tr');
    tr.id = `lead-row-${lead.id}`;

    // Name column
    const nameCell = `
      <div class="lead-name-cell">
        <a href="${lead.mapsUrl}" target="_blank">${lead.name}</a>
        <span class="lead-address-sub" title="${lead.address || 'Sin dirección'}">${lead.address || 'Sin dirección'}</span>
      </div>
    `;

    // Category
    const categoryCell = `<span class="badge-tag">${lead.category}</span>`;

    // Location
    const locationCell = `<span>${lead.location?.split(',')[0] || 'Ubicación local'}</span>`;

    // Phone
    const phoneCell = lead.phone ? `<span class="lead-phone">${lead.phone}</span>` : `<span class="text-muted">-</span>`;

    // Email
    let emailCell = `<span class="text-muted">-</span>`;
    if (lead.emails && lead.emails.length > 0) {
      emailCell = `
        <div class="emails-list">
          ${lead.emails.map(email => `<span class="email-badge" title="${email}">${email}</span>`).join('')}
        </div>
      `;
    }

    // Website
    const websiteCell = lead.website ? `
      <a href="${lead.website}" target="_blank" class="website-link">
        🌐 Sitio Web
      </a>
    ` : `<span class="text-muted">-</span>`;

    // Reputation
    const ratingCell = lead.rating ? `
      <div class="reputation-rating">
        <svg viewBox="0 0 24 24" class="star-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        <strong>${lead.rating}</strong>
        <span class="rating-count">(${lead.reviewsCount || 0})</span>
      </div>
    ` : `<span class="text-muted">Sin reseñas</span>`;

    // Socials
    let socialsCell = '<div class="socials-row">';
    if (lead.facebook) socialsCell += `<a href="${lead.facebook}" target="_blank" class="social-link" title="Facebook"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></a>`;
    if (lead.instagram) socialsCell += `<a href="${lead.instagram}" target="_blank" class="social-link" title="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg></a>`;
    if (lead.linkedin) socialsCell += `<a href="${lead.linkedin}" target="_blank" class="social-link" title="LinkedIn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg></a>`;
    if (!lead.facebook && !lead.instagram && !lead.linkedin) socialsCell += '<span class="text-muted">-</span>';
    socialsCell += '</div>';

    // Actions
    const actionCell = `
      <button class="action-btn-danger" onclick="deleteLead('${lead.id}')" title="Eliminar lead">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button>
    `;

    tr.innerHTML = `
      <td>${nameCell}</td>
      <td>${categoryCell}</td>
      <td>${locationCell}</td>
      <td>${phoneCell}</td>
      <td>${emailCell}</td>
      <td>${websiteCell}</td>
      <td>${ratingCell}</td>
      <td>${socialsCell}</td>
      <td>${actionCell}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Delete single lead
window.deleteLead = async (id) => {
  if (confirm('¿Eliminar este cliente potencial?')) {
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        // Remove from state
        state.leads = state.leads.filter(l => l.id !== id);
        // Reload all metrics
        loadAllData();
      }
    } catch (e) {
      console.error('Error deleting lead', e);
    }
  }
};

// CSV Export (Excel Compatible UTF-8 BOM)
function exportFilteredLeadsCSV() {
  const query = document.getElementById('portfolio-search').value.toLowerCase();
  const category = document.getElementById('portfolio-filter-category').value;
  const contactType = document.getElementById('portfolio-filter-contact').value;

  const filtered = state.leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(query) ||
      (lead.address && lead.address.toLowerCase().includes(query)) ||
      (lead.category && lead.category.toLowerCase().includes(query)) ||
      (lead.phone && lead.phone.includes(query)) ||
      (lead.emails && lead.emails.some(e => e.toLowerCase().includes(query))) ||
      (lead.website && lead.website.toLowerCase().includes(query));

    const matchesCategory = !category || lead.category === category;

    let matchesContact = true;
    if (contactType === 'contactable') {
      matchesContact = lead.phone || (lead.emails && lead.emails.length > 0);
    } else if (contactType === 'email') {
      matchesContact = lead.emails && lead.emails.length > 0;
    } else if (contactType === 'website') {
      matchesContact = !!lead.website;
    } else if (contactType === 'noweb') {
      matchesContact = !lead.website;
    }

    return matchesSearch && matchesCategory && matchesContact;
  });

  if (filtered.length === 0) {
    alert('No hay leads para exportar con los filtros aplicados.');
    return;
  }

  // Create CSV content
  const headers = ['Nombre', 'Categoria', 'Direccion', 'Ciudad', 'Telefono', 'Emails', 'Sitio Web', 'Rating', 'Reviews Count', 'Facebook', 'Instagram', 'LinkedIn', 'Google Maps URL'];
  
  const csvRows = [
    headers.join(',')
  ];

  filtered.forEach(lead => {
    const row = [
      escapeCSVValue(lead.name),
      escapeCSVValue(lead.category),
      escapeCSVValue(lead.address),
      escapeCSVValue(lead.location),
      escapeCSVValue(lead.phone),
      escapeCSVValue(lead.emails?.join(' | ') || ''),
      escapeCSVValue(lead.website),
      escapeCSVValue(lead.rating ? String(lead.rating) : '0'),
      escapeCSVValue(lead.reviewsCount ? String(lead.reviewsCount) : '0'),
      escapeCSVValue(lead.facebook),
      escapeCSVValue(lead.instagram),
      escapeCSVValue(lead.linkedin),
      escapeCSVValue(lead.mapsUrl)
    ];
    csvRows.push(row.join(','));
  });

  // Prepend UTF-8 BOM for Excel compatibility
  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `leads_huntly_${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSVValue(val) {
  if (val === undefined || val === null) return '""';
  let formatted = String(val).replace(/"/g, '""');
  // If value contains comma, double-quotes or newlines, wrap it in double quotes
  if (formatted.includes(',') || formatted.includes('"') || formatted.includes('\n')) {
    formatted = `"${formatted}"`;
  } else {
    // Wrap all fields to be safe
    formatted = `"${formatted}"`;
  }
  return formatted;
}
