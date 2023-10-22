window.addEventListener('load', start);
/**
 *  Get the json data
 * @returns JSON
 */
async function getData() {
    if (!localStorage.getItem('data')) {
        const url = "data.json";
        return await fetch(window.location.origin + '/' + url)
            .then(async data => await data.json())
            .then(data => data);
    }
    return JSON.parse(localStorage.getItem('data'));
}


async function start() {
    const data = await getData()
    const featureCollection = new FeatureCollection(data);

    if (data.connections) {
        data.connections.forEach(conn =>
            featureCollection.addEdge(...conn)
        )
    }
    const drawing = new Canvas(featureCollection, document.getElementById('canvas'), window.innerWidth < 800 ? window.innerWidth - 100 : 800)
    drawing.draw()

    document.getElementById('clear').addEventListener('click', remove)
    document.getElementById('followPath').addEventListener('click',
        featureCollection.followPath.bind(featureCollection))


    document.getElementById('findClosest').addEventListener('click', () => {
        const closestCodes = findClosestStations(featureCollection);
        closestCodes.forEach(code => {
            featureCollection.getStation(code).highlight()
        })
    });
    save(featureCollection)

}

function findClosestStations(data) {
    let shortest = Infinity
    let stationPair
    data.connections.forEach(([start, end]) => {
        const a = data.getStation(start).point
        const b = data.getStation(end).point
        const dist = longLatToDist(a, b)
        if (dist < shortest) {
            shortest = dist
            stationPair = [start, end]
        }
    })
    return stationPair
}

class Canvas {
    #minLon = 0;
    #maxLon = 0;
    #minLat = 0;
    #maxLat = 0;
    #offset = 10;
    #sensorRange = 7;
    #mouseX = 0;
    #mouseY = 0;
    #scale = 1;
    #translateX = 0;
    #translateY = 0;
    #dragging = false;
    #prevMouseX = 0;
    #prevMouseY = 0;
    #isMouseDown = false
    #distanceMeasurement = 0;
    #stations = [];

    /**
     * 
     * @param {FeatureCollection} featureCollection 
     * @param {HTMLCanvasElement} canvas 
     * @param {Number} w 
     * @param {Number} h 
     */
    constructor(featureCollection, canvas, w = window.innerWidth - 50, h = window.innerHeight - 50) {
        canvas.width = w;
        canvas.height = h;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.featureCollection = featureCollection;
        this.inRange = []
        this.#setBoundaries();
        this.#addListeners();
        this.animate();
    }

    animate() {
        setInterval(() => {
            this.draw()
        }, 60)
    }

    #addListeners() {
        this.selection = null;
        this.canvas.addEventListener('mousedown', this.#mouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.#mouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.#mouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.#scroll.bind(this));
    }

