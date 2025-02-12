
let departureFormat: 'relative' | 'actual' = 'relative';
let interval = 0;

function main() {
    const fragment = location.hash.replace('#', '');
    loadConfig(fragment || 'lpm', (config: Config) => {
        updateDisplay(config);
        const updateInterval = 15 * 1000; // 15 seconds
        if (interval) clearInterval(interval);
        interval = setInterval(() => updateDisplay(config), updateInterval);
    });
}

function updateDisplay(config: Config): void {
    console.log('updating', new Date());
    let departuresByGroup: Record<string, Departure[]> = {};
    let groupIndex = 0;
    for (const stopGroup of Object.keys(config.stopGroups)) {
        const stops = config.stopGroups[stopGroup];
        fetchDeparturesByGroup(stops, (departures: Departure[]) => {
            departuresByGroup[stopGroup] = departures;
            groupIndex++;
            if (groupIndex === Object.keys(config.stopGroups).length) {
                updateDepartureTables(config, departuresByGroup);
            }
        });
    }
    const weatherDiv = document.getElementById('weather') as HTMLDivElement;
    fetchWeather(config.weather, (weather: Weather) => {
        weatherDiv.innerHTML = /*html*/`
            <table>
                <tr>
                    <td>${config.name}</td>
                    <td>${weather.description}</td>
                    <td>${weather.temperature}°F</td>
                    <td>Wind: ${weather.windSpeed} ${weather.windDirection}</td>
                </tr>
            </table>
        `;
    });
}

function updateDepartureTables(config: Config, departuresByGroup: Record<string, Departure[]>): void {
    const groups = Object.keys(config.stopGroups);
    const elements = groups.map((group) => createStopGroup(group, departuresByGroup[group]))
    const groupsDiv = document.getElementById('stop-groups') as HTMLDivElement;
    groupsDiv.innerHTML = /*html*/`
        <table>
            <tr>
                ${elements.map(e => `<td>${e}</td>`)}
            <tr>
        </table>
    `.replace(/,/g, '');
}

function sendRequest<T>(url: string, callback: (d: T) => void): void {
    const xhr = new XMLHttpRequest();
    xhr.addEventListener('load', () => {
        callback(JSON.parse(xhr.responseText));
    });
    xhr.addEventListener('error', () => {
        addErrorDisplay(xhr);
    });
    xhr.open('GET', url);
    xhr.setRequestHeader('Accept', '*/*')
    xhr.send();
}

function addErrorDisplay(e: any): void {
    const errorDiv = document.getElementById('errors') as HTMLDivElement;
    const p = document.createElement('p');
    p.innerHTML = JSON.stringify(e);
    errorDiv.appendChild(p);
}

function createStopGroup(title: string, departures: Departure[]): string {
    const fixedLenDepartures = setLength(departures, 20, {
        direction: '',
        minutesMinusWalkingTime: 0,
        minutesUntilDepart: 0,
        route: '',
        departureTime: '',
    });
    const table = createTableFromDepartures(title, fixedLenDepartures);
    return table;
}

function setLength<T>(arr: Array<T>, length: number, defaultValue: T): Array<T> {
    if (arr.length >= length) {
        return arr.slice(0, length);
    }
    const newArr = arr.slice();
    while (newArr.length < length) {
        newArr.push(defaultValue);
    }
    return newArr;
}

function fetchWeather(config: WeatherConfig, callback: (w: Weather) => void): void {
    sendRequest(`https://api.weather.gov/gridpoints/${config.officeId}/${config.gridpoints}/forecast/hourly`, (data: WeatherAPIResponse) => {
        const current = data.properties.periods[0];
        callback({
            temperature: current.temperature,
            windDirection: current.windDirection,
            windSpeed: current.windSpeed,
            description: current.shortForecast,
        })
    })
}

function toggleDepartFormat(): void {
    console.log('toggle');
    if (departureFormat === 'relative') {
        departureFormat = 'actual'
    } else {
        departureFormat = 'relative';
    }
    main();
}

