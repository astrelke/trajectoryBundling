var fs = require('fs');
var vtpbf = require('vt-pbf');
var geojsonvt =  require('geojson-vt');
var simplify = require('simplify-geojson')

var helpers = require('./helpers.js');


var geojson2mvt = function(options) {
    if (arguments.length == 2) {
     // var geoJson = options;
	  geoJson = simplify(geojson, tolerance);
      options = arguments[1];
      options.layers = {};
      options.layers[options.layerName] = geoJson;
    }
	//console.log(options.layers.layer0.features[0].geometry.coordinates);
    var layerNames = Object.keys(options.layers);
    var i = 0, ii = layerNames.length;
    var tileIndex = new Array(ii);
    for (; i < ii; ++i) {
		//console.log(layerNames[i]);
        tileIndex[i] = geojsonvt(options.layers[layerNames[i]], {
            maxZoom: options.zoom.max,
            indexMaxZoom: options.zoom.max,
            indexMaxPoints: 0
        });
    }
	//console.log(tileIndex[0]);
	
    // create the "root directory" to place downloaded tiles in
    try {fs.mkdirSync(options.rootDir, 0777);}
    catch(err){
        if (err.code !== 'EEXIST') callback(err);
    }
    var tileCount = 0,
	nonemptyCount = 0,
      tileCoords = {},
      tileBounds;

    for(var z=options.zoom.min; z<=options.zoom.max; z++) {

        //create z directory in the root directory
        var zPath = `${options.rootDir}/${z.toString()}/`;
        try{ fs.mkdirSync(zPath, 0777) }
        catch (err){
            if (err.code !== 'EEXIST') callback(err);
        }

        // get the x and y bounds for the current zoom level
        var tileBounds = helpers.getTileBounds(options.bbox, z);

        // x loop
        for(var x=tileBounds.xMin; x<=tileBounds.xMax; x++) {

            // create x directory in the z directory
            var xPath = zPath + x.toString();
            try{ fs.mkdirSync(xPath, 0777) }
            catch (err){
                if (err.code !== 'EEXIST') callback(err);
            }


            // y loop
            for(var y=tileBounds.yMin; y<=tileBounds.yMax; y++) {

                var mvt = getTile(z, x, y, tileIndex, layerNames);

                // TODO what should be written to the tile if there is no data?
                var output = mvt !== null ? mvt : '';
				if(output!==''){
					nonemptyCount++;
				}
                fs.writeFileSync(`${xPath}/${y}.mvt`, output);
                tileCount++;
            }
        }
    }
};




 function getTile(z, x, y, tileIndex, layerNames) {
   var pbfOptions = {};
   for (var i = 0, ii = tileIndex.length; i < ii; ++i) {
       var tile = tileIndex[i].getTile(z, x, y);

       if (tile != null) {
           pbfOptions[layerNames[i]] = tile;
       }

   }

   return Object.keys(pbfOptions).length ?
      vtpbf.fromGeojsonVt(pbfOptions) :
      null;
};


module.exports = geojson2mvt;
