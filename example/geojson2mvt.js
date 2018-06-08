var fs = require('fs');
var geojson2mvt = require('../src');
var json;

var myArgs=[];
//Get command line arguments
if(process.argv.length < 8){
	console.log("Please enter the following parameters: path_to_geojson_root southBounds westBounds northBounds eastBounds levels"); 
	process.exit();
}
for(var i=2;i<process.argv.length;i++){
	myArgs.push(process.argv[i]);
}
if(isNaN(myArgs[1]) || isNaN(myArgs[2]) || isNaN(myArgs[3]) || isNaN(myArgs[4]) || isNaN(myArgs[5])){
	console.log("Invalid Parameters: Please enter numerical values for bbox coordinates and 'level' parameters");
	process.exit();
}

//Get start and end index of root directory name
var start = myArgs[0].lastIndexOf("/")+1;
if(start < 0) start = 0;
var end = myArgs[0].length;
//Create vector tiles for each level
for(var i=0; i<=parseInt(myArgs[5]); i++){
	json = JSON.parse(fs.readFileSync(myArgs[0]+'('+i+').geojson', "utf8"));
	var options = {
	  layers: {
		layer0: json,
	  },
	  rootDir: "Tiles/"+myArgs[0].substring(start,end),
	  //bbox : [0,-110,81,63], //[south,west,north,east]
	  bbox : [parseFloat(myArgs[1]),parseFloat(myArgs[2]),parseFloat(myArgs[3]),parseFloat(myArgs[4])],	//[south,west,north,east]
	  zoom : {
		min :i,
		max :i
	  },
	  tolerance : 0
	  //tolerance : myArgs[6]
	};
	console.time('geojson2mvt'+i.toString());
	// build the static tile pyramid
	geojson2mvt(options);
	console.timeEnd('geojson2mvt'+i.toString());
}


/*
json = JSON.parse(fs.readFileSync('geojson/Zone19/Zone19_2011_01(14).geojson', "utf8"));
	var options = {
	  layers: {
		layer0: json,
	  },
	  rootDir: "Tiles/ZoneTest",
	  //bbox : [0,-110,81,63], //[south,west,north,east]
	  bbox : [0, -73, 85, -63],	//[south,west,north,east]
	  zoom : {
		min :0,
		max :8
	  },
	  tolerance : 0
	  //tolerance : myArgs[6]
	};
	//console.time('geojson2mvt'+i.toString());
	// build the static tile pyramid
	geojson2mvt(options);
	//console.timeEnd('geojson2mvt'+i.toString());
	*/
