/* TRACULUS Algorithm: 
	First introduced by Jae-Gil Lee, Jiawei Han, and Kyu-Young Whang
	http://hanj.cs.illinois.edu/pdf/sigmod07_jglee.pdf
*/
require('process');

//Global Variables
var coefficient;
var projPoint;
var prevParLength=0;
//Get command line arguments
var myArgs=[];
if(process.argv.length < 7){
	console.log("Please enter the following parameters: path_to_geojson eps Y costAdv levels"); 
	process.exit();
}
for(var i=2;i<process.argv.length;i++){
	myArgs.push(process.argv[i]);
}
if(isNaN(myArgs[1]) || isNaN(myArgs[2]) || isNaN(myArgs[3]) || isNaN(myArgs[4])){
	console.log("Invalid parameters: Please enter numerical values for 'eps', 'Y', 'costAdv', and 'levels'");
	process.exit();
}
init();

/*Setup Function*/
function init(){
	var fs = require('fs');
	var T, features,result,ids=[],bundledTrajectories=[],tempIds;
	var feature,json,newJson,Tobj;
	var e,Y,costAdv;
	var start = true;
	var MinLns,trNum;
	var fileName,trName;
	
	//Bundle trajectories from bottom level up
	for(var level=parseInt(myArgs[4]); level >=0; level--){
		console.log("Level: " + level);
		T=[];
		features=[];
		trNum=1;
		//Determine input file
		if(start) json = JSON.parse(fs.readFileSync(myArgs[0], "utf8"));	
		else json = JSON.parse(fs.readFileSync(insertFileNumber(myArgs[0],level+1), "utf8"));	
		json.features.forEach(function(feat){
			/*Create a different property for each voyageID
			This is done because MapboxGL does not support regex or array
			filtering yet, so voyageIDs have to be located via key 
			using the 'has' filter. Used for linked highlighting.
			*/
			if(start){ 
				tempIds = feat.id.slice(1,-1).split(","); 
				ids.push("|" + tempIds[0] + "_" + tempIds[1] + "|"); 
				bundledTrajectories = [];
				//Create trajectory name
				trName = "|" + level.toString() + "_" + trNum.toString() + "|";
				trNum++;
			} else{
				ids = feat.properties.voyageIDs.split(",");		
				trName = feat.properties.name;
				//Check to see if any child trajectories exist
				if(level >= parseInt(myArgs[4])-1) bundledTrajectories = [];
				else bundledTrajectories = feat.properties.bundledTrajectories.split(",");
			}
			//Create trajectory object
			Tobj = {"name": trName, "coordinates":feat.geometry.coordinates,"density":ids.length,"weight":1,"voyageIDs":ids,"bundledTrajectories":bundledTrajectories};
			ids=[];
			//Get voyageID property keys
			T.push(Tobj);
		});
		//Calculate parameters for current level
		e = parseFloat(myArgs[1]) / Math.pow(2,level);
		MinLns = 1.0;	//Works best if MinLns is kept at one, otherwise some trajectories will become lost
		Y = parseFloat(myArgs[2])/ Math.pow(2,level);
		costAdv =  parseFloat(myArgs[3]) / Math.pow(2,level);
		//Run TRACLUS 
		if(start) result = T;
		else result = TRACULUS(T,e,MinLns,costAdv,Y,level);			
		//Create array of GEOJSON feature objects
		for(var i=0;i<result.length;i++){
			feature = {"type":"Feature", "geometry":{"type":"LineString", "coordinates":result[i].coordinates}, 
			"properties":{"name":result[i].name,"density":result[i].density,"weight":result[i].weight, 
			"voyageIDs":result[i].voyageIDs.toString().replace(/\s+/g,''), "bundledTrajectories": result[i].bundledTrajectories.toString().replace(/\s+/g,'')}}; 
			features.push(feature);
		}
		//Output GEOJSON
		fileName = insertFileNumber(myArgs[0],level);
		newJson = {"type":"FeatureCollection","features":features};
		fs.writeFileSync(fileName, JSON.stringify(newJson));	
		//console.log(fileName);
		start = false;
	}
}


