// Clean Cooking App — 100% Halal High-Protein Cookbook Companion

const AppState = {
  recipes: [],
  filteredRecipes: [],
  shoppingGuide: null,
  cookbookGuide: null,
  currentTab: 'recipes',
  selectedCategory: 'All',
  selectedSubCategory: 'All',
  searchQuery: '',
  filterMinProtein: 0,
  filterMaxCalories: 1000,
  activeTag: 'All',
  sortBy: 'default',
  favorites: new Set(JSON.parse(localStorage.getItem('clean_cooking_favorites') || '[]')),
  mealPlan: JSON.parse(localStorage.getItem('clean_cooking_meal_plan') || '{"breakfast":[],"lunch":[],"dinner":[],"snacks":[]}'),
  shoppingList: JSON.parse(localStorage.getItem('clean_cooking_shopping_list') || '[]'),
  userProfile: JSON.parse(localStorage.getItem('clean_cooking_user_profile') || '{"weight":80,"unit":"kg","goal":"cut","customTdee":2600}'),
  activeModalRecipe: null,
  activeModalScale: 1.0,
  checkedIngredients: new Set(),
  checkedSteps: new Set(),
  activeTimers: {}, // stepId -> { totalSec, remainingSec, isRunning, intervalId }
  modalActiveTab: 'method' // 'method' or 'instantpot'
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  initLucideIcons();
  setupEventListeners();
  loadUserProfile();
  await loadData();
  renderApp();
});

function initLucideIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Data Fetching
async function loadData() {
  try {
    const [recipesRes, shopRes, guideRes] = await Promise.all([
      fetch('data/recipes.json'),
      fetch('data/shopping_guide.json'),
      fetch('data/cookbook_guide.json')
    ]);

    AppState.recipes = await recipesRes.json();
    AppState.shoppingGuide = await shopRes.json();
    AppState.cookbookGuide = await guideRes.json();
  } catch (err) {
    console.error("Error loading JSON data:", err);
    document.getElementById('recipes-grid').innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400">
        <p class="text-lg font-semibold text-rose-400 mb-2">Error loading recipes database.</p>
        <p class="text-sm">Please ensure the Flask backend is running on <code class="bg-slate-800 px-2 py-1 rounded text-emerald-400">http://localhost:5000</code></p>
      </div>
    `;
  }
}

// Audio notification chime for timers
function playTimerChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.85);
    });
  } catch (e) {
    console.log('Audio chime not supported:', e);
  }
}

// Detect cooking duration from instruction step string
function extractStepDuration(text) {
  const rangeMinMatch = text.match(/(\d+(?:\.\d+)?)\s*[-–to]\s*(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m\b)/i);
  if (rangeMinMatch) {
    const avgMins = Math.round((parseFloat(rangeMinMatch[1]) + parseFloat(rangeMinMatch[2])) / 2);
    return avgMins * 60;
  }
  const singleMinMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m\b)/i);
  if (singleMinMatch) {
    return Math.round(parseFloat(singleMinMatch[1]) * 60);
  }
  const secMatch = text.match(/(\d+)\s*(?:seconds?|secs?|s\b)/i);
  if (secMatch) {
    return parseInt(secMatch[1]);
  }
  return null;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Event Listeners
function setupEventListeners() {
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.currentTarget.dataset.tab;
      switchTab(tab);
    });
  });

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.searchQuery = e.target.value.toLowerCase().trim();
      filterAndRenderRecipes();
    });
  }

  const clearSearchBtn = document.getElementById('clear-search-btn');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      AppState.searchQuery = '';
      filterAndRenderRecipes();
    });
  }

  document.querySelectorAll('.cat-pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.cat-pill-btn').forEach(b => b.classList.remove('active-cat'));
      e.currentTarget.classList.add('active-cat');
      AppState.selectedCategory = e.currentTarget.dataset.cat;
      AppState.selectedSubCategory = 'All';
      renderSubcategoryPills();
      filterAndRenderRecipes();
    });
  });

  const proteinSlider = document.getElementById('min-protein-slider');
  const proteinDisplay = document.getElementById('min-protein-display');
  if (proteinSlider) {
    proteinSlider.addEventListener('input', (e) => {
      AppState.filterMinProtein = parseInt(e.target.value);
      if (proteinDisplay) proteinDisplay.innerText = `${AppState.filterMinProtein}g`;
      filterAndRenderRecipes();
    });
  }

  const calSlider = document.getElementById('max-cal-slider');
  const calDisplay = document.getElementById('max-cal-display');
  if (calSlider) {
    calSlider.addEventListener('input', (e) => {
      AppState.filterMaxCalories = parseInt(e.target.value);
      if (calDisplay) calDisplay.innerText = `${AppState.filterMaxCalories} kcal`;
      filterAndRenderRecipes();
    });
  }

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      AppState.sortBy = e.target.value;
      filterAndRenderRecipes();
    });
  }

  document.querySelectorAll('.quick-tag-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.quick-tag-btn').forEach(b => b.classList.remove('active-tag'));
      const tag = e.currentTarget.dataset.tag;
      if (AppState.activeTag === tag) {
        AppState.activeTag = 'All';
      } else {
        AppState.activeTag = tag;
        e.currentTarget.classList.add('active-tag');
      }
      filterAndRenderRecipes();
    });
  });

  const closeModalBtn = document.getElementById('close-modal-btn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeRecipeModal);
  }
  const modalOverlay = document.getElementById('recipe-modal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeRecipeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeRecipeModal();
  });

  setupConversionEvents();
  setupPlannerEvents();
  setupShoppingListEvents();
}

function switchTab(tab) {
  AppState.currentTab = tab;
  document.querySelectorAll('.nav-tab-btn').forEach(b => {
    if (b.dataset.tab === tab) {
      b.classList.add('text-emerald-400', 'border-emerald-500', 'bg-emerald-500/10');
      b.classList.remove('text-slate-400', 'border-transparent');
    } else {
      b.classList.remove('text-emerald-400', 'border-emerald-500', 'bg-emerald-500/10');
      b.classList.add('text-slate-400', 'border-transparent');
    }
  });

  document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
  const targetView = document.getElementById(`view-${tab}`);
  if (targetView) targetView.classList.remove('hidden');

  if (tab === 'recipes') {
    filterAndRenderRecipes();
  } else if (tab === 'drinks') {
    AppState.selectedCategory = 'Drinks';
    AppState.selectedSubCategory = 'All';
    document.querySelectorAll('.cat-pill-btn').forEach(b => {
      if (b.dataset.cat === 'Drinks') b.classList.add('active-cat');
      else b.classList.remove('active-cat');
    });
    renderSubcategoryPills();
    switchTab('recipes');
  } else if (tab === 'planner') {
    renderPlannerView();
  } else if (tab === 'shopping') {
    renderShoppingView();
  } else if (tab === 'guide') {
    renderGuideView();
  }
}

function renderSubcategoryPills() {
  const container = document.getElementById('subcategory-chips-container');
  if (!container) return;

  const cat = AppState.selectedCategory;
  if (cat === 'All' || cat === 'Favorites') {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  const subs = new Set();
  AppState.recipes.forEach(r => {
    if (r.category === cat && r.subCategory) {
      subs.add(r.subCategory);
    }
  });

  if (subs.size <= 1) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  let html = `
    <button class="subcat-chip px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${AppState.selectedSubCategory === 'All' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}" data-sub="All">
      All ${cat}
    </button>
  `;

  subs.forEach(s => {
    const isActive = AppState.selectedSubCategory === s;
    html += `
      <button class="subcat-chip px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${isActive ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}" data-sub="${s}">
        ${s}
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.subcat-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      AppState.selectedSubCategory = e.currentTarget.dataset.sub;
      renderSubcategoryPills();
      filterAndRenderRecipes();
    });
  });
}

