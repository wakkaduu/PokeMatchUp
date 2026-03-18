const typeColors = {
    normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
    grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
    ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
    rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', steel: '#B7B7CE',
    fairy: '#D685AD'
};

// ONLY ONE SELECTION BUFFER
let selectionBuffer = [];
let escListener = null;

function saveToTeam(data) {
    let team = JSON.parse(localStorage.getItem('myPokeTeam')) || [];
    if (team.length >= 6) return alert("Team is full (max 6 Pokemon).");
    if (team.some(m => m.name === data.name)) return alert("Pokemon already on team.");
    
    team.push({ 
        name: data.name, 
        sprite: data.sprites.front_default,
        types: data.types,
        stats: data.stats 
    });
    
    localStorage.setItem('myPokeTeam', JSON.stringify(team));
    renderTeam();
}

async function renderTeam() {
    const team = JSON.parse(localStorage.getItem('myPokeTeam')) || [];
    const grid = document.getElementById('teamGrid');
    if (!grid) return;
    grid.innerHTML = "";
    
    team.forEach((member, index) => {
        const isSelected = selectionBuffer.some(p => p.name === member.name);
        const div = document.createElement('div');
        div.className = 'team-member';
        div.innerHTML = `
            <span class="remove-btn" onclick="removeFromTeam(${index})">×</span>
            <img src="${member.sprite}" alt="${member.name}" style="cursor:pointer">
            <p>${member.name.toUpperCase()}</p>
            <button class="select-btn" onclick="toggleSelection(${index})">${isSelected ? 'SELECTED' : 'SELECT'}</button>
        `;
        
        div.querySelector('img').onclick = () => {
            document.getElementById('pokeInput').value = member.name;
            document.getElementById('searchBtn').click();
        };
        grid.appendChild(div);
    });

    await calculateTeamCoverage();
}

function toggleSelection(index) {
    const team = JSON.parse(localStorage.getItem('myPokeTeam')) || [];
    const member = team[index];
    const isSelected = selectionBuffer.some(p => p.name === member.name);
    if (isSelected) {
        selectionBuffer = selectionBuffer.filter(p => p.name !== member.name);
    } else {
        if (selectionBuffer.length < 2) {
            selectionBuffer.push(member);
        } else {
            alert("Maximum 2 Pokemon for comparison.");
        }
    }
    renderTeam();
}

function removeFromTeam(index) {
    window.playSound(400, 0.3); // Low beep for remove
    let team = JSON.parse(localStorage.getItem('myPokeTeam')) || [];
    const removedName = team[index].name;
    selectionBuffer = selectionBuffer.filter(p => p.name !== removedName);
    
    team.splice(index, 1);
    localStorage.setItem('myPokeTeam', JSON.stringify(team));
    renderTeam();
}

async function calculateTeamCoverage() {
    const team = JSON.parse(localStorage.getItem('myPokeTeam')) || [];
    const coverageDiv = document.getElementById('teamCoverage');
    if (!coverageDiv) return;
    
    if (team.length === 0) {
        coverageDiv.innerHTML = "";
        return;
    }

    let teamWeaknesses = {};
    for (const member of team) {
        if (!member.types) continue;
        for (const t of member.types) {
            try {
                const res = await fetch(t.type.url);
                const typeData = await res.json();
                typeData.damage_relations.double_damage_from.forEach(type => {
                    teamWeaknesses[type.name] = (teamWeaknesses[type.name] || 0) + 1;
                });
            } catch (e) { console.error(e); }
        }
    }

    let hasSeriousWeakness = false;
    let html = `<h4>⚠️ Team Vulnerabilities</h4>`;

    Object.entries(teamWeaknesses)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
            if (count >= 2) {
                hasSeriousWeakness = true;
                const color = typeColors[type] || '#777';
                html += `
                    <div class="coverage-item" style="border-left: 3px solid ${color};">
                        <span>${type.toUpperCase()}</span>
                        <b>${count}x Weak</b>
                    </div>`;
            }
        });

    coverageDiv.innerHTML = hasSeriousWeakness 
        ? html 
        : `<div class="coverage-status-ok"><span>✅</span> STABLE COVERAGE</div>`;
}

