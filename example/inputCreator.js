var fs = require('fs');
var data = ''; var textArray; var result; var coordinates = [], point=[0.0,0.0], features = []; var feature; var nan;
var readStream = fs.createReadStream('./BestTrackAtlantic.txt', 'utf8');
var minL=0, maxL=0, minH=0, maxH=0;
readStream.on('data', function(chunk) {  
    data += chunk;
}).on('end', function() {
    textArray = data.split(",");
	for(var i=1; i<textArray.length; i++){
		result = textArray[i].substring(0, 4).trim();
		if(result === 'EP' || result === 'CP' || result === 'AL'){
			feature = {"type":"Feature", "geometry":{"type":"LineString", "coordinates":coordinates}, "properties":{"name":textArray[i].trim(), 'density':1}};
			features.push(feature);
			coordinates = [];
		} else{
			nan = isNaN(textArray[i].slice(1,-1).trim());
			//North
			if(textArray[i].slice(-1).trim() == 'N' && !nan){
				point[1] = parseFloat(textArray[i].slice(1, -1).trim());
				if(point[1] > maxH)
					maxH = point[1];
			//South
			} else if(textArray[i].slice(-1).trim() == 'S' && !nan){
				point[1] = parseFloat("-"+textArray[i].slice(1, -1).trim());
				if(point[1] < minH)
					minH = point[1];
			//East
			} else if(textArray[i].slice(-1).trim() == 'E' && !nan){
				point[0] = parseFloat(textArray[i].slice(1, -1).trim());
				//Check if coordinate is actually West
				if(point[0] > 180){
					point[0] -= 360;
					if(point[0] < minL)
						minL = point[0];
				} else {
					if(point[0] > maxL)
						maxL = point[0];
				}
				coordinates.push(point);
				point = [0.0,0.0];
			//West
			} else if(textArray[i].slice(-1).trim() == 'W' && !nan){
				point[0] = parseFloat("-"+textArray[i].slice(1, -1).trim());
				//Check if coordinate is actually East
				if(point[0] < -180){
					point[0] += 360;
					if(point[0] > maxL)
						maxL = point[0];
				} else {
					if(point[0] < minL)
						minL = point[0];
				}
				coordinates.push(point);
				point = [0.0,0.0];
			}
		}
	}
	console.log("Height: " + maxH + "N " + minH + "S");
	console.log("Length: " + maxL + "E " + minL + "W");
	var json= {"type":"FeatureCollection","features":features};
	var fileName = 'BestTrackAtlantic.geojson';
	fs.writeFileSync(fileName, JSON.stringify(json));	
});
