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

let currentPokemonData = null; // Stores data for the Shiny toggle

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

        // --- THE CRITICAL LINES ---
        loader.classList.add('hidden');        // Hide the spinner
        displayArea.classList.remove('hidden'); // Show the result
        // ---------------------------

    } catch (err) {
        loader.classList.add('hidden');
        console.error(err);
    }
});

randomBtn.addEventListener('click', () => {
    // 1. Generate a random ID within the safe 'National Dex' range (1 to 1025)
    // 1025 is Pecharunt, the current final Pokemon.
    const safeRandomId = Math.floor(Math.random() * 1025) + 1;
    
    // 2. Clear current input and set new ID
    input.value = safeRandomId;
    
    // 3. Trigger search
    searchBtn.click();
});
clearBtn.addEventListener('click', () => {
    input.value = "";
    displayArea.classList.add('hidden');
    loader.classList.add('hidden');
    currentPokemonData = null;
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
    console.log("Data arrived for:", data.name);
    const badgeContainer = document.getElementById('typesBadge');
    const pokeImg = document.getElementById('pokeImg');
    const isShiny = shinyToggle.checked;

    // 1. Set Name
    document.getElementById('pokeName').innerText = data.name.toUpperCase();

    // 2. Image Safety Logic (Fallback to default sprites if Artwork is missing)
    const artwork = isShiny 
        ? data.sprites.other['official-artwork']?.front_shiny 
        : data.sprites.other['official-artwork']?.front_default;

    const defaultSprite = isShiny 
        ? data.sprites.front_shiny 
        : data.sprites.front_default;

    // Use artwork if it exists, otherwise use the pixel sprite, otherwise a placeholder
    pokeImg.src = artwork || defaultSprite || 'https://via.placeholder.com/200?text=No+Image+Found';

    // 3. Render Type Badges
    badgeContainer.innerHTML = ""; 
    data.types.forEach(t => {
        const color = typeColors[t.type.name] || '#777';
        badgeContainer.innerHTML += `
            <span class="type-badge" style="background-color: ${color}; display: inline-block; margin: 5px; padding: 5px 15px;">
                ${t.type.name.toUpperCase()}
            </span>`;
    });

    // 4. Add to Team Button
    badgeContainer.innerHTML += `
        <button id="addToTeamBtn" style="background: #2196F3; margin-top: 15px; width: 100%; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold;">
            Add to Team
        </button>`;
    
    // Always re-attach the click event after updating innerHTML
    document.getElementById('addToTeamBtn').onclick = () => saveToTeam(data);

    // 5. Audio Logic with Safety
    if (data.cries && data.cries.latest) {
        const audio = new Audio(data.cries.latest);
        pokeImg.onclick = () => {
            audio.play().catch(e => console.log("Audio play blocked by browser or missing"));
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
            resultsDiv.innerHTML += `<div class="type-badge" style="background-color: ${color}"><span>${type.toUpperCase()}</span><span class="multiplier">${value}x</span></div>`;
        }
    });
}

// --- 4. Team Management ---

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
    teamGrid.innerHTML = "";

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
        teamGrid.appendChild(div);
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
    if (team.length === 0) return warningDiv.innerText = "";

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
    warningDiv.innerHTML = major.length > 0 ? `⚠️ <strong>Weakness:</strong> ${major.join(', ')}` : "✅ Balanced Team!";
}

window.onload = renderTeam;