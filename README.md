# ais2mvt 
A Python and JavaScript pipeline that converts Automated Identification System (AIS) data into a {z}/{x}/{y} hierarchy of Mapbox vector tiles in which trajectories are bundled from the bottom {z} level up in order to reduce overlap and clutter in large-scale data, and to ensure continuity between vector tile levels.  Bundling implementation uses the TRACLUS algorithm[1] , the conversion from GEOJSON to Mapbox Vector tile is handled by geojson2mvt[2], and the vector tiles are hosted on a local server using Mapbox vector tile specification and tools[3].

## Dependencies 
### AIS Data
*	Download AIS datasets from desired year: https://marinecadastre.gov/ais/. 
* Move AIS geo-database (gdb) files to respective zone folders in "ais_data" directory.   

### Node.js
*	Install latest version of Node.js: https://nodejs.org/en/download/.

### Python 3.x.x
*	Install latest version of python: https://www.python.org/downloads/

### Anaconda 
*	Install the Anaconda command prompt: https://www.anaconda.com/download/

### Python Toolkits
* Open the Anaconda command prompt.
* Create a new conda environment
```
conda create -n name_of_my_env python
```
* Enter newly created environment:
```
activate name_of_my_env
```
* Make sure you are in your created environment when installing the following python toolkits.

#### Pandas
*	Install pandas library
```
conda install pandas
```
#### GEOJSON
*	Install pip
```
conda install pip
```
*	Install GeoJSON library 
```
pip install geojson
```
#### PyProj
* Install PyProj library 
```
conda install -c conda-forge pyproj
```
#### Numpy
* Install Numpy library
```
conda install -c anaconda numpy
```
#### Shapley 
* Install Shapely library
```
conda install -c conda-forge shapely
```

## How to Run
### ais-to-parquet
*	Open Anaconda command prompt and cd into "trajectoryBundling" folder. 
*	For each gdb file you wish to convert into a set of parquet files, run python script "ais-to-parquet-in-mem.py".
```
python ais-to-parquet-in-mem.py path-to-gdb.zip
```
* 'path-to-gdb.zip' is the destination path to the gdb.zip file. For example, “Zone19/Zone19_2011_01.gdb.zip” 
*	A folder with the same name and location as the gdb.zip file will be created as a result, which contains a parquet file for the broadcast, vessel, and voyage data. For example, “Zone19/Zone19_2011_01/Broadcast.parquet”
* Note that only "Broadcast.parquet" is used when creating the GEOJSON in the next step.

### parquet2geojson
*	Open Anaconda command prompt and cd into "trajectoryBundling" folder.
*	For each "Broadcast.parquet" file you wish to convert into a GEOJSON, run python script "data2geojson.py".
```
python data2geojson.py path-to-parquet southBounds westBounds northBounds eastBounds
```
* 'path-to-parquet' is the destination path to the "Broadcast.parqet" file. For example, “Zone19/Zone19_2011_01/Broadcast.parquet”. 
*	'southBounds', 'westBounds', 'northBounds', and 'eastBounds' are the boundary coordinates. Only coordinate points within this boundary will be included in the GEOJSON. For example, 40 -73 48 -65 (boundary for New England).
*	Once the script finishes executing, a GEOJSON file with the same name as the folder containing the parquet file will be created in its respective zone folder within the "geojson" directory. For example, “trajectoryBundling/example/geojson/Zone19/Zone19_2011_01.geojson”.

### Hurricane Input Creator (Optional)
* If you want to convert the Best Track hurricane datasets into a GEOJSON for testing TRACLUS using alternative data than the one provided by AIS, open the Node.js command prompt and cd into “trajectoryBundling/example”.
*	Open the file "hurricaneInputCreator.js" and specify and the location of the Best Track text file on line 3 as well as the name of the outputted GEOJSON file on line 65. 
*	Once these changes have been made, run the script "hurricaneInputCreator.js".
```
node hurricaneInputCreator.js 
```
*	Once the script finishes executing, a GEOJSON file with the specified outputted name will be created in the "geojson" folder outside of any zone folder. In addition, the south, west, north, and east most boundaries are displayed in the prompt. Make sure to take note of these coordinates as they will be used later for initializing the boundary box of the vector tiles.