async function fetchTypeRelations(type) {
    try {
        const response = await fetch(type.type.url);
        return await response.json();
    } catch (error) {
        console.error('Type fetch error', type, error);
        return null;
    }
}

async function calculateTypeAdvantage(attacker, defender) {
    let score = 0;
    for (const atkType of attacker.types) {
        const typeData = await fetchTypeRelations(atkType);
        if (!typeData) continue;
        const strong = typeData.damage_relations.double_damage_to.map(t => t.name);
        const weak = typeData.damage_relations.half_damage_to.map(t => t.name)
            .concat(typeData.damage_relations.no_damage_to.map(t => t.name));

        for (const defType of defender.types) {
            if (strong.includes(defType.type.name)) score += 1;
            if (weak.includes(defType.type.name)) score -= 0.5;
        }
    }
    return score;
}

function getWaysToWin(pokemon) {
    const types = pokemon.types.map(t => t.type.name);
    const strategy = [];

    if (types.includes('fire')) strategy.push('carry Water-type coverage and use status to reduce accuracy.');
    if (types.includes('water')) strategy.push('use Electric/Ice counters while keeping HP high with potions.');
    if (types.includes('grass')) strategy.push('keep a Fire-type shield ready and heal status conditions quickly.');
    if (types.includes('electric')) strategy.push('avoid Ground attacks; use battery-style boosting and quick strikes.');
    if (types.includes('ice')) strategy.push('protect against Fighting and Rock, and use potions for survivability.');
    if (types.includes('dragon')) strategy.push('use Ice/Dragon moves, and keep HP topped via full restores.');

    if (pokemon.stats.find(s => s.stat.name === 'speed')?.base_stat > 90) strategy.push('leverage speed advantage with priority moves and hit-and-run.');
    if (pokemon.stats.find(s => s.stat.name === 'hp')?.base_stat > 90) strategy.push('tank hits and heal with potions on critical health.');
    if (strategy.length === 0) strategy.push('keep HP healthy with regular potions and adapt moves in battle.');

    return strategy;
}

async function buildPrediction(p1, p2) {
    const p1BST = p1.stats.reduce((sum, s) => sum + (s.base_stat || 0), 0);
    const p2BST = p2.stats.reduce((sum, s) => sum + (s.base_stat || 0), 0);
    const bstDiff = p1BST - p2BST;

    const typeAdv1 = await calculateTypeAdvantage(p1, p2);
    const typeAdv2 = await calculateTypeAdvantage(p2, p1);
    const typeDiff = typeAdv1 - typeAdv2;

    let predictedWinner;
    let confidence = 50;

    if (bstDiff > 30) {
        predictedWinner = p1;
        confidence += 20;
    } else if (bstDiff < -30) {
        predictedWinner = p2;
        confidence += 20;
    }

    if (typeDiff > 1) {
        predictedWinner = p1;
        confidence += 15;
    } else if (typeDiff < -1) {
        predictedWinner = p2;
        confidence += 15;
    }

    if (!predictedWinner) {
        if (bstDiff > 0) predictedWinner = p1;
        else if (bstDiff < 0) predictedWinner = p2;
        else predictedWinner = null;
        confidence += 10;
    }

    const strategy1 = getWaysToWin(p1);
    const strategy2 = getWaysToWin(p2);

    if (!predictedWinner) {
        return `
            <div class="match-prediction">💡 Prediction: Tie game (balanced matchup) — confidence ${confidence}%</div>
            <div class="win-ways">
                <h4>🔧 ${p1.name.toUpperCase()} strategy</h4><ul>${strategy1.map(s => `<li>${s}</li>`).join('')}</ul>
                <h4>🔧 ${p2.name.toUpperCase()} strategy</h4><ul>${strategy2.map(s => `<li>${s}</li>`).join('')}</ul>
            </div>`;
    }

    const strongReason = Math.abs(bstDiff) >= 30 ? 'Base stats edge' : 'Type matchup edge';
    const runnerUp = predictedWinner === p1 ? p2 : p1;
    return `
        <div class="match-prediction">💡 Prediction: <strong>${predictedWinner.name.toUpperCase()}</strong> likely wins vs ${runnerUp.name.toUpperCase()} — confidence ${Math.min(confidence, 90)}%</div>
        <div class="win-ways">
            <h4>🔧 ${p1.name.toUpperCase()} strategy</h4><ul>${strategy1.map(s => `<li>${s}</li>`).join('')}</ul>
            <h4>🔧 ${p2.name.toUpperCase()} strategy</h4><ul>${strategy2.map(s => `<li>${s}</li>`).join('')}</ul>
        </div>`;
}