    #scroll(e) {
        const wheel = -Math.sign(e.deltaY) / 10;
        const zoom = Math.pow(1 + Math.abs(wheel) / 2, wheel > 0 ? 1 : -1);
        if (this.#scale * zoom >= 1) {

            this.#scale *= zoom;

            // Update the translation values to zoom around the mouse cursor
            this.#translateX = this.#mouseX - (this.#mouseX - this.#translateX) * zoom;
            this.#translateY = this.#mouseY - (this.#mouseY - this.#translateY) * zoom;
            this.draw();
        }

    }

    #mouseUp() {
        this.#isMouseDown = false
        if (this.selection && this.inRange.length) {
            if (!this.featureCollection.followingPath) {
                this.featureCollection.addEdge(this.selection.code, this.inRange[0].code);
                save(this.featureCollection);
            }
        }
        if (!this.featureCollection.followingPath) {
            this.selection = null;
        }
        this.#dragging = false;
    }

    #mouseDown(e) {
        this.#isMouseDown = true
        this.featureCollection.reset();
        this.#stations = []

        if (this.inRange.length) {
            this.selection = this.inRange[0];
        } else {
            this.#dragging = true;
            this.#prevMouseX = this.#mouseX;
            this.#prevMouseY = this.#mouseY;
        }
    }

    #mouseMove(e) {
        const transform = this.ctx.getTransform();
        const unscaledX = (e.offsetX - this.#offset - this.#translateX) / transform.a;
        const unscaledY = (e.offsetY - this.#offset - this.#translateY) / transform.d;
        this.#mouseX = unscaledX;
        this.#mouseY = unscaledY;
        this.inRange = this.featureCollection.features.filter(p => {
            const dist = pixelDistance({ x: this.#mouseX, y: this.#mouseY }, p);
            if (dist < this.#sensorRange) {
                p.colour = 'red';
                return true;
            } else {
                p.colour = 'black';
            }
        });
        if (this.selection) {
            this.selection.colour = 'green';
        }

        if (this.#dragging) {
            const deltaX = this.#mouseX - this.#prevMouseX;
            const deltaY = this.#mouseY - this.#prevMouseY;

            // Update the translation values to move the canvas.
            this.#translateX += deltaX;
            this.#translateY += deltaY;
            this.#prevMouseX = this.#mouseX;
            this.#prevMouseY = this.#mouseY;
        }

        this.draw();
    }

    drawPath(path) {
        this.#distanceMeasurement = 0;
        this.#stations = []
        if (path) {
            path.forEach((feature, index) => {
                if (index) {
                    const dist = longLatToDist(feature.point, path[index - 1].point)
                    this.#distanceMeasurement += dist
                    const edge = this.featureCollection.findEdge(feature, path[index - 1]);
                    this.#stations.push(path[index - 1].name + ' to ' + feature.name + ' ' + dist.toFixed(2) + ' Miles')
                    edge.highlight();
                }
                feature.highlight()
            });
        }


    }

    draw() {
        const ctx = this.ctx;

        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.setTransform(this.#scale, 0, 0, this.#scale, this.#translateX, this.#translateY);

        ctx.lineWidth = 3;
        if (this.selection) {
            this.selection.drawLabel(ctx);
            ctx.beginPath();
            ctx.moveTo(this.selection.x, this.selection.y);
            if (this.inRange.length && this.inRange[0] !== this.selection) {

                if (!this.featureCollection.followingPath) {
                    ctx.strokeStyle = 'green';
                    ctx.lineTo(this.inRange[0].x, this.inRange[0].y);
                } else if (!this.#isMouseDown && this.featureCollection.followingPath) {
                    //find the path to the destination
                    this.drawPath(
                        this.featureCollection.findPath(
                            this.selection, this.inRange[0]
                        ))
                    this.selection = null
                }




            } else {
                ctx.strokeStyle = 'black';
                ctx.lineTo(this.#mouseX, this.#mouseY);
            }
            ctx.stroke();
        }

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.#mouseX, this.#mouseY, this.#sensorRange, 0, Math.PI * 2);
        ctx.stroke();
        this.featureCollection.draw(ctx);
        if (this.#distanceMeasurement) {
            ctx.save()
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.fillText(this.#distanceMeasurement.toFixed(2) + " Miles", 20, 20)
            ctx.restore()
        }
        if(this.#stations.length) {
            ctx.save()
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.lineWidth = 2
            this.#stations.forEach((station, i)=>{

                ctx.strokeStyle = 'white'
                ctx.strokeText(station,20,(i + 3 )* 12)
                ctx.strokeStyle = 'black'
                ctx.fillText(station,20,(i + 3 )* 12)
            })
            ctx.restore()

        }
        if (this.inRange.length) {

            this.inRange[0].drawLabel(ctx);
        }
    }

    setXy(point) {
        const w = this.canvas.width - 50;
        const h = this.canvas.height - 50;
        const [lon, lat] = point.coordinates;
        const xScale = (w / (this.#maxLon - this.#minLon));
        const yScale = (h / (this.#maxLat - this.#minLat));
        point.x = (lon - this.#minLon) * xScale + 30;
        point.y = (this.#maxLat - lat) * yScale + 30;
    }

    #setBoundaries() {
        const p = this.featureCollection.points;
        const lonList = p.map(c => c[0]);
        const latList = p.map(c => c[1]);
        this.#minLon = Math.min(...lonList);
        this.#maxLon = Math.max(...lonList);
        this.#minLat = Math.min(...latList);
        this.#maxLat = Math.max(...latList);
        this.featureCollection.features.forEach(feature =>
            this.setXy(feature.geometry)
        );
    }

    get boundaries() {
        return {
            minLon: this.#minLon,
            maxLon: this.#maxLon,
            minLat: this.#minLat,
            maxLat: this.#maxLat
        };
    }
}


function save(featureCollection) {
    featureCollection.connections = featureCollection.edges
    localStorage.setItem('data', JSON.stringify(featureCollection))
}

function remove() {
    localStorage.removeItem('data')
    window.location.reload()
}

class FeatureCollection {
    #edges = new EdgeCollection()
    #objects = {}
    #followingPath = false
    constructor(data) {
        this.features = []
        this.#process(data)
    }
    getStation(code) {
        return this.#objects[code]
    }

    findEdge(start, end) {
        return this.#edges.findEdge(start, end)
    }

    findPath(current, destination, route = []) {
        route.push(current)
        current.traverse()
        if (current == destination) {
            return route;
        }
        const neighbours = this.#edges.filter(current).sort((a, b) => {
            return longLatToDist(
                a.point, destination.point) - longLatToDist(b.point, destination.point
                )
        })
        for (const neighbour of neighbours) {
            if (!neighbour.traversed) {
                const new_route = this.findPath(neighbour, destination, [].concat(...route))
                if (new_route) {
                    return new_route;
                }

            }
        }

    }

    reset() {
        this.features.forEach(feature => {
            feature.reset()
        })
        this.#edges.reset()
    }

    followPath() {
        this.#followingPath = !this.#followingPath
        const btn = document.getElementById('followPath')
        if (this.#followingPath) {
            btn.style.background = 'lightgreen'
        } else {
            btn.removeAttribute('style')
        }
    }

    get followingPath() {
        return this.#followingPath
    }

    #process(data) {
        data.features.forEach(data => {
            this.addFeature(new Feature(
                new Point(data.geometry.coordinates),
                new RailwayStop(data.properties))
            )
        });
    }

    draw(ctx) {
        this.#edges.draw(ctx);
        this.features.forEach(feature => {
            feature.draw(ctx)
        });
    }


    /**
     * 
     * @param {Feature} feature 
     */
    addFeature(feature) {
        this.features.push(feature);
        if (!this.#objects[feature.code])
            this.#objects[feature.code] = feature

    }


    addEdge(start, end) {
        const startStation = this.features.find(feature => feature.code === start);
        const endStation = this.features.find(feature => feature.code === end);
        if (startStation && endStation) {
            this.#edges.push(startStation, endStation);
            this.#edges.push(endStation, startStation);
        }

    }


    get edges() {
        const edgeCodes = this.#edges.codes
        return edgeCodes
    }


    get points() {
        return this.features.map(feature => {
            return feature.point
        });
    }

    get pointsXY() {
        return this.features.map(feature => {
            return { x: feature.x, y: feature.y, feature }
        });
    }

}

class EdgeCollection {
    constructor() {
        this.edges = []
    }

    findEdge(start, end) {
        return this.edges.find((edge) => {
            return edge.start === start && edge.end === end
        })
    }

    filter(feature) {
        return this.edges.filter(edge =>
            edge.start === feature
        ).map(edge => edge.end)
    }

    push(start, end) {
        const existingEdge = this.edges.filter(edge => {
            return edge.start == start && edge.end === end
        });
        if (!existingEdge.length && start !== end)
            this.edges.push(new Edge(start, end))
    }

    get codes() {
        return this.edges.map(edge => edge.code)
    }

    draw(ctx) {
        this.edges.forEach(edge => {
            edge.draw(ctx)
        })
    }

    reset() {
        this.edges.forEach(edge => edge.reset())
    }

}


class Feature {
    #highlighted = false

    /**
     * 
     * @param {Point} geometry 
     * @param {RailwayStop} properties 
     */
    constructor(geometry, properties) {
        this.geometry = geometry
        this.properties = properties
    }

    reset() {
        this.#highlighted = false
        this.properties.reset()
    }

    traverse() {
        this.properties.traverse()
    }

    get traversed() {
        return this.properties.traversed
    }

    draw(ctx) {
        this.geometry.draw(ctx, this.#highlighted)
        // this.drawLabel(ctx)
    }

    highlight() {
        this.#highlighted = true
    }

    drawLabel(ctx) {
        ctx.save()
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.lineJoin = 'miter'

        ctx.textAlign = 'center'
        ctx.textBasealign = 'middle'
        ctx.strokeStyle = 'white'

        ctx.strokeText(this.name, this.x - 10, this.y - 15)
        ctx.fillText(this.name, this.x - 10, this.y - 15)
        ctx.strokeStyle = 'darkblue'
        ctx.lineWidth = .5

        ctx.beginPath()
        ctx.moveTo(this.x, this.y - 3)
        ctx.lineTo(this.x, this.y - 15)
        ctx.stroke()
        ctx.restore()
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

    get x() {
        return this.geometry.x
    }

    get y() {
        return this.geometry.y
    }

    /**
     * @param {String} colour
     */
    set colour(colour) {
        this.geometry.stroke = colour
    }

}

class Point {
    #stroke = 'black'
    constructor(coordinates) {
        this.coordinates = coordinates;
        this.x = 0
        this.y = 0

    }

    /**
     * @param {string} colour
     */
    set stroke(colour) {
        this.#stroke = colour
    }

    draw(ctx, highlight = false) {
        ctx.strokeStyle = this.#stroke
        if (highlight) {
            ctx.strokeStyle = 'red'
            ctx.lineWidth = 2
        }
        ctx.beginPath()
        ctx.arc(this.x, this.y, highlight ? 3 : 3, 0, Math.PI * 2)
        ctx.fillStyle = 'white'
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = 'black'
        ctx.lineWidth = 1
    }
}

class Edge {
    #start
    #end
    #highlighted = false
    /**
     * 
     * @param {Feature} start 
     * @param {Feature} end 
     */
    constructor(start, end) {
        this.#start = start
        this.#end = end
    }
    get code() {
        return [this.#start.code, this.#end.code]
    }

    highlight() {
        this.#highlighted = true
    }

    reset() {
        this.#highlighted = false
    }

    get start() {
        return this.#start
    }

    get end() {
        return this.#end
    }

    draw(ctx) {
        ctx.save()
        if (this.#highlighted) {
            ctx.lineWidth = 4
            ctx.strokeStyle = 'orange'
        }
        ctx.beginPath()
        ctx.moveTo(...this.getXY('start'))
        ctx.lineTo(...this.getXY('end'))
        ctx.stroke()
        ctx.restore();
    }

    getXY(pos = 'start') {
        return [this[pos].x, this[pos].y]
    }

}

class RailwayStop {

    #traversed = false
    constructor({ currentStatus, description, name, stationCode, stroke, ticketZone, validFrom }) {
        this.currentStatus = currentStatus
        this.description = description
        this.name = name
        this.stationCode = stationCode
        this.stroke = stroke
        this.ticketZone = ticketZone
        this.validFrom = validFrom
    }

    traverse() {
        this.#traversed = true
    }

    get traversed() {
        return this.#traversed
    }

    reset() {
        this.#traversed = false
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

