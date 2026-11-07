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
  mealPrep: JSON.parse(localStorage.getItem('clean_cooking_meal_prep') || '{"days":5,"meals":[]}'),
  userProfile: JSON.parse(localStorage.getItem('clean_cooking_user_profile') || '{"weight":80,"height":178,"age":25,"gender":"male","activity":1.55,"unit":"kg","goal":"bulk"}'),
  suggestedPlanCache: null,
  showingAutoSuggest: false,
  shoppingList: JSON.parse(localStorage.getItem('clean_cooking_shopping_list') || '[]'),
  activeModalRecipe: null,
  activeModalScale: 1.0,
  checkedIngredients: new Set(),
  checkedSteps: new Set(),
  checkedIpSteps: new Set(),
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
  if (cat === 'All' || cat === 'Favorites' || cat === 'Hotpot') {
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
  } else if (AppState.selectedCategory === 'Hotpot') {
    list = list.filter(r => r.instantPot && r.instantPot.applicable);
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
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-md flex items-center gap-1" title="Pressure Cooker & Hotpot (Instant Pot Pro) instructions available">
                <i data-lucide="gauge" class="w-3 h-3 text-amber-400"></i> Pressure Cooker / Hotpot
              </span>
            ` : ''}
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="event.stopPropagation(); quickAddRecipeToMealPrep('${r.id}')" class="p-1.5 px-2 rounded-full bg-slate-900/85 backdrop-blur-md text-slate-300 hover:text-amber-300 hover:bg-slate-800 border border-white/10 transition flex items-center gap-1 text-[10px] font-bold" title="Add to Meal Prep">
              <i data-lucide="chef-hat" class="w-3.5 h-3.5 text-amber-400"></i> Prep
            </button>
            <button class="card-action-btn fav-btn p-2 rounded-full bg-slate-900/80 backdrop-blur-md text-slate-300 hover:text-rose-400 border border-white/10 transition" data-id="${r.id}" title="Save to favorites">
              <i data-lucide="heart" class="w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}"></i>
            </button>
          </div>
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
  AppState.checkedIpSteps.clear();
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

function refreshActiveStepsView(recipe) {
  if (AppState.modalActiveTab === 'instantpot') {
    renderInstantPotSection(recipe);
  } else {
    renderMethodStepsWithTimers(recipe);
  }
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
      refreshActiveStepsView(recipe);
    } else {
      clearInterval(AppState.activeTimers[key].intervalId);
      AppState.activeTimers[key].isRunning = false;
      playTimerChime();
      showToast(`⏰ Step Timer Complete for ${recipe.title}!`);
      refreshActiveStepsView(recipe);
    }
  }, 1000);

  refreshActiveStepsView(recipe);
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
        refreshActiveStepsView(recipe);
      } else {
        clearInterval(t.intervalId);
        t.isRunning = false;
        playTimerChime();
        showToast(`⏰ Step Timer Complete for ${recipe.title}!`);
        refreshActiveStepsView(recipe);
      }
    }, 1000);
  }
  refreshActiveStepsView(recipe);
}

function resetTimer(key, duration, recipe) {
  if (AppState.activeTimers[key] && AppState.activeTimers[key].intervalId) {
    clearInterval(AppState.activeTimers[key].intervalId);
  }
  delete AppState.activeTimers[key];
  refreshActiveStepsView(recipe);
}

function renderInstantPotSection(r) {
  const container = document.getElementById('modal-instantpot-section');
  if (!container) return;

  const ip = r.instantPot;
  if (!ip) {
    container.innerHTML = `<p class="text-sm text-slate-400">No pressure cooker instructions available.</p>`;
    return;
  }

  const totalSteps = ip.steps ? ip.steps.length : 0;
  const completedCount = AppState.checkedIpSteps.size;
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  container.innerHTML = `
    <div class="space-y-4">
      <!-- 4-Card Pro Specs Grid -->
      <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div class="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <span class="block text-[10px] text-amber-400 uppercase font-bold tracking-wider">Appliance & Mode</span>
          <span class="font-heading font-extrabold text-xs sm:text-sm text-white line-clamp-1" title="${ip.mode}">${ip.mode}</span>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <span class="block text-[10px] text-blue-400 uppercase font-bold tracking-wider">Pressure / Heat</span>
          <span class="font-heading font-extrabold text-xs sm:text-sm text-blue-300">${ip.pressureLevel || 'High Pressure'}</span>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <span class="block text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Cook Duration</span>
          <span class="font-heading font-extrabold text-xs sm:text-sm text-emerald-300 font-mono">${ip.cookTime || 'N/A'}</span>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <span class="block text-[10px] text-purple-400 uppercase font-bold tracking-wider">Steam Release / Lid</span>
          <span class="font-heading font-extrabold text-xs sm:text-sm text-purple-300">${ip.release || 'Quick Release'}</span>
        </div>
      </div>

      <!-- Liquid & Steam Requirement Alert -->
      <div class="p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 flex items-center gap-3 text-xs text-slate-300">
        <div class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
          <i data-lucide="droplet" class="w-4 h-4"></i>
        </div>
        <div>
          <span class="font-bold text-amber-300">Liquid / Hotpot Broth Requirement:</span>
          <span class="text-slate-200 ml-1">${ip.liquidRequired || 'Minimum 120ml (1/2 cup) cooking broth or water'}</span>
        </div>
      </div>

      <!-- Completion Bar -->
      <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <i data-lucide="gauge" class="w-4 h-4 text-amber-400"></i>
          <span class="text-xs font-bold text-slate-200">
            Pressure Cooker / Hotpot Progress: <span class="text-amber-400 font-mono">${completedCount} of ${totalSteps}</span>
          </span>
        </div>
        <div class="w-36 bg-slate-800 h-2 rounded-full overflow-hidden">
          <div class="bg-amber-500 h-full transition-all duration-300" style="width: ${progressPct}%"></div>
        </div>
      </div>

      <!-- Steps with Checkboxes and Timers -->
      <div class="space-y-2.5">
        <h4 class="font-heading font-bold text-sm text-slate-200 flex items-center gap-2">
          <i data-lucide="list-ordered" class="w-4 h-4 text-amber-400"></i>
          Pressure Cooker & Hotpot (Instant Pot Pro) Directions
        </h4>

        <div class="space-y-2" id="ip-steps-list">
          ${ip.steps.map((step, idx) => {
            const isChecked = AppState.checkedIpSteps.has(idx);
            const duration = extractStepDuration(step);
            const stepKey = `ip-step-${idx}`;
            const timerState = AppState.activeTimers[stepKey];

            return `
              <div class="step-card p-4 rounded-xl border transition-all duration-200 ${isChecked ? 'bg-amber-950/20 border-amber-500/40 opacity-75' : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'}">
                <div class="flex items-start gap-3.5">
                  <label class="flex items-center cursor-pointer mt-0.5 select-none" title="Mark step complete">
                    <input type="checkbox" class="custom-checkbox ip-step-tick-cb w-5 h-5 accent-amber-500" data-step="${idx}" ${isChecked ? 'checked' : ''}>
                  </label>

                  <div class="flex-1 space-y-2">
                    <div class="flex items-baseline justify-between gap-2">
                      <span class="text-[11px] font-heading font-black tracking-wider uppercase ${isChecked ? 'text-amber-400' : 'text-slate-400'}">
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
                          <button class="ip-start-timer-btn px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition" data-step-key="${stepKey}" data-duration="${duration}">
                            <i data-lucide="play" class="w-3.5 h-3.5"></i> Start ${Math.round(duration / 60)}m Timer
                          </button>
                        ` : `
                          <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-amber-500/50 shadow-md">
                            <i data-lucide="timer" class="w-4 h-4 text-amber-400 ${timerState.isRunning ? 'animate-pulse' : ''}"></i>
                            <span class="font-mono font-black text-sm text-amber-300 w-14 text-center">
                              ${formatTime(timerState.remainingSec)}
                            </span>
                            <button class="ip-timer-toggle-btn p-1 rounded hover:bg-slate-800 text-slate-300" data-step-key="${stepKey}" title="${timerState.isRunning ? 'Pause' : 'Resume'}">
                              <i data-lucide="${timerState.isRunning ? 'pause' : 'play'}" class="w-3.5 h-3.5"></i>
                            </button>
                            <button class="ip-timer-reset-btn p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400" data-step-key="${stepKey}" data-duration="${duration}" title="Reset">
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
          }).join('')}
        </div>
      </div>

      <!-- Pressure Cooker & Hotpot Pro Tips -->
      <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 space-y-1.5">
        <p class="flex items-center gap-1.5 font-bold text-amber-300">
          <i data-lucide="shield-alert" class="w-4 h-4"></i> Pressure Cooker & Hotpot Pro Tips:
        </p>
        <p>• <strong>Pressure Cooker Mode:</strong> Always ensure the steam release valve is set to <em>Sealing</em> and there is minimum 120ml liquid in the pot before sealing to avoid the <em>Food Burn</em> warning.</p>
        <p>• <strong>Hotpot Mode:</strong> Use <em>Sauté / Hotpot</em> (Med/High) with lid off (or glass lid) for tabletop hotpot simmering, searing, reducing broths, or melting cheese.</p>
        <p>• <strong>Steaming / Baking:</strong> Use the stainless steel trivet with 250ml water beneath for delicate cakes, puddings, oats, and tender steamed proteins.</p>
      </div>
    </div>
  `;

  // Attach event listeners for Instant Pot checkboxes and timers
  container.querySelectorAll('.ip-step-tick-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const stepIdx = parseInt(e.target.dataset.step);
      if (e.target.checked) {
        AppState.checkedIpSteps.add(stepIdx);
      } else {
        AppState.checkedIpSteps.delete(stepIdx);
      }
      renderInstantPotSection(r);
      initLucideIcons();
    });
  });

  container.querySelectorAll('.ip-start-timer-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.currentTarget.dataset.stepKey;
      const duration = parseInt(e.currentTarget.dataset.duration);
      startTimer(key, duration, r);
    });
  });

  container.querySelectorAll('.ip-timer-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.currentTarget.dataset.stepKey;
      toggleTimer(key, r);
    });
  });

  container.querySelectorAll('.ip-timer-reset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.currentTarget.dataset.stepKey;
      const duration = parseInt(e.currentTarget.dataset.duration);
      resetTimer(key, duration, r);
    });
  });

  initLucideIcons();
}

