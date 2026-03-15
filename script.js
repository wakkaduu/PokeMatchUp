// --- 1. DOM Elements & Global State ---
const input = document.getElementById('pokeInput');
const searchBtn = document.getElementById('searchBtn');
const randomBtn = document.getElementById('randomBtn');
const clearBtn = document.getElementById('clearBtn');
const loader = document.getElementById('loading');
const displayArea = document.getElementById('displayArea');
const teamGrid = document.getElementById('teamGrid');
const clearTeamBtn = document.getElementById('clearTeamBtn');
const shinyToggle = document.getElementById('shinyToggle');

let currentPokemonData = null;

const typeColors = {
    normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
    grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
    ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
    rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', steel: '#B7B7CE',
    fairy: '#D685AD'
};

// --- 2. Event Listeners ---

searchBtn.addEventListener('click', async () => {
    const name = input.value.toLowerCase().trim();
    if (!name) return;

    loader.classList.remove('hidden');
    displayArea.classList.add('hidden');

    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
        if (!response.ok) throw new Error("Not found");
        const data = await response.json();
        
        currentPokemonData = data;
        displayPokemon(data);
        await calculateWeaknesses(data.types);
        
        displayArea.classList.remove('hidden');
    } catch (err) {
        alert("Pokémon not found! Check your spelling.");
        console.error("Search Error:", err);
    } finally {
        loader.classList.add('hidden');
    }
});

randomBtn.addEventListener('click', () => {
    input.value = Math.floor(Math.random() * 1025) + 1;
    searchBtn.click();
});

clearBtn.addEventListener('click', () => {
    input.value = "";
    displayArea.classList.add('hidden');
    loader.classList.add('hidden');
    currentPokemonData = null;
    document.documentElement.style.setProperty('--type-glow', 'rgba(255, 255, 255, 0.1)');
});

shinyToggle.addEventListener('change', () => {
    if (currentPokemonData) displayPokemon(currentPokemonData);
});

clearTeamBtn.onclick = () => {
    localStorage.removeItem('myPokeTeam');
    renderTeam();
};

// --- 3. Core Functions ---

function displayPokemon(data) {
    const badgeContainer = document.getElementById('typesBadge');
    const pokeImg = document.getElementById('pokeImg');
    const nameDisplay = document.getElementById('pokeName');
    const isShiny = shinyToggle.checked;

    if (nameDisplay) nameDisplay.innerText = data.name.toUpperCase();

    // Dynamic Theme Glow Logic
    const primaryType = data.types[0].type.name;
    const typeColor = typeColors[primaryType] || '#777';
    document.documentElement.style.setProperty('--type-glow', typeColor + '66');

    // Image Logic
    const artwork = isShiny 
        ? data.sprites.other['official-artwork']?.front_shiny 
        : data.sprites.other['official-artwork']?.front_default;
    pokeImg.src = artwork || data.sprites.front_default || 'https://via.placeholder.com/200';

    // Badges
    badgeContainer.innerHTML = ""; 
    data.types.forEach(t => {
        const color = typeColors[t.type.name] || '#777';
        badgeContainer.innerHTML += `
            <span class="type-badge" style="background-color: ${color}; display: inline-block; margin: 5px; padding: 5px 15px; border-radius: 20px; font-weight: bold; font-size: 0.8rem;">
                ${t.type.name.toUpperCase()}
            </span>`;
    });

    // Add To Team Button (Styled with ID for CSS matching)
    badgeContainer.innerHTML += `
        <button id="addToTeamBtn">
            Add to Team
        </button>`;
    
    document.getElementById('addToTeamBtn').onclick = () => saveToTeam(data);

    // Share Button Logic
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.onclick = () => {
            const url = `${window.location.origin}${window.location.pathname}?pokemon=${data.name}`;
            navigator.clipboard.writeText(url).then(() => {
                shareBtn.innerText = "✅";
                setTimeout(() => { shareBtn.innerText = "🔗"; }, 2000);
            });
        };
    }

    // Audio Logic
    if (data.cries && data.cries.latest) {
        const audio = new Audio(data.cries.latest);
        pokeImg.onclick = () => {
            audio.play().catch(() => {});
            pokeImg.style.animation = "none";
            setTimeout(() => { pokeImg.style.animation = "bounce 0.5s ease"; }, 10);
        };
    }
}

