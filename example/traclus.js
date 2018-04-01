/*TRACLUS ALGORITHM*/
var fs = require('fs');
var T = [], features=[];
var feature;
var json = JSON.parse(fs.readFileSync('T.geojson', "utf8"));
json.features.forEach(function(feat){
	T.push(feat.geometry.coordinates)
});
var result = TRACULUS(T);

for(var i=0;i<result.length;i++){
	feature = {"type":"Feature", "geometry":{"type":"LineString", "coordinates":result[i]}, "properties":{"name":0}};
	features.push(feature);
}
var newJson = {"type":"FeatureCollection","features":features};
var fileName = 'TX.geojson';
fs.writeFileSync(fileName, JSON.stringify(newJson));


/* TRACULUS Algorithm: http://hanj.cs.illinois.edu/pdf/sigmod07_jglee.pdf
	First introduced by Jae-Gil Lee, Jiawei Han, and Kyu-Young Whang
	Inputs (T: Trajectories)
	Output (R: Representative Trajectory) 
*/
function TRACULUS(T){
	/*Variables
		Arrays (
			L: Partitioned line segment
			D: Set of line segments
			O: Set of clustered lines
			R: Representative Trajectory
		)
		Integers (i: Trajectory Index)
	*/
	var L=[],D=[],O=[],R=[]; var i =0;
	
	/* Partition Phase */
	//01: Loop through each trajectory tr
	T.forEach(function(tr) {
		//02 & 03: Get a set L of line segments and Accumulate L into a set D
		L = ApproximateTrajectoryParitioning(tr,i,D); 
		i++;
	});	
	
	/* Grouping Phase */
	//04: Get a set O of clusters
	O = LineSegmentClustering(D,5,1,1,T);
	//05: Loop through each cluster c
	O.forEach(function(C) {
		//06: Get a represenative trajectory
		R.push(RepresentativeTrajectoryGeneration(C,2,0.15));
	});
	return R;
	
}

/* Approximate Trajectory Paritioning
	Inputs (tr: Trajectory, i: Trajectory Index, D: Set of line segments)
	Output (D: Set of line segments) 
*/
function ApproximateTrajectoryParitioning(tr,i,D){
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
	var line=[]; var startIndex=0,len=1,currIndex; var costPar,costNopar;
	line.push(tr[0]); //The starting point
	while(startIndex+len < tr.length){
		currIndex = startIndex+len;
		costPar = MDLpar(tr, startIndex, currIndex);
		costNopar = MDLnopar(tr, startIndex, currIndex);
		/* check if partitioning at the current point makes
		the MDL cost larger than not partitioning*/
		if(costPar > costNopar){
			/*partition at the previous point*/
			line.push(tr[currIndex-1]);
			D.push({"L":line,"trajectory":i,"clusterId":0,"classified":false,"noise":false});
			line = [];
			line.push(tr[currIndex-1]);
			startIndex = currIndex - 1;
			len = 1;
		} else len += 1;
	}
	line.push(tr[tr.length-1]);
	D.push({"L":line,"trajectory":i,"clusterId":0,"classified":false,"noise":false});
}

/* Line Segment Clustering
	Inputs (D: Set of line segments, e:epslion value, MinLns: Minimum number of neighbors in cluster, MinClus: Min number of trajectories in cluster, T: Trajectories)
	Output (O: Set of clusteres) 
*/
function LineSegmentClustering(D,e,MinLns,MinClus,T){
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
	var tempD,tempC,C=[],N,Q=[],O=[]; var clusterId = 0; 
	/*Step 1:*/
	for(var i=0; i<D.length-1;i++){ 
		if(!D[i].classified){
			//Compute N(L) and predict clusters, where L=D[i]
			tempD = D; tempC = C; 
			N = Ne1(tempD,i,e,tempC,clusterId);
			if(N.length >= MinLns){
				//Assign all points in neighborhood to cluster
				D = tempD;
				C = tempC;
				//Insert neighborhood cluster into queue Q;
				Q = N;
				/*Step 2*/
				ExpandCluster(Q,D,C,clusterId,e,MinLns);
				clusterId++; /*a new id */
			} else D[i].noise = true;
		}
	}
	/* check the trajectory cardinality */
	C.forEach(function(c){
		/*Calculate trajectory cardinality and compare with threshold
		a threshold other than MinLns can be used*/
		if(PTR(c,T).length > MinClus) O.push(c);	//Add C to set of clusters O
	});
	return O;
}