function setupModalActionButtons(recipe, scale) {
  const addPrepBtn = document.getElementById('modal-add-prep-btn');
  if (addPrepBtn) {
    addPrepBtn.onclick = () => {
      addToMealPrep(recipe, 1);
    };
  }

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

// ================= MEAL PREP & BMR CALCULATOR ENGINE =================

function calculateBmrAndTargets() {
  const p = AppState.userProfile;
  const w = parseFloat(p.weight) || 80;
  const h = parseFloat(p.height) || 178;
  const a = parseInt(p.age) || 25;
  const g = p.gender || 'male';
  const act = parseFloat(p.activity) || 1.55;

  // Mifflin-St Jeor Formula
  let bmr = (10 * w) + (6.25 * h) - (5 * a);
  if (g === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }
  bmr = Math.round(bmr);

  const tdee = Math.round(bmr * act);
  let targetCals = tdee;
  let goalLabel = 'Maintenance';

  if (p.goal === 'bulk') {
    targetCals = tdee + 350; // Optimal lean bulking surplus
    goalLabel = '+350 kcal Lean Surplus';
  } else if (p.goal === 'cut') {
    targetCals = Math.max(1200, tdee - 500); // Sustainable fat loss deficit
    goalLabel = '-500 kcal Fat Loss Deficit';
  }

  const targetPro = Math.round(w * 2.2); // 2.2g per kg
  const days = AppState.mealPrep.days || 5;

  return {
    bmr,
    tdee,
    targetCals,
    targetPro,
    goalLabel,
    days,
    batchTargetCals: targetCals * days,
    batchTargetPro: targetPro * days
  };
}

function updateBmrCalculation() {
  const genderEl = document.getElementById('prep-gender');
  const ageEl = document.getElementById('prep-age');
  const heightEl = document.getElementById('prep-height');
  const weightEl = document.getElementById('prep-weight');
  const actEl = document.getElementById('prep-activity');
  const goalEl = document.getElementById('prep-goal');

  if (genderEl) AppState.userProfile.gender = genderEl.value;
  if (ageEl) AppState.userProfile.age = parseInt(ageEl.value) || 25;
  if (heightEl) AppState.userProfile.height = parseFloat(heightEl.value) || 178;
  if (weightEl) AppState.userProfile.weight = parseFloat(weightEl.value) || 80;
  if (actEl) AppState.userProfile.activity = parseFloat(actEl.value) || 1.55;
  if (goalEl) AppState.userProfile.goal = goalEl.value;

  localStorage.setItem('clean_cooking_user_profile', JSON.stringify(AppState.userProfile));

  const stats = calculateBmrAndTargets();

  const bmrEl = document.getElementById('stat-bmr');
  const tdeeEl = document.getElementById('stat-tdee');
  const calsEl = document.getElementById('stat-target-cals');
  const proEl = document.getElementById('stat-target-pro');
  const batchCalsEl = document.getElementById('stat-batch-cals');
  const batchProEl = document.getElementById('stat-batch-pro');
  const goalBadgeEl = document.getElementById('stat-goal-badge');

  if (bmrEl) bmrEl.innerText = stats.bmr.toLocaleString();
  if (tdeeEl) tdeeEl.innerText = stats.tdee.toLocaleString();
  if (calsEl) calsEl.innerText = stats.targetCals.toLocaleString();
  if (proEl) proEl.innerText = stats.targetPro.toLocaleString();
  if (batchCalsEl) batchCalsEl.innerText = `${stats.batchTargetCals.toLocaleString()} kcal for ${stats.days} days`;
  if (batchProEl) batchProEl.innerText = `${stats.batchTargetPro.toLocaleString()}g protein for ${stats.days} days`;
  if (goalBadgeEl) goalBadgeEl.innerText = stats.goalLabel;

  renderMealPrepSection();
}

function setMealPrepDays(days) {
  AppState.mealPrep.days = parseInt(days) || 5;
  saveMealPrep();

  document.querySelectorAll('.prep-days-pill').forEach(btn => {
    btn.className = "prep-days-pill px-3 py-1.5 rounded-lg text-xs font-bold transition text-slate-400 hover:text-white";
  });

  const activeBtn = document.getElementById(`prep-days-btn-${days}`);
  if (activeBtn) {
    activeBtn.className = "prep-days-pill px-3 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-500 text-slate-950 font-extrabold shadow";
  }

  updateBmrCalculation();
  showToast(`Updated to ${days}-Day Meal Prep Batch!`);
}

function promptCustomPrepDays() {
  const input = prompt("Enter number of meal prep days (e.g. 4, 10, 14):", AppState.mealPrep.days || 5);
  if (input) {
    const days = parseInt(input);
    if (!isNaN(days) && days >= 1 && days <= 60) {
      setMealPrepDays(days);
    } else {
      alert("Please enter a valid number of days between 1 and 60.");
    }
  }
}

function saveMealPrep() {
  localStorage.setItem('clean_cooking_meal_prep', JSON.stringify(AppState.mealPrep));
}

function addToMealPrep(recipe, servingsPerDay = 1) {
  if (!AppState.mealPrep.meals) AppState.mealPrep.meals = [];

  const existing = AppState.mealPrep.meals.find(m => m.recipeId === recipe.id);
  if (existing) {
    existing.servingsPerDay = (existing.servingsPerDay || 1) + servingsPerDay;
    showToast(`Increased ${recipe.title} to ${existing.servingsPerDay} servings/day!`);
  } else {
    AppState.mealPrep.meals.push({
      prepId: 'prep-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      recipeId: recipe.id,
      title: recipe.title,
      category: recipe.category,
      subCategory: recipe.subCategory,
      image: recipe.image,
      servingsPerDay: servingsPerDay,
      scale: 1.0,
      nutrition: { ...recipe.nutrition },
      instantPot: recipe.instantPot
    });
    showToast(`Added ${recipe.title} to your ${AppState.mealPrep.days || 5}-Day Meal Prep!`);
  }
  AppState.showingAutoSuggest = false;
  saveMealPrep();
  if (AppState.currentTab === 'planner') {
    renderPlannerView();
  }
}

function quickAddRecipeToMealPrep(id) {
  const recipe = AppState.recipes.find(r => r.id === id);
  if (recipe) {
    addToMealPrep(recipe, 1);
  }
}

function adjustMealPrepServings(prepId, delta) {
  const item = AppState.mealPrep.meals.find(m => m.prepId === prepId);
  if (!item) return;

  item.servingsPerDay = Math.max(1, (item.servingsPerDay || 1) + delta);
  saveMealPrep();
  renderMealPrepSection();
}

function removeMealFromPrep(prepId) {
  AppState.mealPrep.meals = AppState.mealPrep.meals.filter(m => m.prepId !== prepId);
  saveMealPrep();
  renderMealPrepSection();
  showToast("Removed meal from prep list.");
}

function clearEntireMealPrep() {
  if (confirm("Are you sure you want to clear your meal prep list?")) {
    AppState.mealPrep.meals = [];
    AppState.showingAutoSuggest = false;
    saveMealPrep();
    renderMealPrepSection();
    showToast("Meal prep list cleared.");
  }
}

function getSuggestedMealPlan(goal, targetCals, targetPro) {
  const breakfasts = AppState.recipes.filter(r => r.category === 'Breakfast');
  const lunches = AppState.recipes.filter(r => r.category === 'Lunch');
  const dinners = AppState.recipes.filter(r => r.category === 'Dinner');
  const snacks = AppState.recipes.filter(r => r.category === 'Drinks' || r.category === 'Snacks');

  if (goal === 'bulk') {
    breakfasts.sort((a,b) => b.nutrition.calories - a.nutrition.calories);
    lunches.sort((a,b) => b.nutrition.calories - a.nutrition.calories);
    dinners.sort((a,b) => b.nutrition.calories - a.nutrition.calories);
    snacks.sort((a,b) => b.nutrition.calories - a.nutrition.calories);
  } else {
    breakfasts.sort((a,b) => b.nutrition.proteinCalPct - a.nutrition.proteinCalPct);
    lunches.sort((a,b) => b.nutrition.proteinCalPct - a.nutrition.proteinCalPct);
    dinners.sort((a,b) => b.nutrition.proteinCalPct - a.nutrition.proteinCalPct);
    snacks.sort((a,b) => b.nutrition.proteinCalPct - a.nutrition.proteinCalPct);
  }

  const bTop = breakfasts.slice(0, 15);
  const lTop = lunches.slice(0, 15);
  const dTop = dinners.slice(0, 15);
  const sTop = snacks.slice(0, 15);
  if (!bTop.length || !lTop.length || !dTop.length || !sTop.length) {
    return [];
  }

  let bestCombo = null;
  let bestDiff = 999999;

  for (let i = 0; i < 40; i++) {
    const b = bTop[Math.floor(Math.random() * bTop.length)];
    const l = lTop[Math.floor(Math.random() * lTop.length)];
    const d = dTop[Math.floor(Math.random() * dTop.length)];
    const s = sTop[Math.floor(Math.random() * sTop.length)];

    const cals = b.nutrition.calories + l.nutrition.calories + d.nutrition.calories + s.nutrition.calories;
    const pro = b.nutrition.protein + l.nutrition.protein + d.nutrition.protein + s.nutrition.protein;

    const diff = Math.abs(cals - targetCals) + (pro < targetPro ? (targetPro - pro) * 15 : 0);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestCombo = [b, l, d, s];
    }
  }

  AppState.suggestedPlanCache = bestCombo || [breakfasts[0], lunches[0], dinners[0], snacks[0]];
  return AppState.suggestedPlanCache;
}

