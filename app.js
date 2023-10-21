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
    const data = await getData()
    const featureCollection = new FeatureCollection(data);
    console.log(data.features)

    if(data.connections) {
        data.connections.forEach(conn=>
            featureCollection.addEdge(...conn)
        )
    }
    save(featureCollection)
    const drawing = new Canvas(featureCollection, document.getElementById('canvas'))
    drawing.draw()
    // console.log(JSON.parse(JSON.stringify(featureCollection.features)))

}

class Canvas {

    #minLon = 0;
    #maxLon = 0;
    #minLat = 0;
    #maxLat = 0;
    /**
     * 
     * @param {FeatureCollection} featureCollection 
     * @param {HTMLCanvasElement} canvas 
     * @param {Number} w 
     * @param {Number} h 
     */
    constructor(featureCollection, canvas, w = 600, h = 600) {
        canvas.width = w
        canvas.height = h
        this.canvas = canvas
        this.ctx = canvas.getContext('2d');
        this.ctx.translate(10,10)

        this.featureCollection = featureCollection
        this.#setBoundaries()
        this.#addListeners();

    }

    #addListeners() {
        
    }

    draw() {
        this.featureCollection.draw(this.ctx)
    }

    setXy(point) {
        const w = this.canvas.width - 20
        const h = this.canvas.height - 20
        const [lon, lat] = point.coordinates;
        const xScale = (w / (this.#maxLon - this.#minLon));
        const yScale = (h / (this.#maxLat - this.#minLat));
        point.x = (lon - this.#minLon) * xScale;
        point.y = (this.#maxLat - lat) * yScale; //flipped on the y

    }
    #setBoundaries() {
        const p = this.featureCollection.points
        const lonList = p.map(c => c[0])
        const latList = p.map(c => c[1])
        this.#minLon = Math.min(...lonList)
        this.#maxLon = Math.max(...lonList)
        this.#minLat = Math.min(...latList)
        this.#maxLat = Math.max(...latList)
        this.featureCollection.features.forEach(feature =>
            this.setXy(feature.geometry)
        )
    }
    get boundaries() {
        return {
            minLon: this.#minLon,
            maxLon: this.#maxLon,
            minLat: this.#minLat,
            maxLat: this.#maxLat
        }
    }


}

function save(featureCollection) {
    featureCollection.connections = featureCollection.edges
    localStorage.setItem('data', JSON.stringify(featureCollection))
}

class FeatureCollection {
    #edges = []


    constructor(data) {
        this.features = []
        this.#process(data)
    }

    #process(data) {
        data.features.forEach(data => {
            this.addFeature(new Feature(
                new Point(data.geometry.coordinates),
                new RailwayStop(data.properties))
            )
        });
        // this.#setBoundaries()
    }




    draw(ctx) {
        this.features.forEach(feature => {
            feature.draw(ctx)
        });
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
        if (startStation && endStation)
            this.#edges.push(new Edge(startStation, endStation))

    }
    get edges() {
        const edgeCodes = this.#edges.map(edge => edge.code)
        return edgeCodes
    }

    get points() {
        return this.features.map(feature => {
            return feature.point
        })
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

    draw(ctx) {
        this.geometry.draw(ctx)
    }

    get name() {
        return this.properties.name
    }
    get code() {
        return this.properties.stationCode
    }

    get point() {
        return this.geometry.coordinates
    }

}

class Point {

    constructor(coordinates) {
        this.coordinates = coordinates;
        this.x = 0
        this.y = 0

    }

    draw(ctx) {
        console.log(ctx)
        ctx.fillRect(this.x,this.y,5,5)
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
