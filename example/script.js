var fs = require('fs');
var geojson2mvt = require('../src');
var json;

for(var i=0; i<=10; i++){
	console.log('simpleLines'+i.toString()+'.geojson');
	json = JSON.parse(fs.readFileSync('simpleLines'+i.toString()+'.geojson', "utf8"))
	var options = {
	  layers: {
		layer0: json,
	  },
	  rootDir: 'simpleLines',
	  bbox : [-15.515873,-75.999992,85.80096,0.0], //[south,west,north,east]
	  zoom : {
		min : i,
		max : i
	  },
	  tolerance : 6
	};
	console.time('geojson2mvt'+i.toString());
	// build the static tile pyramid
	geojson2mvt(options);
	console.timeEnd('geojson2mvt'+i.toString());
}