/* TRACULUS
	Inputs (T: Trajectories)
	Output (R: Representative Trajectory) 
*/
function TRACULUS(T,e,MinLns,costAdv,Y,level){
	/*Variables
		Arrays (
			D: Set of line segments
			O: Set of clustered lines
			R: Array of Representative Trajectories
		)
		Objects (RTR: Representative Trajectory)
		Integers (i: Trajectory Index)
	*/
	var D=[],O=[],R=[]; var RTR;
	/* Partition Phase */
	//01: Loop through each trajectory tr
	//console.log("Paritioning Phase Started");
	T.forEach(function(tr) {
		//02 & 03: Get a set L of line segments and Accumulate L into a set D
		ApproximateTrajectoryParitioning(tr,D,Y,costAdv); 
	});	
	//Same trajectories as last levels
	if(D.length == prevParLength) return R;
	prevParLength = D.length;
	//console.log("Paritioning Phase Complete");
	/* Grouping Phase */
	//console.log("Grouping Phase Started");
	//04: Get a set O of clusters
	O = LineSegmentClustering(D,e,MinLns);
	//console.log("Clusters Generated");
	//05: Loop through each cluster c
	var i=1; var trName;
	var originalTrajectory, newTrajectory;
	//var maxDensity=0;
	O.forEach(function(C) {
		//06: Get a represenative trajectory
		trName = "|" + level.toString() + "_" + i.toString() + "|";
		RTR = RepresentativeTrajectoryGeneration(C,MinLns,Y,trName);
		if(RTR.coordinates.length>1){
			R.push(RTR);
			console.log("Representative Trajectory: " + RTR.name);
			console.log("Voyage Length: " + RTR.voyageIDs.length);
			i++;
		}
	});
	console.log("Bundle Size: " + R.length);
	//console.log("Grouping Phase Complete");
	return R;
} 

/* Approximate Trajectory Paritioning
	Inputs 
		(tr: Trajectory, 
		i: Trajectory Index, 
		D: Set of line segments,
		costAdv: Used to prevent oversimplification of line segment partitioning, 
		MinLns: Minimum length of paritioned line segment)
	Output (D: Set of line segments) 
*/
function ApproximateTrajectoryParitioning(tr,D,Y,costAdv){
	/*Variables
		Arrays (
			line: Partitioned line segment
		)
		Integers (
			startIndex: line index specifying start of partitioned line segment
			len: length of partitioned line segment
			currIndex: line index specifying end of partitioned line segment
		)
		Floats (
			costPar: MDL cost of partitioned line segment
			costNopar: MDL cost of original line 
		)
	*/
	var line=[]; var startIndex=1,len=1,currIndex,counter=1; var costPar,costNopar,angle; var Dobj;
	var diff;
	line.push(tr.coordinates[0]); //The starting point
	//Iterate while there exist a partitioning in the line segment
	for(;;){
		costPar = costNopar = 0;
		for (len = 1; startIndex+len < tr.coordinates.length; len++){
			currIndex = startIndex+len;
			if(getDistance(tr.coordinates[startIndex], tr.coordinates[currIndex]) < Y)
				continue;
			costPar = MDLpar(tr.coordinates, startIndex, currIndex);
			costNopar += MDLnopar(tr.coordinates, currIndex-1, currIndex);
			diff = costPar - costNopar;
			//check if partitioning at the current point makes
			//the MDL cost larger than not partitioning
			if(costPar + costAdv > costNopar){
				//partition at this point
				line.push(tr.coordinates[currIndex-1]);
				angle = calcLineAngle(line);
				Dobj = {"L":line,"index": D.length, "trajectory":tr.name,"clusterId":0,"classified":false,"noise":false,"density":tr.density,"voyageIDs": tr.voyageIDs,"bundledTrajectories":tr.bundledTrajectories,"angle":angle};
				D.push(Dobj);
				line = [];
				line.push(tr.coordinates[currIndex-1]);
				startIndex = currIndex;
				len = 0;
				break;
			} 
		}
		if(startIndex+len >= tr.coordinates.length) break;
	}
	line.push(tr.coordinates[tr.coordinates.length-1]);
	angle = calcLineAngle(line);
	Dobj = {"L":line,"index": D.length, "trajectory":tr.name,"clusterId":0,"classified":false,"noise":false,"density":tr.density,"voyageIDs":tr.voyageIDs, "bundledTrajectories":tr.bundledTrajectories,"angle":angle};
	D.push(Dobj);
}