function filterAndRenderRecipes() {
  let list = [...AppState.recipes];

  if (AppState.selectedCategory === 'Favorites') {
    list = list.filter(r => AppState.favorites.has(r.id));
  } else if (AppState.selectedCategory !== 'All') {
    list = list.filter(r => r.category === AppState.selectedCategory);
    if (AppState.selectedSubCategory !== 'All') {
      list = list.filter(r => r.subCategory === AppState.selectedSubCategory);
    }
  }

  if (AppState.searchQuery) {
    const q = AppState.searchQuery;
    list = list.filter(r => {
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchSub = r.subCategory && r.subCategory.toLowerCase().includes(q);
      const matchIngr = r.ingredients.some(ing => ing.toLowerCase().includes(q));
      const matchTags = r.tags.some(t => t.toLowerCase().includes(q));
      return matchTitle || matchSub || matchIngr || matchTags;
    });
  }

  if (AppState.filterMinProtein > 0) {
    list = list.filter(r => r.nutrition.protein >= AppState.filterMinProtein);
  }
  if (AppState.filterMaxCalories < 1000) {
    list = list.filter(r => r.nutrition.calories <= AppState.filterMaxCalories);
  }

  if (AppState.activeTag !== 'All') {
    list = list.filter(r => r.tags.includes(AppState.activeTag));
  }

  switch (AppState.sortBy) {
    case 'protein-desc':
      list.sort((a, b) => b.nutrition.protein - a.nutrition.protein);
      break;
    case 'calories-asc':
      list.sort((a, b) => a.nutrition.calories - b.nutrition.calories);
      break;
    case 'calories-desc':
      list.sort((a, b) => b.nutrition.calories - a.nutrition.calories);
      break;
    case 'efficiency':
      list.sort((a, b) => (b.nutrition.proteinDensity || 0) - (a.nutrition.proteinDensity || 0));
      break;
    case 'title':
      list.sort((a, b) => a.title.localeCompare(b.title));
      break;
    default:
      list.sort((a, b) => a.number - b.number);
      break;
  }

  AppState.filteredRecipes = list;

  const countEl = document.getElementById('results-count');
  if (countEl) {
    countEl.innerHTML = `Showing <span class="font-bold text-emerald-400">${list.length}</span> 100% Halal recipes • Metric units`;
  }

  const grid = document.getElementById('recipes-grid');
  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-400">
        <i data-lucide="search-x" class="w-12 h-12 mx-auto mb-3 text-slate-500"></i>
        <p class="text-xl font-bold text-slate-300">No matching halal recipes found</p>
        <p class="text-sm mt-1">Try relaxing your search terms or macro filter thresholds.</p>
        <button onclick="resetFilters()" class="mt-4 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-lg hover:bg-emerald-500/30 text-sm font-semibold transition">
          Reset All Filters
        </button>
      </div>
    `;
    initLucideIcons();
    return;
  }

  grid.innerHTML = list.map(recipe => renderRecipeCard(recipe)).join('');
  initLucideIcons();

  grid.querySelectorAll('.recipe-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn')) return;
      const id = card.dataset.id;
      openRecipeModal(id);
    });
  });

  grid.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      toggleFavorite(id);
    });
  });
}

function renderRecipeCard(r) {
  const isFav = AppState.favorites.has(r.id);
  const isIp = r.instantPot && r.instantPot.applicable;

  return `
    <div class="recipe-card glass-card rounded-2xl overflow-hidden cursor-pointer flex flex-col group border border-slate-800/80 hover:border-emerald-500/40" data-id="${r.id}">
      <div class="recipe-img-container relative bg-slate-950">
        <img src="${r.image}" alt="${r.title}" loading="lazy" class="recipe-img object-cover w-full h-full" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'">
        
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30"></div>

        <div class="absolute top-3 left-3 right-3 flex justify-between items-center z-10">
          <div class="flex items-center gap-1.5">
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900/90 backdrop-blur-md text-emerald-400 border border-emerald-500/40 shadow flex items-center gap-1">
              <i data-lucide="shield-check" class="w-3 h-3 text-emerald-400"></i> Halal
            </span>
            ${isIp ? `
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-md flex items-center gap-1" title="Instant Pot Pro pressure cooker instructions available">
                <i data-lucide="gauge" class="w-3 h-3"></i> IP Pro
              </span>
            ` : ''}
          </div>
          <button class="card-action-btn fav-btn p-2 rounded-full bg-slate-900/80 backdrop-blur-md text-slate-300 hover:text-rose-400 border border-white/10 transition" data-id="${r.id}" title="Save to favorites">
            <i data-lucide="heart" class="w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}"></i>
          </button>
        </div>

        <div class="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-slate-300 z-10">
          <span class="font-medium text-slate-300 truncate max-w-[65%]">${r.subCategory || r.category}</span>
          <span class="bg-black/60 px-2 py-0.5 rounded text-[11px] text-slate-300 flex items-center gap-1">
            <i data-lucide="users" class="w-3 h-3"></i> ${r.nutrition.servings}
          </span>
        </div>
      </div>

      <div class="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 class="font-heading font-bold text-lg text-slate-100 group-hover:text-emerald-400 transition-colors line-clamp-1 mb-1">
            ${r.title}
          </h3>
          <p class="text-xs text-slate-400 line-clamp-1 mb-3">
            ${r.ingredients.slice(0, 3).join(', ')}...
          </p>
        </div>

        <div class="pt-2 border-t border-slate-800/80">
          <div class="grid grid-cols-4 gap-1.5 text-center">
            <div class="bg-amber-500/10 border border-amber-500/20 rounded-lg p-1">
              <span class="block text-[10px] text-amber-400 uppercase font-bold">Cals</span>
              <span class="font-heading font-extrabold text-xs text-amber-300">${r.nutrition.calories}</span>
            </div>
            <div class="bg-emerald-500/15 border border-emerald-500/30 rounded-lg p-1">
              <span class="block text-[10px] text-emerald-400 uppercase font-bold">Protein</span>
              <span class="font-heading font-extrabold text-xs text-emerald-300">${r.nutrition.protein}g</span>
            </div>
            <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-1">
              <span class="block text-[10px] text-blue-400 uppercase font-bold">Carbs</span>
              <span class="font-heading font-extrabold text-xs text-blue-300">${r.nutrition.carbs}g</span>
            </div>
            <div class="bg-rose-500/10 border border-rose-500/20 rounded-lg p-1">
              <span class="block text-[10px] text-rose-400 uppercase font-bold">Fat</span>
              <span class="font-heading font-extrabold text-xs text-rose-300">${r.nutrition.fat}g</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function resetFilters() {
  AppState.searchQuery = '';
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';

  AppState.selectedCategory = 'All';
  document.querySelectorAll('.cat-pill-btn').forEach(b => {
    if (b.dataset.cat === 'All') b.classList.add('active-cat');
    else b.classList.remove('active-cat');
  });

  AppState.selectedSubCategory = 'All';
  renderSubcategoryPills();

  AppState.filterMinProtein = 0;
  const pSlider = document.getElementById('min-protein-slider');
  if (pSlider) pSlider.value = 0;
  const pDisp = document.getElementById('min-protein-display');
  if (pDisp) pDisp.innerText = '0g';

  AppState.filterMaxCalories = 1000;
  const cSlider = document.getElementById('max-cal-slider');
  if (cSlider) cSlider.value = 1000;
  const cDisp = document.getElementById('max-cal-display');
  if (cDisp) cDisp.innerText = '1000 kcal';

  AppState.activeTag = 'All';
  document.querySelectorAll('.quick-tag-btn').forEach(b => b.classList.remove('active-tag'));

  AppState.sortBy = 'default';
  const sortSel = document.getElementById('sort-select');
  if (sortSel) sortSel.value = 'default';

  filterAndRenderRecipes();
}

function toggleFavorite(id) {
  if (AppState.favorites.has(id)) {
    AppState.favorites.delete(id);
  } else {
    AppState.favorites.add(id);
  }
  localStorage.setItem('clean_cooking_favorites', JSON.stringify([...AppState.favorites]));

  if (AppState.selectedCategory === 'Favorites') {
    filterAndRenderRecipes();
  } else {
    document.querySelectorAll(`.fav-btn[data-id="${id}"]`).forEach(btn => {
      const isFav = AppState.favorites.has(id);
      btn.innerHTML = `<i data-lucide="heart" class="w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}"></i>`;
    });
    initLucideIcons();
  }
}

function openRecipeModal(id) {
  const recipe = AppState.recipes.find(r => r.id === id);
  if (!recipe) return;

  clearAllTimers();

  AppState.activeModalRecipe = recipe;
  AppState.activeModalScale = 1.0;
  AppState.checkedIngredients.clear();
  AppState.checkedSteps.clear();
  AppState.modalActiveTab = 'method';

  renderModalContent();
  const modal = document.getElementById('recipe-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
}

function closeRecipeModal() {
  clearAllTimers();
  const modal = document.getElementById('recipe-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }
  AppState.activeModalRecipe = null;
}

function clearAllTimers() {
  Object.values(AppState.activeTimers).forEach(t => {
    if (t.intervalId) clearInterval(t.intervalId);
  });
  AppState.activeTimers = {};
}

function scaleQuantityText(itemText, factor) {
  if (factor === 1.0) return itemText;
  return itemText.replace(/^(\d+\/\d+|\d+(?:\.\d+)?)\s*([a-zA-Z%°]*)/, (match, num, unit) => {
    let val = 0;
    if (num.includes('/')) {
      const [n, d] = num.split('/').map(Number);
      val = n / d;
    } else {
      val = parseFloat(num);
    }
    const scaled = Math.round(val * factor * 10) / 10;
    const formatted = scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(1);
    return `${formatted} ${unit}`.trim();
  });
}

function renderModalContent() {
  const r = AppState.activeModalRecipe;
  if (!r) return;

  const scale = AppState.activeModalScale;
  const scaledCals = Math.round(r.nutrition.calories * scale);
  const scaledPro = Math.round(r.nutrition.protein * scale * 10) / 10;
  const scaledCarbs = Math.round(r.nutrition.carbs * scale * 10) / 10;
  const scaledFat = Math.round(r.nutrition.fat * scale * 10) / 10;

  document.getElementById('modal-title').innerText = r.title;
  document.getElementById('modal-category-badge').innerHTML = `
    <span class="flex items-center gap-1.5">
      <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-400"></i>
      100% Halal • ${r.category} • ${r.subCategory || ''}
    </span>
  `;
  document.getElementById('modal-image').src = r.image;

  document.getElementById('modal-servings-text').innerText = `${r.nutrition.servings} ${scale !== 1.0 ? `(Scaled x${scale})` : ''}`;

  document.getElementById('modal-cals').innerText = scaledCals;
  document.getElementById('modal-protein').innerText = `${scaledPro}g`;
  document.getElementById('modal-carbs').innerText = `${scaledCarbs}g`;
  document.getElementById('modal-fat').innerText = `${scaledFat}g`;

  const totalMacroCals = (scaledPro * 4) + (scaledCarbs * 4) + (scaledFat * 9) || 1;
  const proPct = Math.round((scaledPro * 4 / totalMacroCals) * 100);
  const carbPct = Math.round((scaledCarbs * 4 / totalMacroCals) * 100);
  const fatPct = Math.round((scaledFat * 9 / totalMacroCals) * 100);

  document.getElementById('macro-bar-pro').style.width = `${proPct}%`;
  document.getElementById('macro-bar-carb').style.width = `${carbPct}%`;
  document.getElementById('macro-bar-fat').style.width = `${fatPct}%`;

  document.getElementById('macro-pct-pro').innerText = `${proPct}%`;
  document.getElementById('macro-pct-carb').innerText = `${carbPct}%`;
  document.getElementById('macro-pct-fat').innerText = `${fatPct}%`;

  const scaleBtns = [0.5, 1.0, 2.0, 3.0, 4.0];
  const scaleContainer = document.getElementById('modal-scale-buttons');
  scaleContainer.innerHTML = scaleBtns.map(s => `
    <button class="scale-btn px-2.5 py-1 text-xs font-bold rounded-lg border transition ${s === scale ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}" data-scale="${s}">
      ${s}x
    </button>
  `).join('');

  scaleContainer.querySelectorAll('.scale-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      AppState.activeModalScale = parseFloat(e.currentTarget.dataset.scale);
      renderModalContent();
    });
  });

  const methodTabBtn = document.getElementById('tab-btn-method');
  const ipTabBtn = document.getElementById('tab-btn-instantpot');
  const methodContent = document.getElementById('modal-method-section');
  const ipContent = document.getElementById('modal-instantpot-section');

  if (methodTabBtn && ipTabBtn) {
    if (AppState.modalActiveTab === 'method') {
      methodTabBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 text-slate-950 shadow";
      ipTabBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700";
      methodContent.classList.remove('hidden');
      ipContent.classList.add('hidden');
    } else {
      ipTabBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500 text-slate-950 shadow";
      methodTabBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700";
      methodContent.classList.add('hidden');
      ipContent.classList.remove('hidden');
    }

    methodTabBtn.onclick = () => { AppState.modalActiveTab = 'method'; renderModalContent(); };
    ipTabBtn.onclick = () => { AppState.modalActiveTab = 'instantpot'; renderModalContent(); };
  }

  const ingContainer = document.getElementById('modal-ingredients-list');
  let ingHtml = '';

  if (r.ingredientSections && r.ingredientSections.length > 0) {
    r.ingredientSections.forEach((sec, secIdx) => {
      if (sec.name && sec.name.toLowerCase() !== 'ingredients') {
        ingHtml += `<h4 class="text-xs uppercase font-bold text-emerald-400 mt-3 mb-1.5 tracking-wider">${sec.name}</h4>`;
      }
      sec.items.forEach((item, itemIdx) => {
        const itemKey = `${secIdx}-${itemIdx}`;
        const isChecked = AppState.checkedIngredients.has(itemKey);
        const scaledText = scaleQuantityText(item, scale);
        ingHtml += `
          <label class="flex items-start gap-2.5 py-1.5 px-2 rounded-lg hover:bg-slate-800/50 cursor-pointer select-none group">
            <input type="checkbox" class="custom-checkbox ing-checkbox mt-0.5" data-key="${itemKey}" ${isChecked ? 'checked' : ''}>
            <span class="text-sm text-slate-200 group-hover:text-white transition ${isChecked ? 'checked-item' : ''}">
              ${scaledText}
            </span>
          </label>
        `;
      });
    });
  } else {
    r.ingredients.forEach((item, idx) => {
      const isChecked = AppState.checkedIngredients.has(idx.toString());
      const scaledText = scaleQuantityText(item, scale);
      ingHtml += `
        <label class="flex items-start gap-2.5 py-1.5 px-2 rounded-lg hover:bg-slate-800/50 cursor-pointer select-none group">
          <input type="checkbox" class="custom-checkbox ing-checkbox mt-0.5" data-key="${idx}" ${isChecked ? 'checked' : ''}>
          <span class="text-sm text-slate-200 group-hover:text-white transition ${isChecked ? 'checked-item' : ''}">
            ${scaledText}
          </span>
        </label>
      `;
    });
  }
  ingContainer.innerHTML = ingHtml;

  ingContainer.querySelectorAll('.ing-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const key = e.target.dataset.key;
      const span = e.target.closest('label').querySelector('span');
      if (e.target.checked) {
        AppState.checkedIngredients.add(key);
        span.classList.add('checked-item');
      } else {
        AppState.checkedIngredients.delete(key);
        span.classList.remove('checked-item');
      }
    });
  });

  renderMethodStepsWithTimers(r);
  renderInstantPotSection(r);

  const notesContainer = document.getElementById('modal-notes-container');
  if (r.notes && r.notes.trim()) {
    notesContainer.classList.remove('hidden');
    document.getElementById('modal-notes-text').innerText = r.notes;
  } else {
    notesContainer.classList.add('hidden');
  }

  const tagsContainer = document.getElementById('modal-tags-container');
  tagsContainer.innerHTML = r.tags.map(t => `
    <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
      #${t}
    </span>
  `).join('');

  setupModalActionButtons(r, scale);
  initLucideIcons();
}