### TRACLUS
*	In the Node.js command prompt, cd into “trajectoryBundling/example” and run the TRACLUS script "traclus.js"
```
node traclus.js path-to-geojson eps MinLns levels
```
*	‘path-to-geojson’ is the destination path to the GEOJSON file, ‘eps’ is the epsilon value, ‘MinLns’ is the minimum 1) density per cluster and 2) intersecting points per sweep line[1], and ‘levels’ is the number of levels of represented trajectories to produce. For example:
```
node traclus.js geojson/Zone19/Zone19_2011_08.geojson 28 8 13
```
*	Once the script finishes executing, there will be a GEOJSON file for each level of trajectories produced in the same location as the inputed GEOJSON file. For example:
```
geojson/Zone19/Zone19_2011_08(0)
geojson/Zone19/Zone19_2011_08(1)
.
.
.
geojson/Zone19/Zone19_2011_08(13)
```
#### Estimating Parameters
*	The key to obtaining a successful set of representative trajectories for each level is to know what values to set the parameters as. 
*	If epsilon is set too large then it will cluster lines that are too far apart, and if epsilon is too small then nearby lines that should be clustered will not. 
*	‘MinLns’ is important for calculating the QMeasure[1], which is used to suggest the quality of a cluster. The smaller the QMeasure, the better the cluster quality is, so ‘MinLns’ is typically set between values 4-8.   
*	The higher ‘level’ is set to, the more of the original trajectory will be preserved when zooming in on the map. 
*	Unfortunately, there is not a formal method for coming up with these parameters; instead they are obtained through visual inspection and domain knowledge[1]. 
*	For the August 2011 Zone 19 data (Zone19_2011_08.geojson) with coordinates within the boundary of [S=40 W=-73 N=48 E=-63] (New England), the most optimal parameters seem to be e=28 and MinLns=8.
*	For the Best Track Atlantic data, the most optimal parameters seem to be e=30 and MinLns=6. 

### geojson2mvt
*	In the Node.js command prompt, cd into “trajectoryBundling/example” and run the geojson2mvt script "geojson2mvt.js".
```
node geojson2mvt.js path-to-geojson-root southBounds westBounds northBounds eastBounds levels
```
* ‘path-to-geojson-root’ is the destination path of the original geojson file WITHOUT specifying the ‘.geojson’ format at the end. For example, “geojson/Zone19/Zone19_2011_08”. 
*	‘southBounds’, ‘westBounds’, ‘northBounds’, and ‘eastBounds’ are the boundary box coordinates. 
*	‘levels’ are the number of geojson files numbered from 0 to the value of ‘levels’. 
*	The following example will convert the 13 GEOJSON files generated by the example in the previous section (see TRACLUS) into a single {z}/{x}/{y} vector tile hierarchy up to zoom level 13:
```
node geojson2mvt.js geojson/Zone19/Zone19_2011_08 40 -75 48 -63 13
```
*	Once the script finishes executing, a folder with the same name as the root GEOJSON file will be stored in the “Tiles” folder. For example, “trajectoryBundling/example/Tiles/Zone19_2011_08”.

### Run on localhost
*	Open "trajectoryBundling/example/experiment.html" in an editor. 
*	On line 34, change the vector tile root directory to be the one generated by "geojson2mvt.js" (see geojson2mvt above).
•	In the Node.js command prompt, cd into "trajectoryBundling/example" and run python script "cors _server_py3.py" 
```
python cors_server_py3.py
```
*	Open an internet browser (preferably Firefox or Google Chrome) and go to http://localhost:31338/experiment.html 
*	Zoom in and out to observe the change in representative trajectories. Note that line widths are based on density of trajectory. 


## References:
[1] Lee,G., Han, J. and Whang, K.Y., 2007, June. Trajectory clustering: a partition-and-group framework. In Proceedings of the 2007 ACM SIGMOD international conference on Management of data (pp. 593-604). ACM.
[2] New York City Department of City Planning, geojson2mvt: https://libraries.io/github/NYCPlanning/geojson2mvt 
[3] Mapbox Vector Tile Specification: https://www.mapbox.com/vector-tiles/specification/ 