/* Line Segment Clustering
	Inputs 
		(D: Set of line segments, 
		e:epslion value, 
		MinLns: Minimum number of neighbors in cluster, MinClus: Min number of trajectories in cluster)
	Output (O: Set of clusteres) 
*/
function LineSegmentClustering(D,e,MinLns,MinClus){
	/*Variables
		Arrays (
			tempD: Temporary place holder for D
			tempC: Temporary place holder for C
			C: Set of possible clusters
			N: Set of neighboring points
			Q: Queue of neighboring points to expand upon
			O: Set of clustered line segments
		)
		Integers (
			clusterId: Cluster index
		)
	*/
	var tempD,tempC,C=[],N,O=[]; var clusterId = 0; 
	/*Step 1:*/
	for(var i=0; i<D.length;i++){ 
		if(!D[i].classified){
			//Compute N(L) and predict clusters, where L=D[i]
			tempD = D.slice(); tempC = C.slice(); 
			N = Ne1(tempD,i,e,tempC,clusterId);
			if(N.density >= MinLns){
				//Assign all points in neighborhood to cluster
				D = tempD.slice();
				C = tempC.slice();;
				/*Step 2*/
				ExpandCluster(N,D,C,clusterId,e,MinLns);
				clusterId++; /*a new id */
			} else D[i].noise = true;
		}
	}
	/* check the trajectory cardinality */
	C.forEach(function(c){
		/*Calculate trajectory cardinality and compare with threshold
		a threshold other than MinLns can be used*/
		var ptr = PTR(c);
		if(ptr >= MinLns) O.push(c);	//Add C to set of clusters O
	});
	return O;
}

/*Compute a Density-Connected Set and Insert New Points into Respective Cluster 
	Inputs 
		(Q: Queue of neighboring points to be expanded upon, 
		D: Set of line segments, 
		C: Set of clusters,
		clusterId: id of cluster
		e: epslion value, 
		MinLns: Minimum number of vertical line intersections)
	Output (C: Expanded set of clusters) 
*/
function ExpandCluster(Q,D,C,clusterId,e,MinLns){
	/*Variables
		Arrays (N: Set of new found neighboring points)
	*/
	var N;
	while(Q.length > 0){
		//Compute N(L), where L=Q[0]
		N = Ne2(Q,0,e);
		if(N.density >= MinLns){
			N.lines.forEach(function(X){		//For each neighboring line X
				//Assign clusterId to X
				if(!X.classified || X.noise){
						if(!X.classified) Q.push(X);	//Insert X into queue Q
					X.clusterId = clusterId;
					X.classified = true;
					X.noise = false;
					C[clusterId].push(X);
					D[X.index] = X;
				}
			});
		}
		Q.shift();
	}
}