function renderMethodStepsWithTimers(r) {
  const stepsContainer = document.getElementById('modal-instructions-list');
  const totalSteps = r.instructions.length;
  const completedCount = AppState.checkedSteps.size;
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  let stepsHtml = `
    <div class="p-3 mb-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i>
        <span class="text-xs font-bold text-slate-200">
          Step Completion: <span class="text-emerald-400 font-mono">${completedCount} of ${totalSteps}</span>
        </span>
      </div>
      <div class="w-36 bg-slate-800 h-2 rounded-full overflow-hidden">
        <div class="bg-emerald-500 h-full transition-all duration-300" style="width: ${progressPct}%"></div>
      </div>
    </div>
  `;

  stepsHtml += r.instructions.map((step, idx) => {
    const isChecked = AppState.checkedSteps.has(idx);
    const duration = extractStepDuration(step);
    const stepKey = `step-${idx}`;
    const timerState = AppState.activeTimers[stepKey];

    return `
      <div class="step-card p-4 rounded-xl border transition-all duration-200 ${isChecked ? 'bg-emerald-950/20 border-emerald-500/40 opacity-75' : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'}">
        <div class="flex items-start gap-3.5">
          <label class="flex items-center cursor-pointer mt-0.5 select-none" title="Mark step complete">
            <input type="checkbox" class="custom-checkbox step-tick-cb w-5 h-5" data-step="${idx}" ${isChecked ? 'checked' : ''}>
          </label>

          <div class="flex-1 space-y-2">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[11px] font-heading font-black tracking-wider uppercase ${isChecked ? 'text-emerald-400' : 'text-slate-400'}">
                Step ${idx + 1}
              </span>
              ${duration ? `
                <span class="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                  <i data-lucide="clock" class="w-3 h-3"></i> ~${Math.round(duration / 60)} min
                </span>
              ` : ''}
            </div>

            <p class="text-sm leading-relaxed text-slate-200 ${isChecked ? 'line-through text-slate-400' : ''}">
              ${step}
            </p>

            ${duration ? `
              <div class="pt-2 border-t border-slate-700/40 flex items-center gap-2">
                ${!timerState ? `
                  <button class="start-timer-btn px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition" data-step-key="${stepKey}" data-duration="${duration}">
                    <i data-lucide="play" class="w-3.5 h-3.5"></i> Start ${Math.round(duration / 60)}m Timer
                  </button>
                ` : `
                  <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-amber-500/50 shadow-md">
                    <i data-lucide="timer" class="w-4 h-4 text-amber-400 ${timerState.isRunning ? 'animate-pulse' : ''}"></i>
                    <span class="font-mono font-black text-sm text-amber-300 w-14 text-center">
                      ${formatTime(timerState.remainingSec)}
                    </span>
                    <button class="timer-toggle-btn p-1 rounded hover:bg-slate-800 text-slate-300" data-step-key="${stepKey}" title="${timerState.isRunning ? 'Pause' : 'Resume'}">
                      <i data-lucide="${timerState.isRunning ? 'pause' : 'play'}" class="w-3.5 h-3.5"></i>
                    </button>
                    <button class="timer-reset-btn p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400" data-step-key="${stepKey}" data-duration="${duration}" title="Reset">
                      <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                `}
              </div>
            ` : ''}

          </div>
        </div>
      </div>
    `;
  }).join('');

  stepsContainer.innerHTML = stepsHtml;

  stepsContainer.querySelectorAll('.step-tick-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const stepIdx = parseInt(e.target.dataset.step);
      if (e.target.checked) {
        AppState.checkedSteps.add(stepIdx);
      } else {
        AppState.checkedSteps.delete(stepIdx);
      }
      renderMethodStepsWithTimers(r);
      initLucideIcons();
    });
  });

  stepsContainer.querySelectorAll('.start-timer-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.currentTarget.dataset.stepKey;
      const duration = parseInt(e.currentTarget.dataset.duration);
      startTimer(key, duration, r);
    });
  });

  stepsContainer.querySelectorAll('.timer-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.currentTarget.dataset.stepKey;
      toggleTimer(key, r);
    });
  });

  stepsContainer.querySelectorAll('.timer-reset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.currentTarget.dataset.stepKey;
      const duration = parseInt(e.currentTarget.dataset.duration);
      resetTimer(key, duration, r);
    });
  });

  initLucideIcons();
}

