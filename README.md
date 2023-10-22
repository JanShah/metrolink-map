# Metro Map

Metro map of Manchester with editor to add connections and path finder to map route from start to destination

## Instructions

To see the app, run it in a web server.

### Navigating the page

When the page loads, you are presented with the map of all stops.  Move the mouse around the map and you will see
a black circle around the cursor. Any station in the range of this circle will be highlighted red.  Move the circle over the smaller circles to see the station name.
If you scroll up with your mouse, you will zoom into the map. If you scroll down, you will zoom out.The minimum scale is 1, but you can zoom in as much as you like.  To move the canvas, click and hold the left mouse button away from the range of any circles and move the mouse around.  It is a bit shaky but will move.

### Adding and removing map links

To add a link from one station to the other, click and hold the left mouse button when hovered over a station, drag the mouse to a destination station and let go.  A new link will be created and saved.  All the existing links are actual connections and can only be removed in the data file.  To remove any newly created links, click the button labelled 'clear edits'.  This will restore the original map.

### Point-to-point naviagation

To find a route from one point to another, click the button labelled 'Follow path'.  The button will turn green when active.

If the button is green, click and hold the left mouse key when hovered over a station and drag the mouse to the destination.  When you can see the destination circle in red, let go of the left mouse button.  A route to the destination will be shown.

To clear the current navigation, click the mouse button anywhere near the map.  You can also directly choose another point, which also clears the navigation.

### Closest stations

To find the two closest stations that are connected, click on the button labelled 'Find closest stations'. The two closest on the map will be displayed.