function createTableFromDepartures(title: string, departures: Departure[]): string {
    if (departures.length < 1) return /*html*/`
        <table>  
            <tr colspan="4">
                <th>
                    <h2>${title}</h2>
                </th>
            </tr>
        </table>
    `;
    const headerCells = Object.keys(departures[0]).map((k) => `<th>${k}</th>`);
    const rows = departures.map((e) => (/*html*/`
        <tr>
            <td>${e.route}</td>
            <td>${e.direction}</td>
            <td onclick="toggleDepartFormat()">${departureFormat === 'actual' ? e.departureTime : '<b>' + e.minutesUntilDepart + '</b> <span class="min">min</span>'}</td>
            <td><b>${e.minutesMinusWalkingTime}</b> <span class="min">min</span></td>
        </tr>
    `));
    return /*html*/`
        <table class="stop-group">
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

function fetchDeparturesByGroup(stops: Stop[], callback: (d: Departure[]) => void): void {
    const departures: Departure[] = [];
    let index = 0;
    for (const stop of stops) {
        fetchDepartures(stop, (stopDepartures: Departure[]) => {
            departures.push(...stopDepartures);
            index++;
            if (index === stops.length) {
                departures.sort((a, b) => a.minutesMinusWalkingTime - b.minutesMinusWalkingTime);
                callback(departures);
            }
        });
    }
}

function fetchDepartures(stop: Stop, callback: (d: Departure[]) => void): void {
    sendRequest('https://svc.metrotransit.org/nextrip/' + stop.id, (data: NexTripAPIResponse) => {
        callback(data.departures
            .filter((d) => stop.routes.indexOf(d.route_id) >= 0)
            .map(d => {
                const minutesUntilDepart = (d.departure_time * 1000 - new Date().getTime()) / 1000 / 60;
                return {
                    route: `${d.route_short_name}${d.terminal ?? ''}`,
                    direction: d.direction_text,
                    minutesUntilDepart: Math.round(minutesUntilDepart),
                    departureTime: timeShortFormat(new Date(d.departure_time * 1000)),
                    minutesMinusWalkingTime: Math.round(minutesUntilDepart - stop.walkingTime),
                }
            })
            .filter((d) => d.minutesMinusWalkingTime > 0))
    });
}

function timeShortFormat(d: Date): string {
    let hours = d.getHours();
    const minutes = d.getMinutes();
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesText = minutes < 10 ? '0' + minutes : minutes;
    const strTime = hours + ':' + minutesText;
    return strTime;
}

function loadConfig(fragment: string, callback: (c: Config) => void): void {
    sendRequest(`${fragment}.json`, (res: Config) => {
        callback(res)
    });
}

type Weather = {
    temperature: number;
    windSpeed: string;
    windDirection: string;
    description: string;
}

type Departure = {
    route: string;
    direction: string;
    minutesUntilDepart: number;
    departureTime: string;
    minutesMinusWalkingTime: number;
}

type Config = {
    name: string;
    weather: WeatherConfig;
    stopGroups: { [groupName: string]: Stop[] }
}

type Stop = {
    id: string;
    walkingTime: number;
    routes: string[];
}

type WeatherConfig = {
    officeId: string;
    gridpoints: string;
}

type NexTripAPIResponse = {
    stops: APIStop[];
    alerts: unknown[];
    departures: APIDeparture[];
}

type APIDeparture = {
    actual: boolean;
    trip_id: string;
    stop_id: number;
    departure_text: string;
    departure_time: number;
    description: string;
    route_id: string;
    route_short_name: string;
    direction_id: number;
    direction_text: string;
    terminal?: string;
    schedule_relationship: string;
}

type APIStop = {
    stop_id: number;
    latitude: number;
    longitude: number;
    description: string;
}

type WeatherAPIResponse = {
    "@context": Array<ContextClass | string>;
    type: string;
    geometry: Geometry;
    properties: Properties;
}

type ContextClass = {
    "@version": string;
    wx: string;
    geo: string;
    unit: string;
    "@vocab": string;
}

type Geometry = {
    type: string;
    coordinates: Array<Array<number[]>>;
}

type Properties = {
    updated: Date;
    units: string;
    forecastGenerator: string;
    generatedAt: Date;
    updateTime: Date;
    validTimes: string;
    elevation: Elevation;
    periods: Period[];
}

type Elevation = {
    unitCode: string;
    value: number;
}


type Period = {
    number: number;
    name: string;
    startTime: Date;
    endTime: Date;
    isDaytime: boolean;
    temperature: number;
    temperatureUnit: string;
    temperatureTrend: null;
    probabilityOfPrecipitation: Elevation;
    dewpoint: Elevation;
    relativeHumidity: Elevation;
    windSpeed: string;
    windDirection: string;
    icon: string;
    shortForecast: string;
    detailedForecast: string;
}


try {
    main();
} catch (err) {
    alert(JSON.stringify(err));
}

