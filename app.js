window.addEventListener('load', start);
const W = 900;
const H = 600;
/**
 *  Get the json data
 * @returns JSON
 */
async function getData() {
    const url = "Metrolink_Stops_Functional.json";
    return await fetch(window.location.origin + '/' + url)
        .then(async data => await data.json())
        .then(data => data);
}

/**
 * 
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Array<Object>} selections 
 * @param {Number} d 
 */
function showSelections(ctx, selections = [], d = 0) {
    const x = W - 250, y = H - 200;
    ctx.fillStyle = 'black'
    ctx.fillRect(x, y, 240, 190);
    if (selections.length) {
        ctx.fillStyle = 'white'
        ctx.textAlign = 'left'
        const start = selections[0].features
        const end = selections[1].features
        ctx.fillText("Selected stations:", x + 5, y + 10)
        ctx.fillText(start.properties.name + " to " + end.properties.name, x + 5, y + 20)
        ctx.fillText(start.properties.name, x + 5, y + 40)
        ctx.fillText(start.properties.description, x + 5, y + 50)
        ctx.fillText(end.properties.name, x + 5, y + 70)
        ctx.fillText(end.properties.description, x + 5, y + 80)
        ctx.fillText("Straight distance: " + d.toFixed(2), x + 5, y + 110)
    }
    ctx.textAlign = 'center'
}

async function start() {
    const data = await getData();
    const mousePos = { x: 0, y: 0 };
    let sensorRadius = 10;
    let selectedStation
    let inRangeCells = []
    let isMouseDown = false
    const edges = [];

    const canvas = document.getElementById('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.getContext('2d').translate(20, 20);

    const ctx = canvas.getContext(['2d']);
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const features = data.features;

    const getXY = lonLatToXY(data.features.map(i => i.geometry.coordinates));
    const grid = [];
    for (let i = 0; i < features.length; i++) {
        const curr = features[i].geometry;
        const { x, y } = getXY(...curr.coordinates);
        grid.push({ x, y, fill: 'black', features: features[i] });
    }
    canvas.addEventListener('mousemove', e => {
        const x = e.offsetX - 20, y = e.offsetY - 20
        mousePos.x = x
        mousePos.y = y

        inRangeCells = grid.filter(el => {
            if (el !== selectedStation)
                el.fill = 'black'
            return pixelDistance({ x, y }, el) < sensorRadius
        });
        if (inRangeCells.length) {
            inRangeCells.forEach(el => {
                if (el !== selectedStation)
                    el.fill = 'red'
                else
                    el.fill = 'green'
            });
        }

    });
    canvas.addEventListener('wheel', e => {
        sensorRadius -= Math.sign(e.deltaY)
    });


    canvas.addEventListener('mousedown', e => {
        isMouseDown = true;

        if (inRangeCells.length) {
            selectedStation = inRangeCells[0];
            selectedStation.fill = 'green'
        }
    })
    canvas.addEventListener('mouseup', e => {
        const endStation = inRangeCells[0];
        if (selectedStation && endStation) {
            if (edges.filter((edge => {
                return edge.start === selectedStation && edge.end === endStation
                    || edge.end === selectedStation && edge.start === endStation
            })).length === 0)
                edges.push({ start: selectedStation, end: endStation })
            selectedStation.connection = endStation

        }
        selectedStation = null;
        isMouseDown = false;
        console.log(data)
    })
    setInterval(() => {
        draw()
    });

    function draw() {
        ctx.clearRect(-20, -20, ctx.canvas.width + 20, ctx.canvas.height + 20);

        edges.forEach(edge => {
            ctx.strokeStyle = 'blue'
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.moveTo(edge.start.x, edge.start.y)
            ctx.lineTo(edge.end.x, edge.end.y);
            ctx.stroke();

        });
        ctx.strokeStyle = 'black'
        ctx.lineWidth = 1
        if (selectedStation) {
            ctx.fillText(selectedStation.features.properties.name, selectedStation.x, selectedStation.y - 10)
            ctx.beginPath()
            ctx.moveTo(selectedStation.x, selectedStation.y)
            let x = 0, y = 0;
            if (inRangeCells.length) {
                x = inRangeCells[0].x;
                y = inRangeCells[0].y;
                const endCell = inRangeCells[0];
                ctx.lineTo(endCell.x, endCell.y)

            } else {
                x = mousePos.x;
                y = mousePos.y;
            }
            ctx.lineTo(x, y)
            ctx.stroke()
        }
        if (inRangeCells.length) {
            ctx.fillStyle = 'black'
            inRangeCells.forEach(cell => {
                if (cell !== selectedStation)
                    ctx.fillText(cell.features.properties.name, cell.x, cell.y - 10)
            })

        }

        if (selectedStation && inRangeCells.length) {
            if (inRangeCells[0] !== selectedStation) {
                const d = longLatToDist(
                    selectedStation.features.geometry.coordinates,
                    inRangeCells[0].features.geometry.coordinates
                )
                const { x: sx, y: sy } = selectedStation
                const { x: ex, y: ey } = inRangeCells[0];
                const midX = lerp(sx, ex, .5);
                const midY = lerp(sy, ey, .5)
                ctx.fillRect(midX - 11, midY - 6, 22, 12)
                ctx.fillStyle = 'white'

                ctx.fillText(d.toFixed(2), midX, midY);
                showSelections(ctx, [selectedStation, inRangeCells[0]], d)
            }
            ctx.fillStyle = 'black'


        }
        ctx.beginPath()
        ctx.strokeStyle = 'red'
        ctx.arc(mousePos.x, mousePos.y, sensorRadius / 2, 0, Math.PI * 2)
        ctx.stroke()
        grid.forEach(cell => {
            // ctx.strokeStyle = 'black'
            ctx.strokeStyle = cell.fill
            ctx.beginPath()
            ctx.arc(cell.x, cell.y,5,0,Math.PI * 2)
            ctx.stroke()
            // ctx.fillRect(cell.x - 2.5, cell.y - 2.5, 5, 5)
        })

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
