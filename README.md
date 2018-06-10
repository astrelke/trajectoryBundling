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
* Make sure you are in your created environment when installing the following python toolkits:

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
### Convert AIS Data to Parquet
*	Open Anaconda command prompt and cd into "trajectoryBundling" folder. 
*	For each gdb file you wish to convert into a set of parquet files, run python script "ais-to-parquet-in-mem.py".
```
python ais-to-parquet-in-mem.py path-to-gdb.zip
```
* 'path-to-gdb.zip' is the destination path to the gdb.zip file. For example, “ais_data/Zone19/Zone19_2011_01.gdb.zip” 
*	A folder with the same name and location as the gdb.zip input file will be created as a result, which contains a parquet file for the broadcast, vessel, and voyage data. For example, “Zone19/Zone19_2011_01/Broadcast.parquet”
* Note that only "Broadcast.parquet" is used when creating the GEOJSON in the next step.

### Convert Parquet to Geojson
*	Open Anaconda command prompt and cd into "trajectoryBundling" folder.
*	For each "Broadcast.parquet" file you wish to convert into a GEOJSON, run python script "ais-group-and-simplify-from-parqut.py".
```
python ais-group-and-simplify-from-parquet.py path-to-parquet
```
* 'path-to-parquet' is the destination path to the "Broadcast.parqet" file. For example, “ais_data/Zone19/Zone19_2011_01/Broadcast.parquet”. 
*	Once the script finishes executing, a GEOJSON file with the same name as the folder containing the parquet file will be created in its respective zone folder within the "geojson" directory. For example, “trajectoryBundling/example/geojson/Zone19/Zone19_2011_01.geojson”.

### TRACLUS
*	In the Node.js command prompt, cd into “trajectoryBundling/example” and run the TRACLUS script "traclus.js"
```
node traclus.js path-to-geojson eps Y costAdv levels
```
*	‘path-to-geojson’ is the destination path to the GEOJSON file, ‘eps’ is the epsilon value used in the eps-neighborhood function for generating clusters, ‘Y’ is the smoothing parameter used when making the represented trajectories[1], 'costAdv' is the cost advantage parameter used to prevent over-simplification when partioning the trajectories, and ‘levels’ is the number of levels of represented trajectories to produce. For example:
```
node traclus.js geojson/Zone19/Zone19_2011_01.geojson 12.0 3.0 1.0 14
```
*	Once the script finishes executing, there will be a GEOJSON file for each level of trajectories produced in the same location as the inputed GEOJSON file. For example:
```
geojson/Zone19/Zone19_2011_01(0)
geojson/Zone19/Zone19_2011_01(1)
.
.
.
geojson/Zone19/Zone19_2011_01(14)
```
#### Estimating Parameters
*	The key to obtaining a successful set of representative trajectories for each level is to know what values to set the parameters as. 
*	If epsilon is set too large then it will cluster lines that are too far apart, and if epsilon is too small then nearby lines that should be clustered will not. 
*	The smoothing parameter 'Y' determines how far apart each point in the represented trajectory should be. This parameter should be set to some value greater than 0 to ensure represented trajectories do not come out looking fluctuated, but setting this value too high will cause over-simplification.
* The cost advantage parameter 'costAdv' is used to prevent over-simplification when partioning the trajectories. This value should be relatively low to ensure that the trajectories are still being simplified when needed during partioning (0 < costAdv <= 1). 
*	The higher ‘level’ is set to, the more of the original trajectory will be preserved when zooming in on the map. 
*	Unfortunately, there is not a formal method for coming up with these parameters; instead they are obtained through visual inspection and domain knowledge[1]. 
*	For the Zone 19 data, the most optimal parameters seem to be e=12, Y=3, and costAdv=1.
* You can set the levels parameter to as high as you want, but generating more then 14 levels of vector tiles in the next step will take awhile and may even cause the script to crash as a response of the heap being out of memory (this can sometimes be fixed by increaseing the memory limit within the Node.js command prompt).

### geojson2mvt
*	In the Node.js command prompt, cd into “trajectoryBundling/example” and run the geojson2mvt script "geojson2mvt.js".
```
node geojson2mvt.js path-to-geojson-root southBounds westBounds northBounds eastBounds levels
```
* ‘path-to-geojson-root’ is the destination path of the original geojson file WITHOUT specifying the ‘.geojson’ format at the end. For example, “geojson/Zone19/Zone19_2011_01”. 
*	‘southBounds’, ‘westBounds’, ‘northBounds’, and ‘eastBounds’ are the boundary box coordinates. 
*	‘levels’ are the number of geojson files numbered from 0 to the value of ‘levels’. 
*	The following example will convert the 13 GEOJSON files generated by the example in the previous section (see TRACLUS) into a single {z}/{x}/{y} vector tile hierarchy up to zoom level 14:
```
node geojson2mvt.js geojson/Zone19/Zone19_2011_01 0 -75 85 -63 14
```
*	Once the script finishes executing, a folder with the same name as the root GEOJSON file will be stored in the “Tiles” folder. For example, “trajectoryBundling/example/Tiles/Zone19_2011_01”.

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





