let currentPokemonData = null;
let currentSpeciesData = null;

const searchBtn = document.getElementById('searchBtn');
const pokeInput = document.getElementById('pokeInput');

document.getElementById('enterBtn').addEventListener('click', () => {
    playSound(800, 0.2); // High beep for enter
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
});

function goHome() {
    playSound(600, 0.2); // Lower beep for home
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('homePage').style.display = 'flex';
}

function playSound(frequency, duration) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

window.playSound = playSound;

pokeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        searchBtn.click();
    }
});

searchBtn.addEventListener('click', async () => {
    playSound(1000, 0.1); // Beep for search
    const name = pokeInput.value.toLowerCase().trim();
    if (!name) return;

    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('displayArea').classList.add('hidden');

    try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
        if (!res.ok) throw new Error("404");
        const data = await res.json();
        
        const speciesRes = await fetch(data.species.url);
        const speciesData = await speciesRes.json();
        
        currentPokemonData = data;
        currentSpeciesData = speciesData;
        
        // 1. Render UI Shell (Creates the IDs strengthResults and weaknessResults)
        displayPokemon(data, speciesData);
        
        // 2. Run Data Analysis (Wait for these to finish!)
        await calculateWeaknesses(data.types);
        await calculateStrengths(data.types);
        await getEvolutionChain(speciesData);
        
        document.getElementById('displayArea').classList.remove('hidden');
    } catch (err) {
        console.error("CRASH REPORT:", err);
        document.getElementById('displayArea').innerHTML = '<div style="text-align: center; color: #ff4444; font-size: 1.2rem; padding: 20px;">Specimen not found in database.</div>';
        document.getElementById('displayArea').classList.remove('hidden');
    } finally {
        document.getElementById('loading').classList.add('hidden');
    }
});

// --- Offensive & Defensive Math ---

async function calculateWeaknesses(types) {
    let multipliers = {};
    for (const t of types) {
        const typeRes = await fetch(t.type.url);
        const typeData = await typeRes.json();
        
        typeData.damage_relations.double_damage_from.forEach(d => multipliers[d.name] = (multipliers[d.name] || 1) * 2);
        typeData.damage_relations.half_damage_from.forEach(d => multipliers[d.name] = (multipliers[d.name] || 1) * 0.5);
        typeData.damage_relations.no_damage_from.forEach(d => multipliers[d.name] = 0);
    }
    renderBadges('weaknessResults', multipliers, true);
}

async function calculateStrengths(types) {
    let strengths = new Set();
    for (const t of types) {
        const typeRes = await fetch(t.type.url);
        const typeData = await typeRes.json();
        typeData.damage_relations.double_damage_to.forEach(d => strengths.add(d.name));
    }
    renderBadges('strengthResults', Array.from(strengths), false);
}

// Optimized single function for rendering badges
function renderBadges(targetId, data, isWeakness) {
    const resultsDiv = document.getElementById(targetId);
    if (!resultsDiv) return;

    resultsDiv.innerHTML = `<h3>${isWeakness ? 'Weakness Analysis' : 'Offensive Coverage'}</h3>`; 
    const badgeWrapper = document.createElement('div');
    badgeWrapper.style.cssText = "display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;";

    if (isWeakness) {
        Object.entries(data).sort((a, b) => b[1] - a[1]).forEach(([type, val]) => {
            if (val > 1) badgeWrapper.innerHTML += createBadge(type, `${val}x`);
        });
    } else {
        data.forEach(type => badgeWrapper.innerHTML += createBadge(type, 'VS'));
    }

    resultsDiv.appendChild(badgeWrapper);
}

function createBadge(type, label) {
    const color = window.typeColors ? window.typeColors[type] : '#777';
    return `<span style="background:${color}; color:white; padding:4px 10px; border-radius:4px; font-size:0.7rem; font-weight:bold; border:1px solid rgba(255,255,255,0.1);">
        ${label} ${type.toUpperCase()}
    </span>`;
}

// --- Evolution Logic ---

