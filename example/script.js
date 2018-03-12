var fs = require('fs');
var geojson2mvt = require('../src');

var json = JSON.parse(fs.readFileSync('simpleLines0.geojson', "utf8"))
//var simplify = require('simplify-geojson')
//var simplified = simplify(json, 0.1)

var options = {
  layers: {
    layer0: json,
  },
  rootDir: 'simpleLines',
  bbox : [-15.515873,-71.999992,85.80096,-66.0], //[south,west,north,east]
  zoom : {
    min : 0,
    max : 0
  },
  tolerance : 6
};
console.time('geojson2mvt');
// build the static tile pyramid
geojson2mvt(options);
console.timeEnd('geojson2mvt');
