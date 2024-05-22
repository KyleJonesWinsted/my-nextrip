function main() {
    var fragment = location.hash.replace('#', '');
    loadConfig(fragment || 'lpm', function (config) {
        var nameH1 = document.getElementById('name');
        nameH1.innerHTML = config.name;
        updateDisplay(config);
        var updateInterval = 15 * 1000; // 15 seconds
        setInterval(function () { return updateDisplay(config); }, updateInterval);
    });
}
function updateDisplay(config) {
    var depaturesByGroup = {};
    var groupIndex = 0;
    var _loop_1 = function (stopGroup) {
        var stops = config.stopGroups[stopGroup];
        fetchDeparturesByGroup(stops, function (departures) {
            depaturesByGroup[stopGroup] = departures;
            groupIndex++;
            if (groupIndex === Object.keys(config.stopGroups).length) {
                updateDepartureTables(config, depaturesByGroup);
            }
        });
    };
    for (var _i = 0, _a = Object.keys(config.stopGroups); _i < _a.length; _i++) {
        var stopGroup = _a[_i];
        _loop_1(stopGroup);
    }
    var weatherDiv = document.getElementById('weather');
    fetchWeather(config.weather, function (weather) {
        weatherDiv.innerHTML = "\n            <h4>".concat(config.name, "</h4>\n            <h4>").concat(weather.description, "</h4>\n            <h4>").concat(weather.temperature, "\u2109 </h4>\n            <h4>Wind: ").concat(weather.windSpeed, " ").concat(weather.windDirection, "</h4>\n        ");
    });
}
function updateDepartureTables(config, departuresByGroup) {
    var groups = Object.keys(config.stopGroups);
    var elements = groups.map(function (group) { return createStopGroup(group, departuresByGroup[group]); });
    var groupsDiv = document.getElementById('stop-groups');
    groupsDiv.innerHTML = elements.join('');
}
function sendRequest(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.addEventListener('load', function () {
        callback(JSON.parse(xhr.responseText));
    });
    xhr.addEventListener('error', function () {
        addErrorDisplay(xhr);
    });
    xhr.open('GET', url);
    xhr.setRequestHeader('Accept', '*/*');
    xhr.send();
}
function addErrorDisplay(e) {
    var errorDiv = document.getElementById('errors');
    var p = document.createElement('p');
    p.innerHTML = JSON.stringify(e);
    errorDiv.appendChild(p);
}
function createStopGroup(title, departures) {
    var table = createTableFromDepartures(title, departures.slice(0, 20));
    console.log(table);
    return table;
}
function fetchWeather(config, callback) {
    sendRequest("https://api.weather.gov/gridpoints/".concat(config.officeId, "/").concat(config.gridpoints, "/forecast/hourly"), function (data) {
        var current = data.properties.periods[0];
        callback({
            temperature: current.temperature,
            windDirection: current.windDirection,
            windSpeed: current.windSpeed,
            description: current.shortForecast,
        });
    });
}
function createTableFromDepartures(title, departures) {
    if (departures.length < 1)
        return /*html*/ "\n        <table>\n            <tr colspan=\"4\">\n                <h1>".concat(title, "</h1>\n            </tr>\n        </table>\n    ");
    var headerCells = Object.keys(departures[0]).map(function (k) { return "<th>".concat(k, "</th>"); });
    var rows = departures.map(function (e) { return ( /*html*/"\n        <tr>\n            <td>".concat(e.route, "</td>\n            <td>").concat(e.direction, "</td>\n            <td><b>").concat(e.minutesUntilDepart, "</b> min</td>\n            <td><b>").concat(e.minutesMinusWalkingTime, "</b> min</td>\n        </tr>\n    ")); });
    return /*html*/ "\n        <table>\n            <tr>\n                <td colspan=\"".concat(headerCells.length, "\"><h2>").concat(title, "</h2></td>\n            </tr>\n            <tr>\n                <th>Route</th>\n                <th>Direction</th>\n                <th>Departs</th>\n                <th>Leave</th>\n            </tr>\n\n            ").concat(rows, "\n        </table>\n    ").replace(/,/g, '');
}
function fetchDeparturesByGroup(stops, callback) {
    var departures = [];
    var index = 0;
    for (var _i = 0, stops_1 = stops; _i < stops_1.length; _i++) {
        var stop_1 = stops_1[_i];
        fetchDepartures(stop_1, function (stopDepartures) {
            departures.push.apply(departures, stopDepartures);
            index++;
            if (index === stops.length) {
                departures.sort(function (a, b) { return a.minutesMinusWalkingTime - b.minutesMinusWalkingTime; });
                callback(departures);
            }
        });
    }
}
function fetchDepartures(stop, callback) {
    sendRequest('https://kylejon.es/metro-transit-nextrip/' + stop.id, function (data) {
        callback(data.departures
            .filter(function (d) { return stop.routes.indexOf(d.route_id) >= 0; })
            .map(function (d) {
            var _a;
            var minutesUntilDepart = (d.departure_time * 1000 - new Date().getTime()) / 1000 / 60;
            return {
                route: "".concat(d.route_short_name).concat((_a = d.terminal) !== null && _a !== void 0 ? _a : ''),
                direction: d.direction_text,
                minutesUntilDepart: Math.round(minutesUntilDepart),
                minutesMinusWalkingTime: Math.round(minutesUntilDepart - stop.walkingTime),
            };
        })
            .filter(function (d) { return d.minutesMinusWalkingTime > 0; }));
    });
}
function loadConfig(fragment, callback) {
    sendRequest("".concat(fragment, ".json"), function (res) {
        callback(res);
    });
}
try {
    main();
}
catch (err) {
    alert(JSON.stringify(err));
}