function triggerAutoSuggestPlan() {
  const stats = calculateBmrAndTargets();
  getSuggestedMealPlan(AppState.userProfile.goal, stats.targetCals, stats.targetPro);
  AppState.showingAutoSuggest = true;
  renderMealPrepSection();
  showToast("✨ Generated fresh personalized meal suggestions!");
}

function acceptSuggestedMealPlan() {
  if (!AppState.suggestedPlanCache || AppState.suggestedPlanCache.length === 0) {
    const stats = calculateBmrAndTargets();
    getSuggestedMealPlan(AppState.userProfile.goal, stats.targetCals, stats.targetPro);
  }

  AppState.suggestedPlanCache.forEach(r => {
    addToMealPrep(r, 1);
  });

  AppState.showingAutoSuggest = false;
  renderMealPrepSection();
  showToast(`✅ Locked in ${AppState.suggestedPlanCache.length} meals for ${AppState.mealPrep.days || 5} days!`);
}

function exportMealPrepToShoppingList() {
  if (!AppState.mealPrep.meals || AppState.mealPrep.meals.length === 0) {
    showToast("Your meal prep list is empty! Add or auto-suggest meals first.");
    return;
  }

  const days = AppState.mealPrep.days || 5;
  let addedCount = 0;

  AppState.mealPrep.meals.forEach(m => {
    const orig = AppState.recipes.find(r => r.id === m.recipeId);
    if (!orig) return;

    const totalServings = (m.servingsPerDay || 1) * days;
    orig.ingredients.forEach(ing => {
      AppState.shoppingList.push({
        id: 'shop-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        text: scaleQuantityText(ing, totalServings),
        recipeTitle: `${orig.title} (${days}-Day Meal Prep: ${totalServings} servings)`,
        completed: false
      });
      addedCount++;
    });
  });

  saveShoppingList();
  showToast(`🛒 Exported ${addedCount} batch ingredients for ${days} days to your Shopping List!`);
}

