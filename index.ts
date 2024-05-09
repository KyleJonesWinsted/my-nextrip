
async function main() {
    const fragment = location.hash.replace('#', '');
    console.log(fragment);
    const config = await loadConfig(fragment || 'lpm');
    const nameH1 = document.getElementById('name') as HTMLHeadingElement;
    nameH1.innerHTML = config.name;
    updateDisplay(config);
    const updateInterval = 15 * 1000; // 15 seconds
    setInterval(() => updateDisplay(config), updateInterval);
}

async function updateDisplay(config: Config): Promise<void> {

    let elements: string[] = [];
    for (const stopGroup of Object.keys(config.stopGroups)) {
        const stops = config.stopGroups[stopGroup];
        const departures = await fetchDeparturesByGroup(stops);
        const stopGroupHtml = createStopGroup(stopGroup, departures);
        elements.push(stopGroupHtml);
    }
    const groupsDiv = document.getElementById('stop-groups') as HTMLDivElement;
    groupsDiv.innerHTML = elements.join('');

    const weatherDiv = document.getElementById('weather') as HTMLDivElement;
    const weather = await fetchWeather(config.weather);
    weatherDiv.innerHTML = `
        <h4>${config.name}</h4>
        <h4>${weather.description}</h4>
        <h4>${weather.temperature}℉ </h4>
        <h4>Wind: ${weather.windSpeed} ${weather.windDirection}</h4>
    `;
}

function createStopGroup(title: string, departures: Departure[]): string {
    const table = createTableFromDepartures(title, departures.slice(0, 20));
    console.log(table);
    return table;
}

async function fetchWeather(config: WeatherConfig): Promise<Weather> {
    const response = await fetch(`https://api.weather.gov/gridpoints/${config.officeId}/${config.gridpoints}/forecast/hourly`);
    if (!response.ok) throw new Error(`bad repsonse from weather api ${response.status} ${response.statusText}`);
    const data: WeatherAPIResponse = await response.json();
    const current = data.properties.periods[0];
    return {
        temperature: current.temperature,
        windDirection: current.windDirection,
        windSpeed: current.windSpeed,
        description: current.shortForecast,
    }
}

function createTableFromDepartures(title: string, departures: Departure[]): string {
    if (departures.length < 1) return /*html*/`
        <table>
            <tr colspan="4">
                <h1>${title}</h1>
            </tr>
        </table>
    `;
    const headerCells = Object.keys(departures[0]).map((k) => `<th>${k}</th>`);
    const rows = departures.map((e) => (/*html*/`
        <tr>
            <td>${e.route}</td>
            <td>${e.direction}</td>
            <td><b>${e.minutesUntilDepart}</b> min</td>
            <td><b>${e.minutesMinusWalkingTime}</b> min</td>
        </tr>
    `));
    return /*html*/`
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

async function fetchDeparturesByGroup(stops: Stop[]): Promise<Departure[]> {
    const departures: Departure[] = [];
    for (const stop of stops) {
        departures.push(...(await fetchDepartures(stop)));
    }
    departures.sort((a, b) => a.minutesMinusWalkingTime - b.minutesMinusWalkingTime);
    return departures;
}

async function fetchDepartures(stop: Stop): Promise<Departure[]> {
    const response = await fetch('https://svc.metrotransit.org/nextrip/' + stop.id);
    if (!response.ok) throw new Error(`bad response from api ${response.status} ${response.statusText}}`);
    const data: NexTripAPIResponse = await response.json();
    return data.departures
        .filter((d) => stop.routes.indexOf(d.route_id) >= 0)
        .map(d => {
            const minutesUntilDepart = (d.departure_time * 1000 - new Date().getTime()) / 1000 / 60;
            return {
                route: `${d.route_short_name}${d.terminal ?? ''}`,
                direction: d.direction_text,
                minutesUntilDepart: Math.round(minutesUntilDepart),
                minutesMinusWalkingTime: Math.round(minutesUntilDepart - stop.walkingTime),
            }
        })
        .filter((d) => d.minutesMinusWalkingTime > 0);
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

async function loadConfig(fragment: string): Promise<Config> {
    const res = await fetch(`${fragment}.json`);
    const config = await res.json();
    return config;
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



main();

