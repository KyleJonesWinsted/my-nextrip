"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const fragment = location.hash.replace('#', '');
        console.log(fragment);
        const config = yield loadConfig(fragment || 'lpm');
        const nameH1 = document.getElementById('name');
        nameH1.innerHTML = config.name;
        updateDisplay(config);
        const updateInterval = 15 * 1000; // 15 seconds
        setInterval(() => updateDisplay(config), updateInterval);
    });
}
function updateDisplay(config) {
    return __awaiter(this, void 0, void 0, function* () {
        let elements = [];
        for (const stopGroup of Object.keys(config.stopGroups)) {
            const stops = config.stopGroups[stopGroup];
            const departures = yield fetchDeparturesByGroup(stops);
            const stopGroupHtml = createStopGroup(stopGroup, departures);
            elements.push(stopGroupHtml);
        }
        const groupsDiv = document.getElementById('stop-groups');
        groupsDiv.innerHTML = elements.join('');
        const weatherDiv = document.getElementById('weather');
        const weather = yield fetchWeather(config.weather);
        weatherDiv.innerHTML = `
        <h4>${config.name}</h4>
        <h4>${weather.description}</h4>
        <h4>${weather.temperature}℉ </h4>
        <h4>Wind: ${weather.windSpeed} ${weather.windDirection}</h4>
    `;
    });
}
function createStopGroup(title, departures) {
    const table = createTableFromDepartures(title, departures.slice(0, 20));
    console.log(table);
    return table;
}
function fetchWeather(config) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch(`https://api.weather.gov/gridpoints/${config.officeId}/${config.gridpoints}/forecast/hourly`);
        if (!response.ok)
            throw new Error(`bad repsonse from weather api ${response.status} ${response.statusText}`);
        const data = yield response.json();
        const current = data.properties.periods[0];
        return {
            temperature: current.temperature,
            windDirection: current.windDirection,
            windSpeed: current.windSpeed,
            description: current.shortForecast,
        };
    });
}
function createTableFromDepartures(title, departures) {
    if (departures.length < 1)
        return /*html*/ `
        <table>
            <tr colspan="4">
                <h1>${title}</h1>
            </tr>
        </table>
    `;
    const headerCells = Object.keys(departures[0]).map((k) => `<th>${k}</th>`);
    const rows = departures.map((e) => ( /*html*/`
        <tr>
            <td>${e.route}</td>
            <td>${e.direction}</td>
            <td><b>${e.minutesUntilDepart}</b> min</td>
            <td><b>${e.minutesMinusWalkingTime}</b> min</td>
        </tr>
    `));
    return /*html*/ `
        <table>
            <tr>
                <td colspan="${headerCells.length}"><h2>${title}</h2></td>
            </tr>
            <tr>
                <th>Route</th>
                <th>Direction</th>
                <th>Departs</th>
                <th>Leave</th>
            </tr>

            ${rows}
        </table>
    `.replace(/,/g, '');
}
function fetchDeparturesByGroup(stops) {
    return __awaiter(this, void 0, void 0, function* () {
        const departures = [];
        for (const stop of stops) {
            departures.push(...(yield fetchDepartures(stop)));
        }
        departures.sort((a, b) => a.minutesMinusWalkingTime - b.minutesMinusWalkingTime);
        return departures;
    });
}
function fetchDepartures(stop) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch('https://svc.metrotransit.org/nextrip/' + stop.id);
        if (!response.ok)
            throw new Error(`bad response from api ${response.status} ${response.statusText}}`);
        const data = yield response.json();
        return data.departures
            .filter((d) => stop.routes.indexOf(d.route_id) >= 0)
            .map(d => {
            var _a;
            const minutesUntilDepart = (d.departure_time * 1000 - new Date().getTime()) / 1000 / 60;
            return {
                route: `${d.route_short_name}${(_a = d.terminal) !== null && _a !== void 0 ? _a : ''}`,
                direction: d.direction_text,
                minutesUntilDepart: Math.round(minutesUntilDepart),
                minutesMinusWalkingTime: Math.round(minutesUntilDepart - stop.walkingTime),
            };
        })
            .filter((d) => d.minutesMinusWalkingTime > 0);
    });
}
function loadConfig(fragment) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetch(`${fragment}.json`);
        const config = yield res.json();
        return config;
    });
}
main();