function renderMealPrepSection() {
  const container = document.getElementById('meal-prep-container');
  if (!container) return;

  const stats = calculateBmrAndTargets();
  const days = stats.days;
  const meals = AppState.mealPrep.meals || [];

  if (meals.length === 0 || AppState.showingAutoSuggest) {
    // Show Auto-Suggest View
    const suggested = (AppState.suggestedPlanCache && AppState.suggestedPlanCache.length)
      ? AppState.suggestedPlanCache
      : getSuggestedMealPlan(AppState.userProfile.goal, stats.targetCals, stats.targetPro);
    if (!suggested.length || suggested.some((r) => !r || !r.nutrition)) {
      container.innerHTML = "";
      return;
    }
    let sugCals = 0;
    let sugPro = 0;
    let sugCarbs = 0;
    let sugFat = 0;
    suggested.forEach(r => {
      sugCals += r.nutrition.calories;
      sugPro += r.nutrition.protein;
      sugCarbs += r.nutrition.carbs;
      sugFat += r.nutrition.fat;
    });

    container.innerHTML = `
      <div class="glass-panel p-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-slate-900/60 space-y-5">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 inline-flex mb-1.5">
              <i data-lucide="sparkles" class="w-3.5 h-3.5 text-emerald-400"></i> Auto-Suggested Halal Plan
            </span>
            <h3 class="font-heading font-black text-xl text-white">Curated Meal Prep for Your ${AppState.userProfile.goal === 'bulk' ? 'Lean Muscle Gain' : 'Fat Loss'} Target</h3>
            <p class="text-xs text-slate-300 mt-1">
              You haven't added meals yet. We've handpicked these 4 complementary Halal recipes to hit your exact <strong>${stats.targetCals} kcal</strong> and <strong>${stats.targetPro}g protein</strong> target!
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="triggerAutoSuggestPlan()" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Shuffle
            </button>
            <button onclick="acceptSuggestedMealPlan()" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 transition flex items-center gap-1.5">
              <i data-lucide="check" class="w-4 h-4"></i> Accept & Add to ${days}-Day Prep
            </button>
          </div>
        </div>

        <!-- Suggested Daily Macro Summary Bar -->
        <div class="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-4">
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Plan Calories:</span>
              <span class="font-heading font-black text-amber-300 text-base">${sugCals} <span class="text-xs font-normal text-slate-400">/ ${stats.targetCals} kcal</span></span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Plan Protein:</span>
              <span class="font-heading font-black text-emerald-300 text-base">${Math.round(sugPro)}g <span class="text-xs font-normal text-slate-400">/ ${stats.targetPro}g</span></span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Carbs:</span>
              <span class="font-heading font-bold text-blue-300 text-sm">${Math.round(sugCarbs)}g</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-bold">Fat:</span>
              <span class="font-heading font-bold text-rose-300 text-sm">${Math.round(sugFat)}g</span>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-lg text-xs font-bold ${Math.abs(sugCals - stats.targetCals) <= 150 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">
            🎯 Match Accuracy: ${Math.round((1 - Math.abs(sugCals - stats.targetCals) / stats.targetCals) * 100)}%
          </span>
        </div>

        <!-- 4 Suggested Cards Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          ${suggested.map((r, i) => `
            <div class="glass-card rounded-2xl overflow-hidden border border-slate-800 flex flex-col justify-between group hover:border-emerald-500/40 transition">
              <div class="relative h-36 bg-slate-950">
                <img src="${r.image}" alt="" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent"></div>
                <div class="absolute top-2 left-2 flex items-center gap-1">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/90 text-emerald-400 border border-emerald-500/30">
                    Slot ${i + 1}: ${r.category}
                  </span>
                </div>
              </div>
              <div class="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h4 class="font-heading font-bold text-sm text-slate-100 group-hover:text-emerald-400 transition line-clamp-1">${r.title}</h4>
                  <p class="text-[11px] text-slate-400 line-clamp-1">${r.subCategory || r.category}</p>
                </div>
                <div class="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-slate-900/90 text-center text-xs">
                  <div>
                    <span class="text-[10px] text-amber-400 font-bold block">Cals</span>
                    <span class="font-mono font-bold text-amber-300 text-xs">${r.nutrition.calories}</span>
                  </div>
                  <div>
                    <span class="text-[10px] text-emerald-400 font-bold block">Protein</span>
                    <span class="font-mono font-bold text-emerald-300 text-xs">${r.nutrition.protein}g</span>
                  </div>
                </div>
                <button onclick="addToMealPrep(AppState.recipes.find(rec => rec.id === '${r.id}'), 1)" class="w-full py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1">
                  <i data-lucide="plus" class="w-3.5 h-3.5"></i> Add This Meal
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    initLucideIcons();
    return;
  }

  // Active Meal Prep List View
  let dailyCals = 0;
  let dailyPro = 0;
  let dailyCarbs = 0;
  let dailyFat = 0;

  meals.forEach(m => {
    const mult = m.servingsPerDay || 1;
    dailyCals += m.nutrition.calories * mult;
    dailyPro += m.nutrition.protein * mult;
    dailyCarbs += m.nutrition.carbs * mult;
    dailyFat += m.nutrition.fat * mult;
  });

  const calPct = Math.min(Math.round((dailyCals / stats.targetCals) * 100), 125);
  const proPct = Math.min(Math.round((dailyPro / stats.targetPro) * 100), 125);
  const calDiff = dailyCals - stats.targetCals;

  container.innerHTML = `
    <!-- Macro Tracking Dashboard for Meal Prep -->
    <div class="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div class="flex items-center gap-2">
          <i data-lucide="pie-chart" class="w-5 h-5 text-emerald-400"></i>
          <h3 class="font-heading font-extrabold text-lg text-white">Daily Prep Intake vs BMR Target</h3>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="px-3 py-1 rounded-xl font-bold ${Math.abs(calDiff) <= 120 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : calDiff > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}">
            ${Math.abs(calDiff) <= 120 ? '🎯 Perfectly On Target!' : calDiff > 0 ? `+${calDiff} kcal above target` : `${calDiff} kcal remaining`}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
          <div class="flex justify-between items-baseline text-xs">
            <span class="text-amber-400 font-bold uppercase text-[10px]">Daily Calories</span>
            <span class="font-mono text-slate-400">${dailyCals} / ${stats.targetCals}</span>
          </div>
          <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div class="bg-amber-400 h-full transition-all duration-300" style="width: ${calPct}%"></div>
          </div>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
          <div class="flex justify-between items-baseline text-xs">
            <span class="text-emerald-400 font-bold uppercase text-[10px]">Daily Protein (2.2g/kg)</span>
            <span class="font-mono text-slate-400">${Math.round(dailyPro)}g / ${stats.targetPro}g</span>
          </div>
          <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div class="bg-emerald-400 h-full transition-all duration-300" style="width: ${proPct}%"></div>
          </div>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span class="text-blue-400 font-bold uppercase text-[10px] block">Daily Carbs</span>
          <span class="font-heading font-black text-blue-300 text-lg">${Math.round(dailyCarbs)}g</span>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span class="text-rose-400 font-bold uppercase text-[10px] block">Daily Fat</span>
          <span class="font-heading font-black text-rose-300 text-lg">${Math.round(dailyFat)}g</span>
        </div>
      </div>

      <!-- Batch Multiplier Alert -->
      <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-2">
          <i data-lucide="layers" class="w-4 h-4 text-amber-400"></i>
          <span class="text-amber-200">
            <strong>${days}-Day Batch Total:</strong> ${meals.reduce((acc, m) => acc + (m.servingsPerDay || 1) * days, 0)} containers • ${(dailyCals * days).toLocaleString()} total kcal • ${(Math.round(dailyPro * days)).toLocaleString()}g total protein
          </span>
        </div>
        <button onclick="exportMealPrepToShoppingList()" class="text-amber-300 hover:text-white font-bold flex items-center gap-1">
          <i data-lucide="shopping-bag" class="w-3.5 h-3.5"></i> Export ${days}-Day Ingredients →
        </button>
      </div>
    </div>

    <!-- Active Meals in Prep List -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-heading font-bold text-base text-white flex items-center gap-2">
          <i data-lucide="chef-hat" class="w-5 h-5 text-emerald-400"></i>
          Your Saved Meal Prep Items (${meals.length})
        </h3>
        <div class="flex items-center gap-2">
          <button onclick="openMealPrepPickerModal()" class="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition flex items-center gap-1">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Add Another Meal
          </button>
          <button onclick="triggerAutoSuggestPlan()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition flex items-center gap-1">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-400"></i> Auto-Suggest Combo
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${meals.map(item => {
          const s = item.servingsPerDay || 1;
          const totalServings = s * days;
          const batchCals = item.nutrition.calories * totalServings;
          const batchPro = item.nutrition.protein * totalServings;

          return `
            <div class="glass-panel p-4 rounded-2xl border border-slate-800 flex gap-4 relative group hover:border-emerald-500/40 transition">
              <img src="${item.image}" alt="" class="w-24 h-24 rounded-xl object-cover bg-slate-950 flex-shrink-0 cursor-pointer" onclick="openRecipeModal('${item.recipeId}')">

              <div class="flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400">${item.category}</span>
                    <button onclick="removeMealFromPrep('${item.prepId}')" class="text-slate-500 hover:text-rose-400 p-1 transition" title="Remove from meal prep">
                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                  </div>
                  <h4 class="font-heading font-bold text-sm text-white line-clamp-1 cursor-pointer hover:text-emerald-400 transition" onclick="openRecipeModal('${item.recipeId}')">
                    ${item.title}
                  </h4>
                  <div class="text-[11px] text-slate-400 font-mono mt-0.5">
                    1 Serving: ${item.nutrition.calories} kcal • ${item.nutrition.protein}g Protein
                  </div>
                </div>

                <!-- Servings & Batch Multiplier Controls -->
                <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2">
                    <span class="text-slate-400 text-[11px]">Daily:</span>
                    <div class="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                      <button onclick="adjustMealPrepServings('${item.prepId}', -1)" class="px-2 py-0.5 hover:bg-slate-800 text-slate-300">-</button>
                      <span class="px-2.5 py-0.5 font-bold font-mono text-emerald-300">${s}</span>
                      <button onclick="adjustMealPrepServings('${item.prepId}', 1)" class="px-2 py-0.5 hover:bg-slate-800 text-slate-300">+</button>
                    </div>
                  </div>

                  <div class="text-right">
                    <span class="text-[11px] font-bold text-amber-300 block">
                      ${totalServings} containers (${days}d)
                    </span>
                    <span class="text-[10px] text-slate-400 font-mono">
                      ${batchCals.toLocaleString()} kcal | ${batchPro.toFixed(0)}g P
                    </span>
                  </div>
                </div>

              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  initLucideIcons();
}

