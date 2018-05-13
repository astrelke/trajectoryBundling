import pandas as pd
import geojson
import sys
import time

#Check if string is numerical values
def is_digit(n):
	try:
		int(n)
		return True
	except ValueError:
		return False
#Build dataframe data
def buildDFD(x,d):
	d['VoyageID'].append(x.VoyageID.iloc[0])
	d['Coordinate'].append(x[['lon','lat']].values.tolist())
#Shift order of geojson features keys to correct format	
def shiftFeatures(d):
	r = {}
	r['type'] = d['type']
	r['geometry'] = d['geometry']
	r['properties'] = d['properties']
	return r
#Shift order of feature collection keys to correct format	
def shiftFeatureCollection(d):
	r = {}
	r['type'] = d['type']
	r['features'] = d['features']
	return r
#Main Function
if __name__ == '__main__':
	#argv 1: parquet file 
	#argv 2: South boundary
	#argv 3: West boundary
	#argv 4: North boundary
	#argv 5: East boundary
	try:
		parquetFile = sys.argv[1]
		southBound = sys.argv[2]
		westBound = sys.argv[3]
		northBound = sys.argv[4]
		eastBound = sys.argv[5]
		if(not(is_digit(southBound) and is_digit(westBound) and is_digit(northBound) and is_digit(eastBound))):
			print("Invalid Boundary Coordinates: Please enter numerical values");
			sys.exit(1);
	except IndexError:
		print("Please Enter Parameters: path_to_parquet_file southBound westBound northBound eastBound")
		sys.exit(1)
	start_time = time.time()
	features = []
	df = pd.read_parquet(parquetFile)
	#Group dataframe columns by voyageId
	for vid, group in df.groupby('VoyageID'):
		if(len(group[["lon","lat"]].values.tolist()) > 1):
			lonValues = group["lon"].values.tolist()
			latValues = group["lat"].values.tolist()
			#if( all(i >= -80 for i in latValues) and all(i >= -75 for i in lonValues) and all(i <= 85 for i in latValues) and all(i <= -63 for i in lonValues)):	//Zone 19
			if( all(i >= int(southBound) for i in latValues) and all(i >= int(westBound) for i in lonValues) and all(i <= int(northBound) for i in latValues) and all(i <= int(eastBound) for i in lonValues)):
				features.append(shiftFeatures(geojson.Feature(geometry=geojson.LineString(group[["lon","lat"]].values.tolist()),properties={'voyageID': vid, 'density': 1})))
	output = parquetFile
	#Create output destination
	try:
		start = output.find("Zone")
		end = output.rfind('/')
		output = 'example/geojson/'+output[start:end]+".geojson"
	except ValueError:
		output = ''
	#Write data to geojson file
	with open(output, 'w') as fp:
		geojson.dump(shiftFeatureCollection(geojson.FeatureCollection(features)), fp, sort_keys=True)
	elapsed_time = time.time() - start_time
	print(elapsed_time)
