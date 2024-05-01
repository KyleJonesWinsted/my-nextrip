"use strict";
async function main() {
    const fragment = location.hash.replace('#', '');
    console.log(fragment);
    const config = await loadConfig(fragment || 'lpm');
    const nameH1 = document.getElementById('name');
    nameH1.innerHTML = config.name;
    updateDisplay(config);
    const updateInterval = 15 * 1000; // 15 seconds
    setInterval(() => updateDisplay(config), updateInterval);
}
async function updateDisplay(config) {
    const groupsDiv = document.getElementById('stop-groups');
    groupsDiv.innerHTML = '';
    for (const stopGroup of Object.keys(config.stopGroups)) {
        const stops = config.stopGroups[stopGroup];
        const departures = await fetchDeparturesByGroup(stops);
        const table = createTableFromObjectArray(departures.slice(0, 6));
        console.log(table);
        groupsDiv.appendChild(createElementFromHTML(`<h1>${stopGroup}</h1>`)[0]);
        groupsDiv.appendChild(table[1]);
    }
    const weatherDiv = document.getElementById('weather');
    const weather = await fetchWeather(config.weather);
    weatherDiv.innerHTML = `
        <h2>${weather.description}</h2>
        <h2>${weather.temperature}℉ </h2>
        <h2>Wind: ${weather.windSpeed} ${weather.windDirection}<h2>
    `;
}
async function fetchWeather(config) {
    const response = await fetch(`https://api.weather.gov/gridpoints/${config.officeId}/${config.gridpoints}/forecast/hourly`);
    if (!response.ok)
        throw new Error(`bad repsonse from weather api ${response.status} ${response.statusText}`);
    const data = await response.json();
    const current = data.properties.periods[0];
    return {
        temperature: current.temperature,
        windDirection: current.windDirection,
        windSpeed: current.windSpeed,
        description: current.shortForecast,
    };
}
function createElementFromHTML(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.childNodes;
}
function createTableFromObjectArray(arr) {
    if (arr.length < 1)
        return createElementFromHTML(`<table></table>`);
    const headerCells = Object.keys(arr[0]).map((k) => `<th>${k}</th>`);
    const rows = arr.map((e) => {
        const cells = Object.values(e).map((v) => `<td>${v}</td>`);
        return `<tr>${cells}</tr>`;
    });
    return createElementFromHTML(/*html*/ `
        <table>
            <tr>${headerCells}</tr>
            ${rows}
        </table>
    `);
}
async function fetchDeparturesByGroup(stops) {
    const departures = [];
    for (const stop of stops) {
        departures.push(...(await fetchDepartures(stop)));
    }
    departures.sort((a, b) => a.minutesMinusWalkingTime - b.minutesMinusWalkingTime);
    return departures;
}
async function fetchDepartures(stop) {
    const response = await fetch('https://svc.metrotransit.org/nextrip/' + stop.id);
    if (!response.ok)
        throw new Error(`bad response from api ${response.status} ${response.statusText}}`);
    const data = await response.json();
    return data.departures
        .filter((d) => stop.routes.includes(d.route_id))
        .map(d => {
        const minutesUntilDepart = (d.departure_time * 1000 - new Date().getTime()) / 1000 / 60;
        return {
            route: `${d.route_short_name}${d.terminal ?? ''}`,
            minutesUntilDepart: Math.round(minutesUntilDepart),
            minutesMinusWalkingTime: Math.round(minutesUntilDepart - stop.walkingTime),
        };
    })
        .filter((d) => d.minutesMinusWalkingTime > 0);
}
async function loadConfig(fragment) {
    const res = await fetch(`${fragment}.json`);
    const config = await res.json();
    return config;
}
main();