/*Representative Trajectory Generation
	Inputs 
		(C: Set of clustered line segments, 
		MinLns: Minimum number of intersections allowed for point to be added to represenative trajectory, 
		Y=Smoothing value)
	Output (RTR: A representative trajectory) 
*/
function RepresentativeTrajectoryGeneration(C,MinLns,Y,trName){
	/*Variables
		Arrays (
			V: Average distance vector
			v2: Line segment in cluster C rotated along X'-axis
			C2: Set of rotated clustered line segments
			P: The set of the starting and ending points of the line segments in C along the X'-axis
			sweepLine: Verticle line along the X'-axis that passes through a point in P
			intersects: Set of intersection coordinates
			pAvg: Average Coordinate along X-axis
			pAvg2: Average Coordinate along X'-axis
			RTR: Representative Trajectory for cluster C
		)
		Objects {
			intersect: Contains coordinates of intersection between a line segment and the sweep line
		}
		Integer(
			i: Index specifying location of point in P
			j: Loop counter
			pNum: The number of line segments that contains the X'-value of the point p
		)
		Floats(
			x1: Sum of starting point x-values
			x2: Sum of ending point x-values
			y1: Sum of starting point y-values
			y2: Sum of ending point y-values
			angle: Angle in which to rotate X-axis so that it becomes parallel to V. Resulting axis is denoted as X'-axis
			diff: The difference in X'-values between p and its immediately previous point 
			xPrev: The x-value of the immediately previous point
			y: Sum of intersecting points Y'-values
		)
	*/
	var V,v2,C2=[],P=[], voyageIDs,sweepLine,intersects;
	var intersect,pAvg,pAvg2,RTR={"name":trName, "coordinates":[],"density":0,"weight":0,"voyageIDs":[],"bundledTrajectories":[]};
	var i=0, j=0,pNum=0,density=0;
	var x1=0.0,x2=0.0,y1=0.0,y2=0.0,angle,diff,xPrev=0.0,y=0.0;
	var lineIntersection = require('line-intersection');
	//Get cluster information such as total directional coordinates, density, and voyageIDs
	C.forEach(function(v){
		x1 += v.L[0][0]*v.density; x2 += v.L[1][0]*v.density; y1 += v.L[0][1]*v.density; y2 += v.L[1][1]*v.density;
		density += v.density;
		//Get voyageIDs
		voyageIDs = v.voyageIDs;
		voyageIDs.forEach(function(id){
			if(!(RTR.voyageIDs.includes(id))) RTR.voyageIDs.push(id);
		});
		if(!(RTR.bundledTrajectories.includes(v.trajectory))) {
			RTR.bundledTrajectories.push(v.trajectory);
			if(v.bundledTrajectories.length > 0) RTR.bundledTrajectories = RTR.bundledTrajectories.concat(v.bundledTrajectories); 
		}
	});
	RTR.density = RTR.voyageIDs.length;
	//console.log(RTR.bundledTrajectories);
	//console.log();
	//Remove duplicate child trajectories
	
	for(var a=0; a<RTR.bundledTrajectories.length; ++a){
		for(var b=a+1; b<RTR.bundledTrajectories.length; ++b){
			if(RTR.bundledTrajectories[a] === RTR.bundledTrajectories[b]) 
				RTR.bundledTrajectories.splice(b--,1);
		}
	}
	/*Calculate weight of represenative trajectory. 
	* Unlike density, weight is used as the line width value
	*/
	if(RTR.density > 128){
		RTR.weight = 5.0;
	} else {
		RTR.weight = RTR.density/32 + 1.0;
	}
	//Compute average direction vector V
	V = [[x1/density,y1/density],[x2/density,y2/density]];
	//Calculate angle in which to rotate X axis
	angle = angleBetween2Lines(V[0],[V[1][0],V[0][1]],V[0],V[1]);
	//X'-value denotes the coordinate of the X' axis
	var p0;
	C.forEach(function(v){
		//Rotate vector and add to rotated cluster C2
		v2 = rotateVector(v,angle);
		C2.push(v2);
		//If end point is before start point on X'-axis, swap points
		if(v2.L[1][0] < v2.L[0][0]) { p0 = [v2.L[1],v2.L[0]];}
		else { p0 = [v2.L[0], v2.L[1]] }
		//Sort the points in the set P by their X'-values
		while(i <= P.length && j < 2){
			if(i==P.length){
				if(j==0){ P.push(p0[0]); P.push(p0[1]); } 		//Push both points 
				else if(j==1) P.push(p0[1]);					//Push second point
				else console.log("ERROR");						//Error
				j=2;
			}else{
				if(v2.L[j][0] < P[i][0]){ P.splice(i, 0, p0[j]); j++; }	//Append point in order of its X'-axis position
			}
			i++;
		}
		//Reset indicies
		i=0; j=0;
	});
	//console.log(P);
	i=0;
	P.forEach(function(p){
		//Count pNum using a sweep line (or plane) 
		sweepLine = [[p[0],85],[p[0],-85]];
		intersects=[];
		C2.forEach(function(v){
			if((v.L[0][0] <= p[0] && v.L[1][0] >= p[0]) || (v.L[0][0] >= p[0] && v.L[1][0] <= p[0])){
				intersect = lineIntersection.findIntersection([{x: v.L[0][0], y: v.L[0][1]}, {x: v.L[1][0], y: v.L[1][1]}, 
					{x: sweepLine[0][0], y: sweepLine[0][1]}, {x: sweepLine[1][0], y: sweepLine[1][1]}]);
				if(!(isNaN(intersect.x) || isNaN(intersect.y)))	{	//Check if intersection exisits 
					pNum+=v.density;
					intersects.push({"coordinate":[intersect.x,intersect.y],"density":v.density});
				}
			}
		});
		if(pNum >= MinLns && pNum > 0){
			//Compute diff
			diff = Math.abs(p[0] - xPrev);
			if(diff >= Y){
				xPrev = p[0];
				//Compute the average coordinate pAvg2
				intersects.forEach(function(intxn){ y += intxn.coordinate[1]; });
				pAvg2 = [p[0], y/intersects.length];
				//Undo the rotation and get the point pAvg2
				pAvg = rotatePoint(pAvg2,angle);
				//Append Pavg to the end of RTRi
				RTR.coordinates.push(pAvg);
			}
		}
		//Reset values
		i++;
		y=0.0; pNum=0;
	});	
	return RTR;
}

