
# coding: utf-8

# In[1]:


import pandas as pd
import sys
from datetime import datetime

# In[2]:


parquetFile = sys.argv[1];
df = pd.read_parquet(parquetFile)


# In[3]:


def haversine(lat_a, lon_a, lat_b, lon_b):
    # code from geopy: https://github.com/geopy/geopy/blob/master/geopy/distance.py
    # parallelized using numpy
	EARTH_RADIUS = 6371.009 # (in km)

	lat1, lng1 = np.radians(lat_a), np.radians(lon_a)
	lat2, lng2 = np.radians(lat_b), np.radians(lon_b)
	sin_lat1, cos_lat1 = np.sin(lat1), np.cos(lat1)
	sin_lat2, cos_lat2 = np.sin(lat2), np.cos(lat2)

	delta_lng = lng2 - lng1
	cos_delta_lng, sin_delta_lng = np.cos(delta_lng), np.sin(delta_lng)

	d = np.arctan2(np.sqrt((cos_lat2 * sin_delta_lng) ** 2 + (cos_lat1 * sin_lat2 - sin_lat1 * cos_lat2 * cos_delta_lng) ** 2), sin_lat1 * sin_lat2 + cos_lat1 * cos_lat2 * cos_delta_lng)
	return EARTH_RADIUS * d

THRESHOLD = 0.015 / 60.0 # 15 meters/minute
DT_THRESHOLD = pd.Timedelta(minutes=120)

# FIXME df shouldn't be assumed as a global
def run_split(voyage_id):
	vdf = df[df["VoyageID"] == voyage_id].sort_values(by="BaseDateTime")

    # need to fix multiple reports at the same datetime...
    # FIXME just drop the later reports for now
	vdf.drop_duplicates(subset="BaseDateTime", keep="first", inplace=True)
	#print(vdf.info())
	vdf["dist"] = haversine(vdf["lat"].values, vdf["lon"].values, vdf["lat"].shift(1).fillna(0).values, vdf["lon"].shift(1).fillna(0).values)
	vdf['BaseDateTime'] = pd.to_datetime(df['BaseDateTime'])
	vdf["diff_dt"] = vdf["BaseDateTime"] - vdf["BaseDateTime"].shift(1).fillna(datetime(2011,1,1))
	vdf["speed"] = vdf["dist"]/vdf["diff_dt"].dt.seconds
	vdf["stopped"] = vdf["dist"].isnull() | (vdf["speed"] < THRESHOLD)
    # nice grouping solution from
    # http://stackoverflow.com/questions/14358567/finding-consecutive-segments-in-a-pandas-data-frame
    # FIXME need to look at previous values right before and after switches (could just shift more?)
	vdf["subVoyageID"] = ((vdf["stopped"].shift(1) != vdf["stopped"]) | (vdf["diff_dt"] > DT_THRESHOLD)).astype(int).cumsum()
	return vdf


# In[4]:


import pyproj

def get_voyages(df, voyage_ids=None, id_col="subVoyageID", dt_col="BaseDateTime", lat_col="lat", lon_col="lon"):
	mproj = pyproj.Proj("+init=EPSG:3857") # Mercator

	if voyage_ids is None:
		voyage_ids = df[id_col].unique()
	else:
		try:
			iter(voyage_ids)
		except TypeError:
			voyage_ids = [voyage_ids]

	unprojected_paths = {}
	projected_paths = {}
	for voyage_id in voyage_ids:
		coords = df[df[id_col] == voyage_id].sort_values(dt_col)[[lon_col, lat_col]]
        # print(len(coords.values), color)
	if len(coords.values) >= 2:
			unprojected_paths[voyage_id] = coords.values
			res = mproj(*np.split(coords.values,2,axis=1))
			organized = list(zip(res[0].transpose().tolist()[0], res[1].transpose().tolist()[0]))
			projected_paths[voyage_id] = organized
	return projected_paths, unprojected_paths


# In[5]:


import geojson
import numpy as np
import shapely.geometry

def write_voyages(paths):
	features = []
	output = parquetFile
	#Create output destination
	try:
		start = output.find("Zone")
		end = output.rfind('/')
		output = 'example/geojson/'+output[start:end]+".geojson"
	except ValueError:
		output = ''
	for v_id, path in paths.items():
#		print("SHAPE BEFORE:", path.shape)
		ls = shapely.geometry.LineString(path)
		sim_ls = ls.simplify(0.0002,preserve_topology=False)
#		print("SHAPE AFTER:", np.asarray(sim_ls.coords).shape)
		f = geojson.Feature(id=str(v_id), geometry=geojson.LineString(list(sim_ls.coords)),properties={'density':1})
		features.append(f)
	fc = geojson.FeatureCollection(features)
	with open(output, 'w') as f:
		geojson.dump(fc, f)


# In[7]:


min_x = -71.1461
max_y = 42.5662
max_x = -70.2974
min_y = 42.0880

all_paths = {}

voyage_ids = df["VoyageID"].unique().tolist()
# print(voyage_ids)
for i, voyage_id in enumerate(voyage_ids):
	print("\r{} {} {}".format(i,voyage_id, len(voyage_ids)),end="")
	vdf = run_split(voyage_id)
	projected_paths, unprojected_paths = get_voyages(vdf[~vdf["stopped"]])
	for k, unproj_path in unprojected_paths.items():
		if len(unproj_path) < 10:
			continue
		lon, lat = np.split(unproj_path,2,axis=1)
		if ((lon > max_x) | (lon < min_x) | (lat > max_y) | (lat < min_y)).all():
#             print("OUT OF BOUNDS", voyage_id, k)
			continue
		else:
#             print("IN BOUNDS", voyage_id, k)
			pass
		all_paths[(voyage_id, k)] = unproj_path
        
# voayge id: 265?
write_voyages(all_paths)