function startTimer(key, duration, recipe) {
  if (AppState.activeTimers[key] && AppState.activeTimers[key].intervalId) {
    clearInterval(AppState.activeTimers[key].intervalId);
  }

  AppState.activeTimers[key] = {
    totalSec: duration,
    remainingSec: duration,
    isRunning: true,
    intervalId: null
  };

  AppState.activeTimers[key].intervalId = setInterval(() => {
    if (AppState.activeTimers[key].remainingSec > 0) {
      AppState.activeTimers[key].remainingSec--;
      renderMethodStepsWithTimers(recipe);
    } else {
      clearInterval(AppState.activeTimers[key].intervalId);
      AppState.activeTimers[key].isRunning = false;
      playTimerChime();
      showToast(`⏰ Step Timer Complete for ${recipe.title}!`);
      renderMethodStepsWithTimers(recipe);
    }
  }, 1000);

  renderMethodStepsWithTimers(recipe);
}

function toggleTimer(key, recipe) {
  const t = AppState.activeTimers[key];
  if (!t) return;

  if (t.isRunning) {
    clearInterval(t.intervalId);
    t.isRunning = false;
  } else {
    t.isRunning = true;
    t.intervalId = setInterval(() => {
      if (t.remainingSec > 0) {
        t.remainingSec--;
        renderMethodStepsWithTimers(recipe);
      } else {
        clearInterval(t.intervalId);
        t.isRunning = false;
        playTimerChime();
        showToast(`⏰ Step Timer Complete for ${recipe.title}!`);
        renderMethodStepsWithTimers(recipe);
      }
    }, 1000);
  }
  renderMethodStepsWithTimers(recipe);
}