/*
	Utility Functions
*/
/*Numbers output files*/
function insertFileNumber(str,num){
	var n = str.lastIndexOf(".");
	if (n < 0) return str;
	return str.substring(0,n) + "(" + num.toString() + ").geojson";
}
/*Get MDL cost with partition*/
function MDLpar(tr, startIndex, currIndex){
	var H=0, D_H=0;
	var angularDistance=0.0, perpDistance=0.0;
	//Calc L(H)
	H = MDLnopar(tr, startIndex, currIndex);
	//Calc L(D|H)
	for(var i=startIndex; i<currIndex; i++){
		//Calc perpendicular distance
		perpDistance = calcPerpDistance([tr[startIndex],tr[currIndex]],[tr[i],tr[i+1]]);
		//Calc angular distance
		angularDistance = calcAngularDistance([tr[startIndex],tr[currIndex]],[tr[i],tr[i+1]]);
		if(perpDistance < 1.0) perpDistance = 1.0;
		if(angularDistance < 1.0) angularDistance = 1.0;
		D_H += Math.log2(perpDistance) + Math.log2(angularDistance);
	}
	
	
	return D_H + H;
}
/*Get MDL cost with no partition*/
function MDLnopar(tr, startIndex, currIndex){
	var H=0;
	var d=0.0;
	//Calc L(H)
	d = getDistance(tr[startIndex],tr[currIndex]);
	if(d < 1.0) d = 1.0;	//for logarithmic function
	return Math.log2(d);
}
/*Participating Trajectories Function*/
function PTR(C){
	var repeat=[];
	var ptr=0;
	for(var i=0;i<C.length;i++){
		if(!repeat.includes(C[i].trajectory)){
			ptr+=C[i].density;
			repeat.push(C[i].trajectory);
		}
	}
	return ptr;
}