async function getEvolutionChain(speciesData) {
    try {
        const evoRes = await fetch(speciesData.evolution_chain.url);
        const evoData = await evoRes.json();
        let chain = [];
        
        function collectEvolutions(step) {
            const id = step.species.url.split('/').filter(Boolean).pop();
            chain.push({ name: step.species.name, sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png` });
            step.evolves_to.forEach(nextStep => collectEvolutions(nextStep));
        }
        
        collectEvolutions(evoData.chain);
        renderEvolutionChain(chain);
    } catch (e) { console.error(e); }
}

function renderEvolutionChain(chain) {
    const evoDiv = document.getElementById('evolutionChain');
    if (!evoDiv) return;
    if (chain.length <= 1) {
        evoDiv.innerHTML = `<h3>Evolution Path</h3><p style="font-size:0.7rem; color:#666; text-align:center;">No evolutionary stages.</p>`;
        return;
    }
    evoDiv.innerHTML = `<h3>Evolution Path</h3><div class="evo-container" style="display:flex; flex-wrap:wrap; justify-content:center; gap:15px; padding:20px; background:rgba(255,255,255,0.03); border-radius:12px;"></div>`;
    const container = evoDiv.querySelector('.evo-container');
    chain.forEach(step => {
        container.innerHTML += `<div class="evo-step" onclick="searchFor('${step.name}')" style="text-align:center; cursor:pointer; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; transition:all 0.3s;"><img src="${step.sprite}" style="width:60px;"><p style="font-size:0.7rem; color:#ccc; margin-top:5px;">${step.name.toUpperCase()}</p></div>`;
    });
}

// --- Helper Global Functions ---

function searchFor(name) {
    pokeInput.value = name;
    searchBtn.click();
}

document.getElementById('randomBtn').onclick = () => {
    playSound(1200, 0.15); // Higher beep for random
    pokeInput.value = Math.floor(Math.random() * 1025) + 1;
    searchBtn.click();
};

document.getElementById('pokedexBtn').onclick = () => {
    playSound(1400, 0.2); // Beep for pokedex
    openPokedex();
};

document.getElementById('shinyToggle').onchange = async () => {
    window.playSound(1300, 0.1); // Beep for shiny toggle
    if (currentPokemonData && currentSpeciesData) {
        displayPokemon(currentPokemonData, currentSpeciesData);
        await calculateWeaknesses(currentPokemonData.types);
        await calculateStrengths(currentPokemonData.types);
        await getEvolutionChain(currentSpeciesData);
    }
};

// --- Pokedex Functions ---

let pokedexCache = null;
let isLoadingPokedex = false;

async function openPokedex() {
    if (isLoadingPokedex) return; // Prevent multiple simultaneous loads
    
    const modal = document.getElementById('pokedexModal');
    const container = document.getElementById('pokedexContainer');
    const searchInput = document.getElementById('pokedexSearch');
    
    modal.classList.remove('hidden');
    modal.style.display = 'block';
    
    // Use cached data if available
    if (pokedexCache) {
        displayPokedex(pokedexCache, searchInput);
        return;
    }
    
    container.innerHTML = '<div style="text-align: center; padding: 50px;"><div class="spinner"></div><p>Loading Pokedex... (0/1010)</p></div>';
    isLoadingPokedex = true;
    
    try {
        // Load in batches of 100 for better performance
        const batchSize = 100;
        const totalPokemon = 1010;
        let allPokemon = [];
        
        for (let offset = 0; offset < totalPokemon; offset += batchSize) {
            const limit = Math.min(batchSize, totalPokemon - offset);
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`);
            const data = await res.json();
            allPokemon = allPokemon.concat(data.results);
            
            // Update loading progress
            const loaded = Math.min(offset + batchSize, totalPokemon);
            container.innerHTML = `<div style="text-align: center; padding: 50px;"><div class="spinner"></div><p>Loading Pokedex... (${loaded}/${totalPokemon})</p></div>`;
        }
        
        // Process all Pokemon data
        pokedexCache = allPokemon.map(poke => {
            const id = poke.url.split('/').filter(Boolean).pop();
            return {
                name: poke.name,
                id: id,
                sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
            };
        });
        
        displayPokedex(pokedexCache, searchInput);
        
    } catch (err) {
        container.innerHTML = '<div style="text-align: center; color: #ff4444; padding: 50px;">Failed to load Pokedex.</div>';
    } finally {
        isLoadingPokedex = false;
    }
}

function displayPokedex(pokemonData, searchInput) {
    const container = document.getElementById('pokedexContainer');
    
    let allItems = pokemonData.map(poke => {
        const item = document.createElement('div');
        item.className = 'pokedex-item';
        item.innerHTML = `
            <div class="pokedex-id">#${poke.id.padStart(3, '0')}</div>
            <img src="${poke.sprite}" alt="${poke.name}" loading="lazy">
            <div class="pokedex-name">${poke.name}</div>
        `;
        item.onclick = () => {
            closePokedex();
            pokeInput.value = poke.name;
            searchBtn.click();
        };
        return { element: item, name: poke.name, id: poke.id };
    });

    // Function to filter and display
    const filterPokedex = () => {
        const query = searchInput.value.toLowerCase();
        container.innerHTML = '';
        const filtered = allItems.filter(p => p.name.includes(query) || p.id.includes(query));
        filtered.forEach(p => container.appendChild(p.element));
    };

    // Initial display
    filterPokedex();

    // Add search listener
    searchInput.oninput = filterPokedex;
}

function closePokedex() {
    const modal = document.getElementById('pokedexModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

window.onload = () => {
    const params = new URLSearchParams(window.location.search);
    const pokeName = params.get('pokemon');
    const teamData = params.get('team');
    
    if (teamData) {
        try {
            const decodedTeam = JSON.parse(atob(teamData));
            if (decodedTeam.team && Array.isArray(decodedTeam.team)) {
                localStorage.setItem('myPokeTeam', JSON.stringify(decodedTeam.team));
                renderTeam();
                alert("Team loaded successfully!");
            }
        } catch (e) {
            console.error("Failed to load shared team:", e);
            alert("Invalid team data in URL.");
        }
    }
    
    if (pokeName) {
        document.getElementById('homePage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        pokeInput.value = pokeName;
        searchBtn.click();
    }
    renderTeam();
};

window.searchFor = (name) => {
    pokeInput.value = name;
    searchBtn.click();
};