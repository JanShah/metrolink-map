window.addEventListener('load', start);
/**
 *  Get the json data
 * @returns JSON
 */
async function getData() {
    if (!localStorage.getItem('data')) {
        const url = "Metrolink_Stops_Functional.json";
        return await fetch(window.location.origin + '/' + url)
            .then(async data => await data.json())
            .then(data => data);
    }
    return JSON.parse(localStorage.getItem('data'));
}


async function start() {
    const canvas = document.getElementById('c')
    const data = await getData()
    const featureCollection = new FeatureCollection();
    console.log(data.features)
    data.features.forEach(data => {
        const point = new Point(data.geometry.coordinates)
        const railwayStop = new RailwayStop(data.properties)
        // console.log(data)
        const feature = new Feature(point, railwayStop);
        // console.log(feature)
        featureCollection.addFeature(feature)
        // console.log(data.geometry.coordinates, data.properties)
    });

    featureCollection.addEdge('HPK', 'IWM')
    save(featureCollection)
    const drawing = new Canvas(featureCollection, document.getElementById('canvas'))

    // console.log(JSON.parse(JSON.stringify(featureCollection.features)))

}

class Canvas {

    /**
     * 
     * @param {HTMLElement} canvas 
     * @param {*} features 
     */
    constructor(features, canvas) {

        this.canvas = canvas
        this.ctx = canvas.getContext('2d');
        this.features = features
    }

    draw() {

    }

}

function save(featureCollection) {
    featureCollection.connections = featureCollection.edges
    localStorage.setItem('data', JSON.stringify(featureCollection))
}

class FeatureCollection {
    #edges = []
    constructor() {
        this.features = []
    }
    /**
     * 
     * @param {Feature} feature 
     */
    addFeature(feature) {
        this.features.push(feature)
    }

    addEdge(start, end) {
        const startStation = this.features.find(feature => feature.code === start);
        const endStation = this.features.find(feature => feature.code === end);
        this.#edges.push(new Edge(startStation, endStation))

    }
    get edges() {
        const edgeCodes = this.#edges.map(edge => edge.code)
        return edgeCodes
    }
}


class Feature {
    /**
     * 
     * @param {Point} geometry 
     * @param {RailwayStop} properties 
     */
    constructor(geometry, properties) {
        this.geometry = geometry
        this.properties = properties
    }

    get name() {
        return this.properties.name
    }
    get code() {
        return this.properties.stationCode
    }
}

class Point {

    constructor(coordinates) {
        this.coordinates = coordinates
    }
}

class Edge {
    /**
     * 
     * @param {FeatureCollection} stations
     * @param {Feature} start 
     * @param {Feature} end 
     */
    #start
    #end
    constructor(start, end) {
        this.#start = start
        this.#end = end
        console.log(this)
    }
    get code() {
        return [this.#start.code, this.#end.code]
    }
}

class RailwayStop {
    constructor({ currentStatus, description, name, stationCode, stroke, ticketZone, validFrom }) {
        this.currentStatus = currentStatus
        this.description = description
        this.name = name
        this.stationCode = stationCode
        this.stroke = stroke
        this.ticketZone = ticketZone
        this.validFrom = validFrom
    }

}


function pixelDistance(a, b) {
    return Math.hypot(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

function longLatToDist(start, end, KM = false) {
    const R = KM ? 6373 : 3959;
    const lon1 = degToRad(start[0])
    const lon2 = degToRad(end[0])
    const lat1 = degToRad(start[1])
    const lat2 = degToRad(end[1])

    const dlon = lon2 - lon1
    const dlat = lat2 - lat1
    //Haversine formula
    a = Math.sin(dlat / 2) ** 2 + Math.cos(lat2) * Math.sin(dlon / 2) ** 2
    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
}

function degToRad(deg) {
    return Math.PI * deg / 180
}

function lerp(a, b, t) {
    return a * (1 - t) + b * t;
}


function lonLatToXY(arr) {
    const lonList = arr.map(c => c[0])
    const latList = arr.map(c => c[1])
    const minLon = Math.min(...lonList)
    const maxLon = Math.max(...lonList)
    const minLat = Math.min(...latList)
    const maxLat = Math.max(...latList)
    return function (lon, lat) {
        const xScale = ((W - 50) / (maxLon - minLon));
        const yScale = ((H - 50) / (maxLat - minLat));
        const x = (lon - minLon) * xScale;
        const y = (maxLat - lat) * yScale; //flipped on the y
        return { x, y };
    }

}
