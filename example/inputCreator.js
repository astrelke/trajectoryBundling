var fs = require('fs');
var data = ''; var textArray; var result; var coordinates = [], point=[0.0,0.0], features = []; var feature; var nan;
var readStream = fs.createReadStream('./BestTrackAtlantic.txt', 'utf8');
readStream.on('data', function(chunk) {  
    data += chunk;
}).on('end', function() {
    textArray = data.split(",");
	for(var i=1; i<textArray.length; i++){
		result = textArray[i].substring(0, 4).trim();
		if(result === 'EP' || result === 'CP' || result === 'AL'){
			console.log(result);
			feature = {"type":"Feature", "geometry":{"type":"LineString", "coordinates":coordinates}, "properties":{"name":textArray[i].trim()}};
			features.push(feature);
			coordinates = [];
		} else{
			nan = isNaN(textArray[i].slice(1,-1).trim());
			if(textArray[i].slice(-1).trim() == 'N' && !nan){
				point[1] = parseFloat(textArray[i].slice(1, -1).trim());
			} else if(textArray[i].slice(-1).trim() == 'W' && !nan){
				point[0] = parseFloat("-"+textArray[i].slice(1, -1).trim());
				coordinates.push(point);
				point = [0.0,0.0];
			}
		}
	}
	var json= {"type":"FeatureCollection","features":features};
	var fileName = 'BestTrackAtlantic.geojson';
	fs.writeFileSync(fileName, JSON.stringify(json));	
});