/*
	Distance Calculations
*/
/*Get distance between two points*/
function getDistance(p1,p2){
	var v = [];
	v.push(p2[0]-p1[0]);
	v.push(p2[1]-p1[1]);
	return Math.sqrt(v[0]*v[0] + v[1]*v[1]);
}
/*Calculate Perpendicular Distance*/
function calcPerpDistance(Li,Lj){
	//Calculate euclidean Distance
	var l1 = getDistanceFromPointToLineSegment(Li,Lj[0]);
	var l2 = getDistanceFromPointToLineSegment(Li,Lj[1]);
	if(l1 == 0.0 && l2 == 0.0) return 0.0;
	//Return perpendicular distance
	return ((Math.pow(l1,2) + Math.pow(l2,2)) / (l1+l2));
}
/*Calculate Angular Distance*/
function calcAngularDistance(Li,Lj){
	var len1,len2,angle;
	var p1 = [Li[1][0]-Li[0][0], Li[1][1]-Li[0][1]];
	var p2 = [Lj[1][0]-Lj[0][0], Lj[1][1]-Lj[0][1]];
	//get vector length
	len1 = computeLength(p1);
	len2 = computeLength(p2);
	if(len1 == 0.0 || len2 == 0.0) return 0.0;
	var innerProduct = computeInnerProduct(p1,p2);
	var cosTheta = innerProduct / (len1 * len2);
	if(cosTheta > 1.0) cosTheta = 1.0;
	if (cosTheta < -1.0) cosTheta = -1.0;
	var sinTheta = Math.sqrt(1-Math.pow(cosTheta,2));
	return (len2 * sinTheta);
}
//Compute length of vector
function computeLength(p){
	var sum=0.0;
	sum += Math.pow(p[0],2);
	sum += Math.pow(p[1],2);
	return Math.sqrt(sum);
}
//Get distance between a line segment and a point
function getDistanceFromPointToLineSegment(v, p){
	var p1 = [p[0]-v[0][0], p[1]-v[0][1]];
	var p2 = [v[1][0]-v[0][0], v[1][1]-v[0][1]];
	var numerator;
	//Calculate coefficient
	numerator = computeInnerProduct(p1,p2)
	if(numerator == 0) coefficient = 0;
	else coefficient = numerator / computeInnerProduct(p2,p2);
	//Calculate projection point
	var x = v[0][0] + (coefficient * p2[0]);
	var y = v[0][1] + (coefficient * p2[1]);
	//projPoint is a global variable
	projPoint = [x,y];
	var d = getDistance(p,projPoint);
	return d;
}
//Dot Product Calculation
function computeInnerProduct(p1,p2){
	var innerProduct = 0.0;
	innerProduct += (p1[0] * p2[0]);
	innerProduct += (p1[1] * p2[1]);
	return innerProduct;
}
/*Distance function described in text*/
function dist(Li,Lj){
	var perpDistance,paraDistance, angleDistance;
	var perpDistance1,perpDistance2,paraDistance1,paraDistance2,len1,len2;
	//Compute Perpendicular Distance
	len1 = getDistance(Li[0],Li[1]);
	len2 = getDistance(Lj[0],Lj[1]);
	if(len1 > len2){
		perpDistance1 = getDistanceFromPointToLineSegment(Li,Lj[0]);
		if(Math.abs(coefficient) < 0.5) paraDistance1 = getDistance(Li[0], projPoint);
		else paraDistance1 = getDistance(Li[1],projPoint);
		perpDistance2 = getDistanceFromPointToLineSegment(Li,Lj[1]);
		if(Math.abs(coefficient) < 0.5) paraDistance2 = getDistance(Li[0], projPoint);
		else paraDistance2 = getDistance(Li[1],projPoint);
	} else {
		perpDistance1 = getDistanceFromPointToLineSegment(Lj,Li[0]);
		if(Math.abs(coefficient) < 0.5) paraDistance1 = getDistance(Lj[0], projPoint);
		else paraDistance1 = getDistance(Lj[1],projPoint);
		perpDistance2 = getDistanceFromPointToLineSegment(Lj,Li[1]);
		if(Math.abs(coefficient) < 0.5) paraDistance2 = getDistance(Lj[0], projPoint);
		else paraDistance2 = getDistance(Lj[1],projPoint);
	}
	if(!(perpDistance1 == 0.0 && perpDistance2 == 0.0)){
		perpDistance = ((Math.pow(perpDistance1,2) + Math.pow(perpDistance2,2))/(perpDistance1+perpDistance2));
	} else {
		perpDistance = 0.0;
	}
	//Compute Parallel Distance
	paraDistance = (paraDistance1 < paraDistance2) ? paraDistance1 : paraDistance2;
	//Compute Angle Distance
	if(len1 > len2)
		angleDistance = calcAngularDistance(Li,Lj);
	else
		angleDistance = calcAngularDistance(Lj,Li);
	
	return (perpDistance + paraDistance + angleDistance);
}

/*
	Angle Calculations
*/
/*Calculate Line Angle*/
function calcLineAngle(L){
	var dy = L[1][1] - L[0][1];
	var dx = L[1][0] - L[0][0];
	var theta = Math.atan2(dy,dx);
	theta = toDegrees(theta);
	if(theta < 0) theta += 360;
	return theta;
}
/*Calculate Angular Distance Between two lines*/
function angleBetween2Lines(a1, a2, b1, b2) {
    var angle1 = Math.atan2(a2[1] - a1[1], a1[0] - a2[0]);
    var angle2 = Math.atan2(b2[1] - b1[1], b1[0] - b2[0]);
    var calculatedAngle = toDegrees(angle1 - angle2);
    if (calculatedAngle < 0) calculatedAngle += 360;
    return calculatedAngle;
}
/*Convert radians to degrees*/
function toDegrees(angle) {
  return angle * (180 / Math.PI);
}
/*Determine if angle n is between angles a and b*/
function angle_between(n,a,b){
	n = (360 + (n%360)) % 360;
	a = (3600000 + a) % 360;
	b = (3600000 + b) % 360;
	if(a < b) return a <= n && n <= b;
	return a <= n || n <= b;
}

