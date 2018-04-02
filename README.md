# trajectoryBundling
Run Traclus Example. 

## Run Traclus
In example folder, run 
```
node traclus.js
```
to retreive resulting geojson file 'TX.geojson'

## Run geojson2mvt
Run 
```
node script.js
```
## Display Generated Vector Tiles
Once vector tiles have been generated in root folder TX, run 
```
python cors_server_py3.py
```

Go to http://localhost:31338/experiment.html to see running example