async function calculateWeaknesses(types) {
    let multipliers = {};
    for (const t of types) {
        const typeRes = await fetch(t.type.url);
        const typeData = await typeRes.json();
        typeData.damage_relations.double_damage_from.forEach(d => multipliers[d.name] = (multipliers[d.name] || 1) * 2);
        typeData.damage_relations.half_damage_from.forEach(d => multipliers[d.name] = (multipliers[d.name] || 1) * 0.5);
        typeData.damage_relations.no_damage_from.forEach(d => multipliers[d.name] = 0);
    }
    renderWeaknessBadges(multipliers);
}

function renderWeaknessBadges(multipliers) {
    const resultsDiv = document.getElementById('weaknessResults');
    resultsDiv.innerHTML = ""; 
    Object.entries(multipliers).sort((a, b) => b[1] - a[1]).forEach(([type, value]) => {
        if (value > 1) {
            const color = typeColors[type] || '#777';
            resultsDiv.innerHTML += `
                <div class="type-badge" style="background-color: ${color}; display: flex; justify-content: space-between; padding: 8px 15px; border-radius: 12px; margin: 5px 0;">
                    <span>${type.toUpperCase()}</span>
                    <span style="background: rgba(0,0,0,0.2); padding: 0 8px; border-radius: 5px;">${value}x</span>
                </div>`;
        }
    });
}

function saveToTeam(data) {
    let team = JSON.parse(localStorage.getItem('myPokeTeam')) || [];
    if (team.length >= 6) return alert("Team full!");
    if (team.some(m => m.name === data.name)) return alert("Already in team!");
    team.push({ name: data.name, sprite: data.sprites.front_default });
    localStorage.setItem('myPokeTeam', JSON.stringify(team));
    renderTeam();
}

function renderTeam() {
    const team = JSON.parse(localStorage.getItem('myPokeTeam')) || [];
    const grid = document.getElementById('teamGrid');
    if (!grid) return;
    grid.innerHTML = "";
    team.forEach((member, index) => {
        const div = document.createElement('div');
        div.className = 'team-member';
        div.innerHTML = `
            <span class="remove-btn" onclick="removeFromTeam(${index})">×</span>
            <img src="${member.sprite}" alt="${member.name}" style="cursor:pointer">
            <p>${member.name.toUpperCase()}</p>`;
        div.querySelector('img').onclick = () => {
            input.value = member.name;
            searchBtn.click();
        };
        grid.appendChild(div);
    });
    analyzeTeamCoverage(team);
}

function removeFromTeam(index) {
    let team = JSON.parse(localStorage.getItem('myPokeTeam')) || [];
    team.splice(index, 1);
    localStorage.setItem('myPokeTeam', JSON.stringify(team));
    renderTeam();
}

async function analyzeTeamCoverage(team) {
    const warningDiv = document.getElementById('coverageWarning');
    if (!warningDiv) return;
    if (team.length === 0) { warningDiv.innerText = ""; return; }
    let threats = {};
    for (const member of team) {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${member.name}`);
        const data = await res.json();
        for (const t of data.types) {
            const typeRes = await fetch(t.type.url);
            const typeData = await typeRes.json();
            typeData.damage_relations.double_damage_from.forEach(d => threats[d.name] = (threats[d.name] || 0) + 1);
        }
    }
    const major = Object.entries(threats).filter(([_, c]) => c >= 3).map(([t]) => t.toUpperCase());
    warningDiv.innerHTML = major.length > 0 ? `⚠️ <strong>Weakness:</strong> ${major.join(', ')}` : "✅ Balanced!";
}

window.onload = () => {
    renderTeam();
    const params = new URLSearchParams(window.location.search);
    const pokeName = params.get('pokemon');
    if (pokeName) {
        input.value = pokeName;
        searchBtn.click();
    }
};