function resetTimer(key, duration, recipe) {
  if (AppState.activeTimers[key] && AppState.activeTimers[key].intervalId) {
    clearInterval(AppState.activeTimers[key].intervalId);
  }
  delete AppState.activeTimers[key];
  renderMethodStepsWithTimers(recipe);
}

function renderInstantPotSection(r) {
  const container = document.getElementById('modal-instantpot-section');
  if (!container) return;

  const ip = r.instantPot;
  if (!ip) {
    container.innerHTML = `<p class="text-sm text-slate-400">No pressure cooker instructions available.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="space-y-4">
      <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span class="block text-[10px] text-amber-400 uppercase font-bold tracking-wider">Instant Pot Mode</span>
          <span class="font-heading font-extrabold text-sm text-white">${ip.mode}</span>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span class="block text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Cook Duration</span>
          <span class="font-heading font-extrabold text-sm text-emerald-300 font-mono">${ip.cookTime}</span>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span class="block text-[10px] text-blue-400 uppercase font-bold tracking-wider">Steam Release</span>
          <span class="font-heading font-extrabold text-sm text-blue-300">${ip.release}</span>
        </div>
      </div>

      <div class="space-y-2.5">
        <h4 class="font-heading font-bold text-base text-slate-100 flex items-center gap-2">
          <i data-lucide="gauge" class="w-4 h-4 text-amber-400"></i>
          Instant Pot Pro Pressure Cooker Directions
        </h4>

        <div class="space-y-2">
          ${ip.steps.map((s, idx) => `
            <div class="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <span class="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 font-heading font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                ${idx + 1}
              </span>
              <p class="text-sm text-slate-200 leading-relaxed">${s}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
        <p class="flex items-center gap-1.5 font-semibold text-amber-300 mb-1">
          <i data-lucide="info" class="w-4 h-4"></i> Instant Pot Pro Quick Tip:
        </p>
        Always ensure minimum 120ml (1/2 cup) of thin cooking liquid (water, broth) is in the bottom of the pot before sealing to avoid the 'Burn' warning.
      </div>
    </div>
  `;
}

function setupModalActionButtons(recipe, scale) {
  const addShopBtn = document.getElementById('modal-add-shopping-btn');
  if (addShopBtn) {
    addShopBtn.onclick = () => {
      const itemsToAdd = recipe.ingredients.map(ing => ({
        id: 'shop-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        text: scaleQuantityText(ing, scale),
        recipeTitle: recipe.title,
        completed: false
      }));

      AppState.shoppingList.push(...itemsToAdd);
      saveShoppingList();
      showToast(`Added ${itemsToAdd.length} ingredients to Shopping List!`);
    };
  }

  const planSlotBtns = document.querySelectorAll('.plan-slot-add-btn');
  planSlotBtns.forEach(btn => {
    btn.onclick = (e) => {
      const slot = e.currentTarget.dataset.slot;
      addToMealPlan(slot, recipe, scale);
    };
  });
}

function addToMealPlan(slot, recipe, scale) {
  AppState.mealPlan[slot].push({
    planId: 'plan-' + Date.now(),
    recipeId: recipe.id,
    title: recipe.title,
    category: recipe.category,
    image: recipe.image,
    scale: scale,
    nutrition: {
      calories: Math.round(recipe.nutrition.calories * scale),
      protein: Math.round(recipe.nutrition.protein * scale * 10) / 10,
      carbs: Math.round(recipe.nutrition.carbs * scale * 10) / 10,
      fat: Math.round(recipe.nutrition.fat * scale * 10) / 10
    }
  });

  saveMealPlan();
  showToast(`Added to today's ${slot.toUpperCase()}!`);
}

function showToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-slate-950 font-bold text-sm shadow-xl flex items-center gap-2 transform transition-all duration-300';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> ${msg}`;
  initLucideIcons();
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 2500);
}

