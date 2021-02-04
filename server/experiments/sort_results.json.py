from os import listdir
from os.path import isfile

from flask import json

onlyfiles = [f for f in listdir(path='.') if isfile(f)]

parsed_objects = []
for file in onlyfiles:
    if file.startswith("results"):
        with open(file, mode='r') as fh:
            lines = fh.readlines()
            for line in lines:
                try:
                    parsed_objects.append(json.loads(line))
                except ValueError:
                    print(line)

results = {}
for o in parsed_objects:

    if o['graph_type'] == "random_planar":
        if not results.get(o['graph_type']):
            results[o['graph_type']] = {}
        if not results[o['graph_type']].get(o['node_number']):
            results[o['graph_type']][o['node_number']] = []
        results[o['graph_type']][o['node_number']].append(o)
    else:
        if not results.get(o['graph_type']):
            results[o['graph_type']] = []
        results[o['graph_type']].append(o)

for k, v in results.items():
    if k == "random_planar":
        for k1, v1 in v.items():
            with open("sorted/result_for_{}_runs_with_{}_{}.json".format(len(v1), k, k1), mode='w') as fh:
                json.dump(v1, fh)
    else:
        with open("sorted/result_for_{}_runs_with_{}.json".format(len(v), k), mode='w') as fh:
            json.dump(v, fh)
