var fs = require('fs');
var geojson2mvt = require('../src');
var json;

//for(var i=0; i<=10; i++){
	//console.log('simpleLines'+i.toString()+'.geojson');
	json = JSON.parse(fs.readFileSync('TX.geojson', "utf8"))
	var options = {
	  layers: {
		layer0: json,
	  },
	  rootDir: 'TX',
	  bbox : [-15.515873,-75.999992,85.80096,0.0], //[south,west,north,east]
	  zoom : {
		min : 0,
		max : 9
	  },
	  tolerance : 6
	};
	console.time('geojson2mvt');
	// build the static tile pyramid
	geojson2mvt(options);
	console.timeEnd('geojson2mvt');
//}