function renderPlannerView() {
  const container = document.getElementById('planner-slots-container');
  if (!container) return;

  const slots = ['breakfast', 'lunch', 'dinner', 'snacks'];
  const slotLabels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks & Drinks' };

  let totalCals = 0;
  let totalPro = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  let html = '';

  slots.forEach(slot => {
    const items = AppState.mealPlan[slot] || [];
    let slotCals = 0;
    let slotPro = 0;

    items.forEach(it => {
      slotCals += it.nutrition.calories;
      slotPro += it.nutrition.protein;
      totalCals += it.nutrition.calories;
      totalPro += it.nutrition.protein;
      totalCarbs += it.nutrition.carbs;
      totalFat += it.nutrition.fat;
    });

    html += `
      <div class="glass-panel p-5 rounded-2xl border border-slate-800">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 class="font-heading font-bold text-lg text-slate-100">${slotLabels[slot]}</h3>
            <span class="text-xs text-slate-400">${items.length} items • ${slotCals} kcal • ${Math.round(slotPro)}g Protein</span>
          </div>
          <button onclick="switchTab('recipes')" class="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/20 transition flex items-center gap-1.5">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Add Recipe
          </button>
        </div>

        <div class="divide-y divide-slate-800/60 mt-3">
          ${items.length === 0 ? `
            <p class="py-4 text-center text-xs text-slate-500 italic">No meals added for ${slotLabels[slot]} yet.</p>
          ` : items.map(item => `
            <div class="py-2.5 flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <img src="${item.image}" alt="" class="w-11 h-11 rounded-lg object-cover bg-slate-900 border border-slate-700">
                <div>
                  <h4 class="font-semibold text-sm text-slate-200 line-clamp-1">${item.title}</h4>
                  <span class="text-xs text-slate-400 font-mono">${item.nutrition.calories} kcal | ${item.nutrition.protein}g P | x${item.scale}</span>
                </div>
              </div>
              <button onclick="removeFromMealPlan('${slot}', '${item.planId}')" class="p-1.5 text-slate-400 hover:text-rose-400 transition" title="Remove meal">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  const targetCals = AppState.userProfile.customTdee || 2600;
  const weightKg = AppState.userProfile.unit === 'kg' ? AppState.userProfile.weight : AppState.userProfile.weight * 0.453592;
  const targetPro = Math.round(weightKg * 2.2);

  document.getElementById('plan-total-cals').innerText = totalCals;
  document.getElementById('plan-target-cals').innerText = `${targetCals} kcal`;
  document.getElementById('plan-total-pro').innerText = `${Math.round(totalPro)}g`;
  document.getElementById('plan-target-pro').innerText = `${targetPro}g`;
  document.getElementById('plan-total-carbs').innerText = `${Math.round(totalCarbs)}g`;
  document.getElementById('plan-total-fat').innerText = `${Math.round(totalFat)}g`;

  const calProgress = Math.min(Math.round((totalCals / targetCals) * 100), 100);
  const proProgress = Math.min(Math.round((totalPro / targetPro) * 100), 100);

  document.getElementById('plan-cal-bar').style.width = `${calProgress}%`;
  document.getElementById('plan-pro-bar').style.width = `${proProgress}%`;

  initLucideIcons();
}

function removeFromMealPlan(slot, planId) {
  AppState.mealPlan[slot] = AppState.mealPlan[slot].filter(it => it.planId !== planId);
  saveMealPlan();
  renderPlannerView();
}

function clearEntireMealPlan() {
  if (confirm("Are you sure you want to clear today's meal plan?")) {
    AppState.mealPlan = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    saveMealPlan();
    renderPlannerView();
  }
}

function addPlanIngredientsToShoppingList() {
  let count = 0;
  const slots = ['breakfast', 'lunch', 'dinner', 'snacks'];
  slots.forEach(s => {
    AppState.mealPlan[s].forEach(item => {
      const orig = AppState.recipes.find(r => r.id === item.recipeId);
      if (orig) {
        orig.ingredients.forEach(ing => {
          AppState.shoppingList.push({
            id: 'shop-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            text: scaleQuantityText(ing, item.scale),
            recipeTitle: item.title,
            completed: false
          });
          count++;
        });
      }
    });
  });

  saveShoppingList();
  showToast(`Added ${count} ingredients from meal plan to Shopping List!`);
}

function saveMealPlan() {
  localStorage.setItem('clean_cooking_meal_plan', JSON.stringify(AppState.mealPlan));
}

function renderShoppingView() {
  const container = document.getElementById('shopping-items-list');
  if (!container) return;

  const items = AppState.shoppingList;
  if (items.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        <i data-lucide="shopping-bag" class="w-10 h-10 mx-auto mb-2 text-slate-500"></i>
        <p class="font-semibold text-slate-300">Your shopping list is empty.</p>
        <p class="text-xs text-slate-500 mt-1">Add items from recipes or meal plans, or enter custom groceries below.</p>
      </div>
    `;
    initLucideIcons();
    return;
  }

  container.innerHTML = items.map((item) => `
    <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 transition">
      <label class="flex items-center gap-3 cursor-pointer select-none flex-1">
        <input type="checkbox" class="custom-checkbox shop-item-cb" data-id="${item.id}" ${item.completed ? 'checked' : ''}>
        <div>
          <span class="text-sm font-medium text-slate-200 ${item.completed ? 'line-through text-slate-500' : ''}">${item.text}</span>
          ${item.recipeTitle ? `<span class="block text-[10px] text-emerald-400/80">${item.recipeTitle}</span>` : ''}
        </div>
      </label>
      <button onclick="removeShoppingItem('${item.id}')" class="p-1 text-slate-400 hover:text-rose-400 transition" title="Delete item">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.shop-item-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const targetItem = AppState.shoppingList.find(it => it.id === id);
      if (targetItem) {
        targetItem.completed = e.target.checked;
        saveShoppingList();
        renderShoppingView();
      }
    });
  });

  initLucideIcons();
}

