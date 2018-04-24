import pyarrow as pa
import pyarrow.parquet as pq
import fiona
import pandas as pd
import os
import time


def layer_to_parquet(vfs, layer, in_archive, out_dir, time_cols=[], out_layer=None):
    rows = []
    with fiona.open(in_archive,
                    layer=layer,
                    vfs=vfs) as src:
        for r in src:
            row = {}
            if 'geometry' in r and r['geometry'] is not None:                
                lon, lat = r['geometry']['coordinates']
                row = {'lon': lon, 'lat': lat}
            row.update(r['properties'])
            rows.append(row)

    df = pd.DataFrame.from_dict(rows)
    for tcol in time_cols:
        df[tcol] = pd.to_datetime(df[tcol],format='%Y-%m-%dT%H:%M:%S')

    pq_fname = os.path.join(out_dir, "{}.parquet".format(out_layer))
    table = pa.Table.from_pandas(df)
    pq.write_table(table, pq_fname)
    

AIS_LAYERS = ["Vessel",
              "Voyage",
              "Broadcast",
              "BaseStations",
              "AttributeUnits"]
TIME_COLS = {"Voyage": ["ETA", "EndTime", "StartTime"],
             "Broadcast": ["BaseDateTime"]}             

def to_parquet(fname):
    gdb_basename = os.path.splitext(os.path.basename(fname))[0]
    in_archive = "/" + gdb_basename
    vfs = "zip://{}".format(fname)
    pq_dir = os.path.join(os.path.split(fname)[0], 
                            os.path.splitext(gdb_basename)[0])
    if not os.path.exists(pq_dir):
        os.mkdir(pq_dir)

    rows = []
    with fiona.drivers():
        layers = fiona.listlayers(in_archive, vfs=vfs)
        layer_map = {}
        for layer in AIS_LAYERS:
            match = False
            for gdb_layer in layers:
                if layer == gdb_layer:
                    match = True
                    break
                elif layer in gdb_layer:
                    layer_map[gdb_layer] = layer
                    match = True
                    break
        
        for layer in layers:
            out_layer = layer
            if layer in layer_map:
                out_layer = layer_map[layer]
            time_cols = []
            if out_layer in time_cols:
                time_cols = TIME_COLS[out_layer]
            print("Processing", gdb_basename, layer, out_layer)
            layer_to_parquet(vfs, layer, in_archive, pq_dir,
                             time_cols, out_layer)
            

if __name__ == '__main__':
	start_time = time.time()
	import sys
	if len(sys.argv) < 2:
		print("Usage {} {} <gdb-zip-file>".format(sys.executable, sys.argv[0]))
		sys.exit(1)
	to_parquet(sys.argv[1])
	elapsed_time = time.time() - start_time
	print(elapsed_time)
    # to_parquet("/bigdata1/dkoop/ais/2011/02/Zone19_2011_02.gdb.zip")
                
