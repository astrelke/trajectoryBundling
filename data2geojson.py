import pandas as pd
import geojson

def buildDFD(x,d):
	d['VoyageID'].append(x.VoyageID.iloc[0])
	d['Coordinate'].append(x[['lon','lat']].values.tolist())
	
def shiftFeatures(d):
	r = {}
	r['type'] = d['type']
	r['geometry'] = d['geometry']
	r['properties'] = d['properties']
	return r
	
def shiftFeatureCollection(d):
	r = {}
	r['type'] = d['type']
	r['features'] = d['features']
	return r
		
#argv 1: parquet file 
#argv 2: East boundary
#argv 3: West boundary
#argv 4: South boundary
#argv 5: North boundary
if __name__ == '__main__':
	import sys
	import time
	start_time = time.time()
	features = []
	df = pd.read_parquet(sys.argv[1])
	for vid, group in df.groupby('VoyageID'):
		if(len(group[["lon","lat"]].values.tolist()) > 1):
			lonValues = group["lon"].values.tolist()
			latValues = group["lat"].values.tolist()
			#if( all(i <= -63 for i in lonValues) and all(i >= -75 for i in lonValues) and all(i >= -80 for i in latValues) and all(i <= 85 for i in latValues)):	//Zone 19
			if( all(i <= int(sys.argv[2]) for i in lonValues) and all(i >= int(sys.argv[3]) for i in lonValues) and all(i >= int(sys.argv[4]) for i in latValues) and all(i <= int(sys.argv[5]) for i in latValues)):
				features.append(shiftFeatures(geojson.Feature(geometry=geojson.LineString(group[["lon","lat"]].values.tolist()),properties={'voyageID': vid, 'density': 1})))
			else:
				print(group[["lon","lat"]].values.tolist())
				print()
		else:
			print(group[["lon","lat"]].values.tolist())
			print()
	with open('Zone19_2011_5.geojson', 'w') as fp:
		geojson.dump(shiftFeatureCollection(geojson.FeatureCollection(features)), fp, sort_keys=True)
	elapsed_time = time.time() - start_time
	print(elapsed_time)