function addCustomShoppingItem() {
  const input = document.getElementById('custom-shopping-input');
  if (!input || !input.value.trim()) return;

  AppState.shoppingList.push({
    id: 'shop-' + Date.now(),
    text: input.value.trim(),
    recipeTitle: 'Custom Grocery Item',
    completed: false
  });

  input.value = '';
  saveShoppingList();
  renderShoppingView();
}

function removeShoppingItem(id) {
  AppState.shoppingList = AppState.shoppingList.filter(it => it.id !== id);
  saveShoppingList();
  renderShoppingView();
}

function clearCompletedShoppingItems() {
  AppState.shoppingList = AppState.shoppingList.filter(it => !it.completed);
  saveShoppingList();
  renderShoppingView();
}

function copyShoppingListToClipboard() {
  const lines = AppState.shoppingList.map(it => `[${it.completed ? 'X' : ' '}] ${it.text} ${it.recipeTitle ? `(${it.recipeTitle})` : ''}`);
  navigator.clipboard.writeText("CLEAN COOKING SHOPPING LIST (METRIC):\n" + lines.join("\n"));
  showToast("Shopping list copied to clipboard!");
}

function saveShoppingList() {
  localStorage.setItem('clean_cooking_shopping_list', JSON.stringify(AppState.shoppingList));
}

