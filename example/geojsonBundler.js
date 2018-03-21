var fs = require('fs');
var frechet = require('frechet');
var geojson2mvt = require('../src');

var json = JSON.parse(fs.readFileSync('simpleLines.geojson', "utf8"));
var features = json.features;
var d;
var newFeatures = [];
var newFeature;
var id;
var coordinates;
var repeat;
var counter;
var newJson;
var fileName; 
var decimalCounter=0.0;
var min=[64666266609];	//Set min to a ridiculous number that can't be a actual coordinate
for(var j=0; j<11;j++){
	console.log("Level " + (10-j).toString());
	d = 1/(Math.pow(2,10-j));
	console.log(d);
	decimalCounter += 0.000001;
	newFeatures = [];
	counter=0;
	repeat = -1;
	var min=[64666266609];
	for(var i=0; i<features.length-1; i++){
		frechetDistance = frechet(features[i].geometry.coordinates, features[i+1].geometry.coordinates);
		if(frechetDistance <= d && frechetDistance!=0){
			//console.log(frechetDistance);
			coordinates = bundle(features[i].geometry.coordinates, features[i+1].geometry.coordinates,min);
			if(repeat>-1)
				id = "RepeatLine"+(repeat+1).toString();
			else
				id = "NewLine"+(counter+1).toString();
			newFeature = {"type":"Feature", "geometry":{"type":"LineString", "coordinates":coordinates}, "properties":{"name":id}};
			if(repeat == -1){
				newFeatures.push(newFeature);
				repeat = counter;
				counter++;
			} else{
				newFeatures[repeat] = newFeature;
			}
			features[i+1] = newFeature;
		} else {
			if(repeat>-1){
				repeat=-1;
				min[0] = 64666266609;
			}
			else
				newFeatures.push(features[i]);
			if(i+1 == features.length-1)
					newFeatures.push(features[i+1]);
		}
	}
	newJson = {"type":"FeatureCollection","features":newFeatures};
	fileName = 'simpleLines'+(10-j).toString()+'.geojson';
	//fileName = 'simpleLines0.geojson';
	fs.writeFileSync(fileName, JSON.stringify(newJson));
	features = newFeatures;
}

//Bundles Trajectories, assuming they are moving along a horizontal plane. 
function bundle(line1, line2,min){
	var c1=0, c2=0;
	var coordinates=[];
	var y=0.0;
	//Merge Coordinates
	while (c1 < line1.length && c2 < line2.length){
		if(min[0] == 64666266609)
			min[0] = line1[c1][1];
		y = (min[0] + line2[c2][1])/2.0;
		if(line1[c1][0] < line2[c2][0]){
			coordinates.push([line1[c1][0],y]);
			c1++;
		}else if(line1[c1][0] > line2[c2][0]){
			coordinates.push([line2[c2][0],y]);
			c2++;
		}else{
			coordinates.push([line1[c1][0],y]);
			c1++;
			c2++;
		}
	}
	//Appending tailing coordinates as they are
	if(c1 < line1.length){
		while(c1 < line1.length){
			coordinates.push([line1[c1][0],line1[c1][1]]);
			c1++;
		}
	} else if(c2 < line2.length){
		while(c2 < line2.length){
			coordinates.push([line2[c2][0],line2[c2][1]]);
			c2++;
		}
	}
	return coordinates;
}