/*
	ε-Neighborhood Functions
*/
/*ε-Neighborhood Function 1 - assigns lines to predicted cluster during computation*/
function Ne1(D,index,e,C,clusterId){
	var N = {"density":0,"lines":[]};
	var stop=true;
	var startAngle, endAngle, reverseStartAngle, reverseEndAngle;
	C[clusterId] = [];
	//Assign cluster id to L
	D[index].clusterId = clusterId;
	D[index].classified = true;
	D[index].noise = false;
	C[clusterId].push(D[index]);
	N.density += D[index].density;
	startAngle = D[index].angle - 25;
	endAngle = D[index].angle + 25;
	if(startAngle <= 0) startAngle += 360;
	if(endAngle > 360) endAngle -= 360;
	reverseStartAngle = startAngle + 180;
	reverseEndAngle = endAngle + 180;
	if(reverseStartAngle > 360) reverseStartAngle -= 360;
	if(reverseEndAngle > 360) reverseEndAngle -= 360;
	for(var i=0; i<D.length; i++){
		//Add line to cluster if: 1) Line is not the same as inital line. 2) Line is not classified. 3) Line angle is within a 45 degree quadrant of inital line
		if(i != index && !D[i].classified
		&& (angle_between(D[i].angle,startAngle,endAngle) || angle_between(D[i].angle,reverseStartAngle,reverseEndAngle))){
			//Get distance
			var d = dist(D[index].L,D[i].L);
			//Add line if distance is less than or equal to e
			if(d <= e){
				//Assign cluster id to new line in cluster
				D[i].clusterId = clusterId;
				D[i].classified = true;
				D[i].noise = false;
				C[clusterId].push(D[i]);
				N.density += D[i].density;
				N.lines.push(D[i]);
			}
		}
	}
	return N;
}
/*ε-Neighborhood Function 2 - Simple neighborhood function, no assigment of cluster*/
function Ne2(D,index,e){
	var N = {"density":0,"lines":[]};
	var startAngle, endAngle, reverseStartAngle, reverseEndAngle;
	startAngle = D[index].angle - 22;
	endAngle = D[index].angle + 22;
	if(startAngle <= 0) startAngle += 360;
	if(endAngle > 360) endAngle -= 360;
	reverseStartAngle = startAngle + 180;
	reverseEndAngle = endAngle + 180;
	if(reverseStartAngle > 360) reverseStartAngle -= 360;
	if(reverseEndAngle > 360) reverseEndAngle -= 360;
	for(var i=0; i<D.length; i++){
		//Add line to cluster if: 1) Line is not the same as inital line. 2) Line is not classified. 3) Line angle is within a 45 degree quadrant of inital line
		if(i != index && !D[i].classified
		&& (angle_between(D[i].angle,startAngle,endAngle) || angle_between(D[i].angle,reverseStartAngle,reverseEndAngle))){
			//Get distance
			var d = dist(D[index].L,D[i].L);
			//Add line if distance is less than or equal to e
			if(d <= e){
				N.density += D[i].density;
				N.lines.push(D[i]);
			}
		}
	}
	return N;
}

/*
	Matrix Rotation Calculations
*/
/*Rotate vector counter-clockwise*/
function rotateVector(v,angle){
	var x1, x2, y1, y2;
	var radians = (Math.PI / 180) * -angle;
	x1 = v.L[0][0]*Math.cos(radians) - v.L[0][1]*Math.sin(radians); 
	x2 = v.L[1][0]*Math.cos(radians) - v.L[1][1]*Math.sin(radians); 
	y1 = v.L[0][0]*Math.sin(radians) + v.L[0][1]*Math.cos(radians); 
	y2 = v.L[1][0]*Math.sin(radians) + v.L[1][1]*Math.cos(radians);
	var obj = {"L":[[x1,y1],[x2,y2]],"trajectory":v.trajectory,"clusterId":v.clusterId,"classified":v.classified,"noise":v.noise,"density":v.density, "voyageIDs":v.voyageIDs, "bundledTrajectories":v.bundledTrajectories};
	return obj;
}
/*Rotate matrix counter-clockwise*/
function rotateMatrix(m,angle){
	var m2
	var x1, x2, y1, y2;
	var radians = (Math.PI / 180) * -angle;
	x1 = m[0][0]*Math.cos(radians) - m[0][1]*Math.sin(radians); 
	x2 = m[1][0]*Math.cos(radians) - m[1][1]*Math.sin(radians); 
	y1 = m[0][0]*Math.sin(radians) + m[0][1]*Math.cos(radians); 
	y2 = m[1][0]*Math.sin(radians) + m[1][1]*Math.cos(radians);
	return [[x1,y1],[x2,y2]];
}

/*Rotate point clockwise*/
function rotatePoint(p,angle){
	var x,y;
	var radians = (Math.PI / 180) * -angle,
	x = p[0]*Math.cos(radians) + p[1]*Math.sin(radians); 
	y = -(p[0]*Math.sin(radians)) + p[1]*Math.cos(radians);
	return [x,y];
}