function renderGuideView() {
  renderShoppingGuideCategories();
  renderCookbookFaqs();
}

function renderShoppingGuideCategories() {
  const container = document.getElementById('shopping-guide-accordion');
  if (!container || !AppState.shoppingGuide) return;

  const sg = AppState.shoppingGuide;
  const sections = [
    { key: 'meats', title: 'Cold Ingredients - Halal Meats & Poultry', icon: 'drumstick' },
    { key: 'eggs_and_dairy', title: 'Cold Ingredients - Eggs & High-Protein Dairy', icon: 'egg' },
    { key: 'breads_and_wraps', title: 'Breads, Bagels & Low-Cal Tortillas', icon: 'sandwich' },
    { key: 'sauces_and_cooking', title: 'Low-Cal Sauces, Pastes & Cooking Condiments', icon: 'flame' },
    { key: 'produce_and_frozen', title: 'Fresh Produce & Frozen Fruits / Veg', icon: 'apple' },
    { key: 'pantry_and_grains', title: 'Pantry Grains, Flours, Pastas & Oils', icon: 'wheat' },
    { key: 'baking_and_sweet', title: 'Sweeteners, 0 Cal Syrups & Baking Staples', icon: 'sparkles' },
    { key: 'seasonings_and_protein', title: 'Seasonings, Bulk Herbs & Whey Powders', icon: 'dumbbell' }
  ];

  container.innerHTML = sections.map((sec, idx) => `
    <div class="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
      <button class="w-full p-4 flex items-center justify-between text-left font-heading font-bold text-slate-200 hover:text-emerald-400 transition" onclick="toggleAccordion('guide-sec-${idx}')">
        <span class="flex items-center gap-2.5">
          <i data-lucide="${sec.icon}" class="w-4 h-4 text-emerald-400"></i>
          ${sec.title}
        </span>
        <i data-lucide="chevron-down" class="w-4 h-4 text-slate-500"></i>
      </button>
      <div id="guide-sec-${idx}" class="p-4 pt-0 border-t border-slate-800/60 ${idx === 0 ? '' : 'hidden'}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-2">
          ${(sg[sec.key] || []).map(item => `
            <div class="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40 flex justify-between items-center">
              <span class="font-semibold text-slate-200">${item.item}</span>
              <span class="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono">${item.source}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `).join('');

  initLucideIcons();
}

function toggleAccordion(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden');
}

function renderCookbookFaqs() {
  const container = document.getElementById('faqs-container');
  if (!container || !AppState.cookbookGuide) return;

  container.innerHTML = AppState.cookbookGuide.faqs.map(faq => `
    <div class="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
      <h4 class="font-heading font-bold text-slate-100 text-sm mb-1 text-emerald-400">${faq.q}</h4>
      <p class="text-xs text-slate-300 leading-relaxed">${faq.a}</p>
    </div>
  `).join('');
}

function setupConversionEvents() {
  const fIn = document.getElementById('conv-temp-f');
  const cFanIn = document.getElementById('conv-temp-c-fan');
  const cConvIn = document.getElementById('conv-temp-c-conv');

  if (cFanIn) {
    cFanIn.addEventListener('input', (e) => {
      const c = parseFloat(e.target.value);
      if (!isNaN(c)) {
        if (fIn) fIn.value = Math.round((c * 9/5) + 32);
        if (cConvIn) cConvIn.value = c + 20;
      }
    });
  }

  const gIn = document.getElementById('conv-weight-g');
  const ozIn = document.getElementById('conv-weight-oz');
  if (gIn) {
    gIn.addEventListener('input', (e) => {
      const g = parseFloat(e.target.value);
      if (!isNaN(g) && ozIn) ozIn.value = (g / 28.3495).toFixed(1);
    });
  }
  if (ozIn) {
    ozIn.addEventListener('input', (e) => {
      const oz = parseFloat(e.target.value);
      if (!isNaN(oz) && gIn) gIn.value = Math.round(oz * 28.3495);
    });
  }
}

function loadUserProfile() {
  const p = AppState.userProfile;
  const weightInput = document.getElementById('profile-weight');
  const goalSelect = document.getElementById('profile-goal');
  const tdeeInput = document.getElementById('profile-tdee');

  if (weightInput) weightInput.value = p.weight;
  if (goalSelect) goalSelect.value = p.goal;
  if (tdeeInput) tdeeInput.value = p.customTdee || 2600;
}

function setupPlannerEvents() {
  const saveBtn = document.getElementById('save-profile-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const w = parseFloat(document.getElementById('profile-weight').value) || 80;
      const g = document.getElementById('profile-goal').value;
      const t = parseInt(document.getElementById('profile-tdee').value) || 2600;

      AppState.userProfile.weight = w;
      AppState.userProfile.goal = g;
      AppState.userProfile.customTdee = t;

      localStorage.setItem('clean_cooking_user_profile', JSON.stringify(AppState.userProfile));
      showToast("Macro targets updated!");
      renderPlannerView();
    });
  }
}

function setupShoppingListEvents() {
  const addBtn = document.getElementById('add-custom-shopping-btn');
  if (addBtn) {
    addBtn.addEventListener('click', addCustomShoppingItem);
  }

  const customInput = document.getElementById('custom-shopping-input');
  if (customInput) {
    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addCustomShoppingItem();
    });
  }
}

function renderApp() {
  renderSubcategoryPills();
  filterAndRenderRecipes();
}