function renderPlannerView() {
  updateBmrCalculation();
}

// ================= RECIPE PICKER MODAL FOR MEAL PREP =================
let pickerActiveCat = 'All';

function openMealPrepPickerModal() {
  const modal = document.getElementById('meal-prep-picker-modal');
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
  filterPickerRecipes();
  initLucideIcons();
}

function closeMealPrepPickerModal() {
  const modal = document.getElementById('meal-prep-picker-modal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = '';
}

function setPickerCategory(cat) {
  pickerActiveCat = cat;
  document.querySelectorAll('.picker-cat-btn').forEach(btn => {
    if (btn.dataset.pcat === cat) {
      btn.className = "picker-cat-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950";
    } else {
      btn.className = "picker-cat-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-300";
    }
  });
  filterPickerRecipes();
}

function filterPickerRecipes() {
  const container = document.getElementById('picker-results-container');
  if (!container) return;

  const searchInput = document.getElementById('picker-search-input');
  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let list = AppState.recipes;
  if (pickerActiveCat !== 'All') {
    list = list.filter(r => r.category === pickerActiveCat);
  }
  if (q) {
    list = list.filter(r => r.title.toLowerCase().includes(q) || r.ingredients.some(ing => ing.toLowerCase().includes(q)));
  }

  container.innerHTML = list.slice(0, 30).map(r => `
    <div class="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-900/50 p-2 rounded-xl transition">
      <div class="flex items-center gap-3">
        <img src="${r.image}" alt="" class="w-12 h-12 rounded-xl object-cover bg-slate-950 flex-shrink-0">
        <div>
          <h4 class="font-heading font-bold text-sm text-white line-clamp-1">${r.title}</h4>
          <span class="text-xs text-slate-400 font-mono">${r.category} • ${r.nutrition.calories} kcal • ${r.nutrition.protein}g Protein</span>
        </div>
      </div>
      <button onclick="addToMealPrep(AppState.recipes.find(rec => rec.id === '${r.id}'), 1)" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition shadow">
        <i data-lucide="plus" class="w-3.5 h-3.5"></i> Add
      </button>
    </div>
  `).join('');

  initLucideIcons();
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
  const genderEl = document.getElementById('prep-gender');
  const ageEl = document.getElementById('prep-age');
  const heightEl = document.getElementById('prep-height');
  const weightEl = document.getElementById('prep-weight');
  const actEl = document.getElementById('prep-activity');
  const goalEl = document.getElementById('prep-goal');

  if (genderEl && p.gender) genderEl.value = p.gender;
  if (ageEl && p.age) ageEl.value = p.age;
  if (heightEl && p.height) heightEl.value = p.height;
  if (weightEl && p.weight) weightEl.value = p.weight;
  if (actEl && p.activity) actEl.value = p.activity;
  if (goalEl && p.goal) goalEl.value = p.goal;

  const days = AppState.mealPrep.days || 5;
  document.querySelectorAll('.prep-days-pill').forEach(btn => {
    btn.className = "prep-days-pill px-3 py-1.5 rounded-lg text-xs font-bold transition text-slate-400 hover:text-white";
  });
  const activeBtn = document.getElementById(`prep-days-btn-${days}`);
  if (activeBtn) {
    activeBtn.className = "prep-days-pill px-3 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-500 text-slate-950 font-extrabold shadow";
  }

  updateBmrCalculation();
}

function setupPlannerEvents() {
  // Inputs have real-time oninput and onchange handlers calling updateBmrCalculation()
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