// Trigger selection logic
function toggleCompareMode(index) {
    // Old function, replaced by team selection
}

async function openCompareModal() {
    window.playSound(1500, 0.2); // High beep for arena
    console.log("Buffer content:", selectionBuffer); // DIAGNOSTIC 1
    
    const modal = document.getElementById('compareModal');
    const vsContainer = document.querySelector('.vs-container');
    
    if (!vsContainer) {
        alert("CRITICAL: vs-container NOT FOUND in HTML!");
        return;
    }

    const p1 = selectionBuffer[0];
    const p2 = selectionBuffer[1];

    // Build the HTML string
    let statsHTML = '<div class="stats-comparison"><h4>Base Stats Comparison</h4>';
    const statNames = ['HP', 'Attack', 'Defense', 'Sp. Attack', 'Sp. Defense', 'Speed'];
    let p1Total = 0, p2Total = 0;
    statNames.forEach((name, i) => {
        const p1Stat = p1.stats[i]?.base_stat || 0;
        const p2Stat = p2.stats[i]?.base_stat || 0;
        p1Total += p1Stat;
        p2Total += p2Stat;
        const maxStat = Math.max(p1Stat, p2Stat, 200); // Cap at 200 for scaling
        const p1Percent = (p1Stat / maxStat) * 100;
        const p2Percent = (p2Stat / maxStat) * 100;
        const diff = p1Stat - p2Stat;
        const winner = diff > 0 ? 'left' : diff < 0 ? 'right' : 'tie';
        statsHTML += `
            <div class="stat-compare-row">
                <span class="stat-name">${name}</span>
                <div class="stat-bar-container">
                    <div class="stat-bar left-bar" style="width: ${p1Percent}%"></div>
                    <div class="stat-bar right-bar" style="width: ${p2Percent}%"></div>
                </div>
                <div class="stat-values">
                    <span class="stat-val left-val ${winner === 'left' ? 'winner' : ''}">${p1Stat}</span>
                    <span class="vs">vs</span>
                    <span class="stat-val right-val ${winner === 'right' ? 'winner' : ''}">${p2Stat}</span>
                </div>
            </div>`;
    });
    const totalWinner = p1Total > p2Total ? 'left' : p1Total < p2Total ? 'right' : 'tie';
    const maxTotal = Math.max(p1Total, p2Total, 600);
    statsHTML += `
        <div class="stat-compare-row total-row">
            <span class="stat-name">TOTAL BST</span>
            <div class="stat-bar-container">
                <div class="stat-bar left-bar" style="width: ${(p1Total / maxTotal) * 100}%"></div>
                <div class="stat-bar right-bar" style="width: ${(p2Total / maxTotal) * 100}%"></div>
            </div>
            <div class="stat-values">
                <span class="stat-val left-val ${totalWinner === 'left' ? 'winner' : ''}">${p1Total}</span>
                <span class="vs">vs</span>
                <span class="stat-val right-val ${totalWinner === 'right' ? 'winner' : ''}">${p2Total}</span>
            </div>
        </div>`;
    statsHTML += '</div>';

    const predictionHTML = await buildPrediction(p1, p2);

    const arenaHTML = `
        <div class="compare-card left-fighter">
            <img src="${p1.sprite}" class="fighter-img">
            <h3>${p1.name.toUpperCase()}</h3>
            <div class="fighter-types">${p1.types.map(t => `<span class="type-badge" style="background:${typeColors[t.type.name]}">${t.type.name.toUpperCase()}</span>`).join('')}</div>
        </div>
        <div class="battle-stats-overlay">
            <div class="stats-header">ARENA DATA</div>
            ${statsHTML}
        </div>
        <div class="compare-card right-fighter">
            <img src="${p2.sprite}" class="fighter-img">
            <h3>${p2.name.toUpperCase()}</h3>
            <div class="fighter-types">${p2.types.map(t => `<span class="type-badge" style="background:${typeColors[t.type.name]}">${t.type.name.toUpperCase()}</span>`).join('')}</div>
        </div>
    `;

    // INJECT THE DATA
    vsContainer.innerHTML = `
        <div class="arena-grid">${arenaHTML}</div>
        <div class="prediction-panel">${predictionHTML}</div>
    `;
    console.log("HTML Injected into vs-container"); // DIAGNOSTIC 2

    // Add ESC key listener
    escListener = (e) => { if (e.key === 'Escape') closeCompare(); };
    document.addEventListener('keydown', escListener);

    // SHOW MODAL
    modal.classList.remove('hidden');
    modal.style.display = 'block';
}
function closeCompare() {
    window.playSound(500, 0.2); // Medium beep for close
    const modal = document.getElementById('compareModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    // Remove ESC listener
    if (escListener) {
        document.removeEventListener('keydown', escListener);
        escListener = null;
    }
}

// Clear Button
document.getElementById('clearTeamBtn').onclick = () => {
    window.playSound(300, 0.5); // Very low beep for clear
    localStorage.removeItem('myPokeTeam');
    selectionBuffer = [];
    renderTeam();
};

// Compare Button
document.getElementById('compareBtn').onclick = () => {
    if (selectionBuffer.length === 2) {
        openCompareModal();
    } else {
        alert("Select 2 Pokemon to compare.");
    }
};

// Share Team Button
document.getElementById('shareTeamBtn').onclick = () => {
    shareTeam();
};

function shareTeam() {
    const team = JSON.parse(localStorage.getItem('myPokeTeam')) || [];
    if (team.length === 0) {
        alert("No team to share! Add some Pokemon first.");
        return;
    }

    const teamData = {
        team: team,
        timestamp: Date.now(),
        version: "1.0"
    };

    const encodedData = btoa(JSON.stringify(teamData));
    const shareUrl = `${window.location.origin}${window.location.pathname}?team=${encodedData}`;

    // Show the share modal
    const modal = document.getElementById('shareModal');
    const urlInput = document.getElementById('shareUrlInput');
    urlInput.value = shareUrl;
    modal.classList.remove('hidden');

    // Focus on the URL input for easy copying
    setTimeout(() => urlInput.select(), 100);
}

function closeShareModal() {
    document.getElementById('shareModal').classList.add('hidden');
}

// Initialize team display on page load
renderTeam();

// Share modal copy button functionality
document.getElementById('copyShareBtn').onclick = () => {
    const urlInput = document.getElementById('shareUrlInput');
    urlInput.select();
    
    navigator.clipboard.writeText(urlInput.value).then(() => {
        // Visual feedback
        const btn = document.getElementById('copyShareBtn');
        const originalText = btn.textContent;
        btn.textContent = 'COPIED!';
        btn.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    }).catch(() => {
        // Fallback
        urlInput.select();
        document.execCommand('copy');
        const btn = document.getElementById('copyShareBtn');
        const originalText = btn.textContent;
        btn.textContent = 'COPIED!';
        btn.style.background = 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    });
};