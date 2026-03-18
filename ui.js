window.typeColors = { 
    normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
    grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
    ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
    rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', steel: '#B7B7CE',
    fairy: '#D685AD'
};

function displayPokemon(data, speciesData) {
    if (!data || !speciesData) return;

    const isShiny = document.getElementById('shinyToggle').checked;
    const primaryType = data.types[0].type.name;
    const typeColor = typeColors[primaryType] || '#777';

    // --- 1. Theme & Atmosphere ---
    document.documentElement.style.setProperty('--type-glow', typeColor);
    document.body.style.backgroundImage = 'none'; 
    document.body.style.backgroundColor = typeColor + '26'; 

    // --- 2. Identity ---
    document.getElementById('pokeName').innerText = data.name.toUpperCase();
    
    const artwork = isShiny 
        ? data.sprites.other['official-artwork']?.front_shiny 
        : data.sprites.other['official-artwork']?.front_default;
    const pokeImg = document.getElementById('pokeImg');
    pokeImg.src = artwork || data.sprites.front_default;

    // Cry Logic
    if (data.cries && data.cries.latest) {
        const audio = new Audio(data.cries.latest);
        pokeImg.onclick = () => {
            audio.play().catch(() => {});
            pokeImg.style.transform = "scale(1.1)";
            setTimeout(() => { pokeImg.style.transform = "scale(1)"; }, 100);
        };
    }

    // --- 3. Data Calculations ---
    const entries = speciesData.flavor_text_entries.filter(e => e.language.name === 'en');
    const loreHTML = entries.length > 0 
        ? entries.map(e => `<p style="margin-bottom: 10px; font-style: italic;">${e.flavor_text.replace(/[\f\n\r\t\v]/g, ' ')}</p>`).join('')
        : "No data.";
    
    // Stats Logic
    let totalStats = 0;
    let statsHTML = `<div class="analysis-section stats-container"><h3>Base Stats</h3>`;
    data.stats.forEach(s => {
        const statName = s.stat.name.replace('special-', 'S.').toUpperCase();
        const statValue = s.base_stat;
        totalStats += statValue;
        const percent = Math.min((statValue / 200) * 100, 100); 
        statsHTML += `
            <div class="stat-row">
                <span class="stat-label">${statName}</span>
                <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width: ${percent}%"></div>
                </div>
                <span class="stat-value">${statValue}</span>
            </div>`;
    });
    statsHTML += `<p style="font-size: 0.7rem; color: #888; margin-top: 10px; text-align: right;">TOTAL BST: <b>${totalStats}</b></p></div>`;

    // --- 4. Moveset Logic (Dynamic Learning Methods) ---
    let movesHTML = `
        <div class="analysis-section">
            <h3>Tactical Moveset</h3>
            <div class="moves-grid" id="movesContainer">`;
    
    // Take the first 4 moves and determine how they are learned
    data.moves.slice(0, 4).forEach(m => {
        const method = m.version_group_details[0].move_learn_method.name.replace('-', ' ').toUpperCase();
        movesHTML += `
            <div class="move-card">
                <span class="move-name">${m.move.name.replace('-', ' ')}</span>
                <span class="move-type-tag" style="background: ${method === 'LEVEL UP' ? 'var(--type-glow)' : '#555'}">
                    ${method}
                </span>
            </div>`;
    });
    movesHTML += `</div></div>`;

    // --- 5. Inject Everything into Data Panel ---
    const dataPanel = document.querySelector('.data-panel');
    dataPanel.innerHTML = `
        ${statsHTML}
        ${movesHTML}
        <div id="weaknessResults" class="analysis-section"><h3>Weakness Analysis</h3></div>
        <div id="strengthResults" class="analysis-section"><h3>Offensive Coverage</h3></div>
        <div class="analysis-section lore-box">
            <h3>Subject Description</h3>
            <div id="pokeLore">${loreHTML}</div>
        </div>
        <div id="evolutionChain" class="analysis-section"></div>
    `;

    // --- 6. Type Badges ---
    const badgeContainer = document.getElementById('typesBadge');
    badgeContainer.innerHTML = "";
    data.types.forEach(t => {
        badgeContainer.innerHTML += `<span class="type-badge" style="background:${typeColors[t.type.name]}">${t.type.name.toUpperCase()}</span>`;
    });

    // --- 7. Add to Team Button ---
    const existingBtn = document.getElementById('addToTeamBtn');
    if (existingBtn) existingBtn.remove();
    const addBtn = document.createElement('button');
    addBtn.id = 'addToTeamBtn';
    addBtn.innerHTML = 'ADD TO TEAM';
    addBtn.onclick = () => {
        window.playSound(900, 0.2); // Beep for add to team
        saveToTeam(data);
    };
    const shinyContainer = document.querySelector('.shiny-toggle-container');
    shinyContainer.insertAdjacentElement('afterend', addBtn);

    // --- 8. Share Button Logic ---
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.onclick = () => {
            window.playSound(1100, 0.1); // Beep for share
            const currentUrl = window.location.href.split('?')[0];
            const shareUrl = `${currentUrl}?pokemon=${data.name}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                const originalText = shareBtn.innerText;
                shareBtn.innerText = "COPIED ✅";
                shareBtn.style.color = "#4caf50";
                setTimeout(() => {
                    shareBtn.innerText = originalText;
                    shareBtn.style.color = "#ffcb05";
                }, 2000);
            });
        };
    }

    // --- 9. Close Button Logic ---
    const closeBtn = document.getElementById('closeBtn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            window.playSound(400, 0.2); // Beep for close
            document.getElementById('pokeName').innerText = "---";
            document.getElementById('typesBadge').innerHTML = "";
            document.getElementById('pokeImg').src = "";
            
            // Remove the add to team button if it exists
            const addToTeamBtn = document.getElementById('addToTeamBtn');
            if (addToTeamBtn) {
                addToTeamBtn.remove();
            }
            
            const dataPanel = document.querySelector('.data-panel');
            dataPanel.innerHTML = `
                <div class="analysis-section lore-box">
                    <h3>Subject Description</h3>
                    <p id="pokeLore">Please initiate a scan...</p>
                </div>
                
                <div id="statsContainer" class="analysis-section">
                    <h3>Base Stats</h3>
                    <div class="stats-bars"></div>
                </div>

                <div id="weaknessResults"></div>
            `;
            document.getElementById('shinyToggle').checked = false;
            document.body.style.backgroundColor = '';
            document.documentElement.style.setProperty('--type-glow', '');
        };
    }
}