/*Compute a Density-Connected Set and Insert New Points into Respective Cluster 
	Inputs (Q: Queue of neighboring points to be expanded upon, D: Set of line segments, C: Set of clusters, e: epslion value, MinLns: Minimum number of vertical line intersections)
	Output () 
*/
function ExpandCluster(Q,D,C,clusterId,e,MinLns){
	/*Variables
		Arrays (
			N: Set of new found neighboring points
		)
	*/
	var N;
	while(Q.length > 0){
		//Compute N(L), where L=Q[0]
		N = Ne2(Q,0,e);
		if(N.length >= MinLns){
			N.forEach(function(X){
				//Assign clusterId to X
				if(!X.classified || X.noise){
					X.clusterId = clusterId;
					//Add point to cluster
					if(X.noise && X.classified){
						X.noise = false;
						C[clusterId].push(X);
						D[X.index] = X;
					}
				}
				//Insert X into queue Q
				if(!X.classified) {
					X.classified = true;
					X.noise = false;
					Q.push(X);
					C[clusterId].push(X);
					D[X.index] = X;
				}
			});
		}
		Q.shift();
	}
}


/*Representative Trajectory Generation
	Inputs (C: Set of clustered line segments, MinLns: Minimum number of intersections allowed for point to be added to represenative trajectory, Y=Smoothing value)
	Output (RTR: A representative trajectory) 
*/
function RepresentativeTrajectoryGeneration(C,MinLns,Y){
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
	var V,v2,C2=[],P=[],sweepLine,intersects,pAvg,pAvg2,RTR=[];
	var intersect;
	var i=0, j=0,pNum=0;
	var x1=0.0,x2=0.0,y1=0.0,y2=0.0,angle,diff,xPrev=64666266609.0,y=0.0;
	var lineIntersection = require('line-intersection');
		
	//Compute average direction vector V
	C.forEach(function(v){
		x1 += v.L[0][0]; x2 += v.L[1][0]; y1 += v.L[0][1]; y2 += v.L[1][1];
	});
	var R=[];
	V = [[x1/C.length,y1/C.length],[x2/C.length,y2/C.length]];
	//Calculate angle in which to rotate X axis
	angle = angleBetween2Lines(V[0],[V[1][0],V[0][1]],V[0],V[1]);
	/*X'-value denotes the coordinate of the X' axis */
	C.forEach(function(v){
		//Rotate vector and add to rotated cluster C2
		v2 = rotateVector(v,-angle);
		R.push(v2.L);
		C2.push(v2);
		//If end point is before start point on X'-axis, swap points
		if(v2.L[1][0] < v2.L[0][0]) { v2.L = [v2.L[1],v2.L[0]];}
		//Sort the points in the set P by their X'-values
		while(i <= P.length && j < 2){
			if(i==P.length){
				if(j==0){ P.push(v2.L[0]); P.push(v2.L[1]); } 	//Push both points 
				else if(j==1) P.push(v2.L[1]);					//Push second point
				else console.log("ERROR");						//Error
				j=2;
			}else{
				if(v2.L[j][0] < P[i][0]){ P.splice(i, 0, v2.L[j]); j++; }	//Append point in order of its X'-axis position
			}
			i++;
		}
		//Reset indicies
		i=0; j=0;
	});
	i=0;
	P.forEach(function(p){
		/*Count pNum using a sweep line (or plane) */
		sweepLine = [[p[0],p[1]+10],[p[0],p[1]-10]];
		//R.push(sweepLine);
		intersects=[];
		C2.forEach(function(v){
			if((v.L[0][0] <= sweepLine[0][0] && sweepLine[0][0] <= v.L[1][0]) || (v.L[0][0] >= sweepLine[0][0] && sweepLine[0][0] >= v.L[1][0])){
				intersect = lineIntersection.findIntersection([{x: v.L[0][0], y: v.L[0][1]}, {x: v.L[1][0], y: v.L[1][1]}, 
					{x: sweepLine[0][0], y: sweepLine[0][1]}, {x: sweepLine[1][0], y: sweepLine[1][1]}]);
				pNum++;
				intersects.push([intersect.x,intersect.y]);
			}
		});
		if(pNum >= MinLns){
			//Compute diff
			if(xPrev == 64666266609.0) diff = 0.0;
			else diff = p[0] - xPrev;
			xPrev = p[0];
			if(diff >= Y){
				//Compute the average coordinate pAvg2
				intersects.forEach(function(intxn){ y += intxn[1]; });
				pAvg2 = [p[0], y/intersects.length];
				//Undo the rotation and get the point pAvg2
				pAvg = rotatePoint(pAvg2,angle)
				//Append Pavg to the end of RTRi
				RTR.push(pAvg);
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
/*Get MDL cost with partition*/
function MDLpar(tr, startIndex, currIndex){
	var H, D_H;
	//Calc L(H)
	H = Math.log(getDistance(tr[startIndex],tr[currIndex]));
	//Calc L(D|H)
	var angularDistance=0.0, perpDistance=0.0;
	for(var i=startIndex; i<currIndex; i++){
		//Calc perpendicular distance
		perpDistance += calcPerpDistance([tr[startIndex],tr[currIndex]],[tr[i],tr[i+1]]);
		//Calc angular distance
		angularDistance += calcAngularDistance([tr[startIndex],tr[currIndex]],[tr[i],tr[i+1]]);
	}
	D_H = Math.log(perpDistance) + Math.log(angularDistance);
	return H + D_H;
}
/*Get MDL cost with no partition*/
function MDLnopar(tr, startIndex, currIndex){
	var len=0.0;
	for(var i=startIndex; i<currIndex; i++) len += getDistance(tr[i],tr[i+1]);
	return Math.log(len);
}
/*Participating Trajectories Function*/
function PTR(C,T){
	var ptr = [], repeat=[];
	for(var i=0;i<C.length;i++){
		if(!repeat.includes(C[i].trajectory)){
			ptr.push(T[C[i].trajectory]);
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
	var distance = require('euclidean-distance');
	var projPoints;
	//Calculate Projection Points
	projPoints = calcProjPoint(Li, Lj);
	//Calculate euclidean Distance
	var l1 = distance(Lj[0],projPoints[0]);
	var l2 = distance(Lj[1],projPoints[1]);
	//Return perpendicular distance
	return ((l1*l1 + l2*l2)/(l1 + l2));
}
/*Calculate Angular Distance*/
function calcAngularDistance(Li,Lj){
	var len,angle;
	len = getDistance(Lj[0],Lj[1]);
	angle = angleBetween2Lines(Lj[0],Lj[1], Li[0], Li[1]);
	if(angle >= 0 && angle < 90) 
		return len * Math.sin(angle);
	else
		return len;
}
/*Calculate Parallel Distance*/
function calcParallelDistance(Li,Lj){
	var distance = require('euclidean-distance');
	var projPoints;
	var l1,l2,e1,e2;
	//Calculate Projection Points
	projPoints = calcProjPoint(Li, Lj);
	/*Calculate minimum Euclidean distance between 
	start vertex of Li and projected points*/
	e1 = distance(Li[0],projPoints[0]);
	e2 = distance(Li[0],projPoints[1]);
	l1 = Math.min(e1,e2);
	/*Calculate minimum Euclidean distance between 
	end vertex of Li and projected points*/
	e1 = distance(Li[1],projPoints[0]);
	e2 = distance(Li[1],projPoints[1]);
	l2 = Math.min(e1,e2);
	//Calculate parallel distance
	return Math.min(l1,l2);
}
/*Calculate projection point of line 1 onto line 2*/
function calcProjPoint(Li, Lj){
	var v = [], d=[], projPoint=[];
	var x, y;
	//Check which direction the line is going
	var dir=0;	//0 = horziontal, 1 = vertical;
	x = Math.abs(Li[1][0] - Li[0][0]);
	y = Math.abs(Li[1][1] - Li[0][1]);
	if(x < y)
		dir = 1;
	d[0] = Lj[0][dir] - Li[0][dir];
	d[1] = Lj[1][dir] - Li[0][dir];
	//Calculate projection points ps and pe
	for(var i=0; i<2;i++){
		//Construct vector and calculate distance
		v.push(Li[1][0]-Li[0][0]);
		v.push(Li[1][1]-Li[0][1]);
		var vLen = Math.sqrt(v[0]*v[0] + v[1]*v[1]);
		//Calculate normalization factor
		var u = [[v[0]/vLen],[v[1]/vLen]];
		//Calculate projection point
		x = Li[0][0] + (d[i]*u[0]);
		y = Li[0][1] + (d[i]*u[1]);
		projPoint.push([x,y]);
	}
	return projPoint;
}
/*Distance function described in text*/
function dist(Li,Lj,wPerp,wPara,wAngle){
	return wPerp * calcPerpDistance(Li,Lj) + wPara * calcParallelDistance(Li,Lj) + wAngle * calcAngularDistance(Li,Lj);
}

/*
	Angle Calculations
*/
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

/*
	ε-Neighborhood Functions
*/
/*ε-Neighborhood Function 1 - assigns lines to predicted cluster during computation*/
function Ne1(D,index,e,C,clusterId){
	var N = [];
	var stop=true;
	C[clusterId] = [];
	//Assign cluster id to L
	D[index].clusterId = clusterId;
	D[index].classified = true;
	D[index].noise = false;
	C[clusterId].push(D[index]);
	for(var i=0; i<D.length; i++){
		if(i != index && !D[i].classified){
			//Get distance
			var d = dist(D[index].L,D[i].L,1,1,1);
			//Add line if distance is less than or equal to e
			if(d <= e){
				//Assign cluster id to new line in cluster
				D[i].clusterId = clusterId;
				D[i].classified = true;
				D[i].noise = false;
				C[clusterId].push(D[i]);
				N.push(D[i]);
			}
		}
	}
	return N;
}
/*ε-Neighborhood Function 2 - Simple neighborhood function, no assigment of cluster*/
function Ne2(D,index,e){
	var N = [];
	for(var i=0; i<D.length; i++){
		if(i != index && !D[i].classified){
			//Get distance
			var d = dist(D[index].L,D[i].L,1,1,1);
			//Add line if distance is less than or equal to e
			if(d <= e) N.push(D[i]);
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
	y1 = v.L[0][0]*Math.sin(radians) - v.L[0][1]*Math.cos(radians); 
	y2 = v.L[1][0]*Math.sin(radians) - v.L[1][1]*Math.cos(radians);
	return {"L":[[x1,-y1],[x2,-y2]],"trajectory":v.trajectory,"clusterId":v.clusterId,"classified":v.classified,"noise":v.noise,"index":v.index};
}
/*Rotate matrix counter-clockwise*/
function rotateMatrix(m,angle){
	var m2
	var x1, x2, y1, y2;
	var radians = (Math.PI / 180) * -angle;
	x1 = m[0][0]*Math.cos(radians) - m[0][1]*Math.sin(radians); 
	x2 = m[1][0]*Math.cos(radians) - m[1][1]*Math.sin(radians); 
	y1 = m[0][0]*Math.sin(radians) - m[0][1]*Math.cos(radians); 
	y2 = m[1][0]*Math.sin(radians) - m[1][1]*Math.cos(radians);
	return [[x1,-y1],[x2,-y2]];
}

/*Rotate point counter-clockwise*/
function rotatePoint(p,angle){
	var x,y;
	var radians = (Math.PI / 180) * -angle,
	x = p[0]*Math.cos(radians) - p[1]*Math.sin(radians); 
	y = p[0]*Math.sin(radians) - p[1]*Math.cos(radians);
	return [x,-y];
}