import multiprocessing
import os
import timeit
from asyncio import Future
from collections import Counter
from concurrent.futures.process import ProcessPoolExecutor
from datetime import timedelta
from os import listdir
from os.path import isfile

import simplejson

from be.graphml_parser import get_nodes_and_edges_from_graph
from be.solver import SolverInterface
from be.utils import set_printing
from experiments.constom_ex_types import ExResult


def main():
    pool = ProcessPoolExecutor(max_workers=int(multiprocessing.cpu_count() * 0.5))
    # pool = ProcessPoolExecutor(max_workers=1)
    pages_2 = [{
        'id': "p1",
        'type': 'STACK',
        'constraint': None
    }, {
        'id': "p2",
        'type': 'STACK',
        'constraint': None
    }]
    pages_3 = [{
        'id': "p1",
        'type': 'STACK',
        'constraint': None
    }, {
        'id': "p2",
        'type': 'STACK'
        ,
        'constraint': None
    }, {
        'id': "p3",
        'type': 'STACK',
        'constraint': None
    }]
    base_constraints = [
        {
            "type": "EDGES_TO_SUB_ARC_ON_PAGES",
            "arguments": ["0", "1"],  # the outer terminals
            "modifier": ["p1", "p2"]  # the pages
        },
        # inner terminals are after one outer terminal and before the other
        {
            "type": "NODES_PREDECESSOR",
            "arguments": ["0"],
            "modifier": ["2", "3"],
        },
        {
            "type": "NODES_PREDECESSOR",
            "arguments": ["2", "3"],
            "modifier": ["1"],
        }
    ]
    set_printing(False)
    onlyfiles = [os.path.join('500-random-planar-3-trees', f) for f in listdir(path='500-random-planar-3-trees') if
                 isfile(os.path.join('500-random-planar-3-trees', f))]
    for file in onlyfiles:
        with open(file, mode="r") as f:
            graph_str = f.read()
            future = pool.submit(do_experiment, base_constraints, pages_2, pages_3, graph_str)
            future.add_done_callback(callback)

    pool.shutdown(wait=True)


def do_experiment(base_constraints, pages_2, pages_3, graph_str):
    graph_type = 'planar-3-tree'
    graph_str = graph_str.encode('utf-8')
    nodes, edges = get_nodes_and_edges_from_graph(graph_str)

    sources = [e.source for e in edges]
    sources.extend([e.target for e in edges])

    c = Counter(sources)
    terminals = [k for k, v in c.most_common(4)]

    edges_to_remove = [e for e in edges if (e.target == terminals[0] and e.source == terminals[1]) or (
            e.target == terminals[1] and e.source == terminals[0])]

    edges = [e for e in edges if e not in edges_to_remove]

    constraints = [
        {
            "type": "EDGES_TO_SUB_ARC_ON_PAGES",
            "arguments": [terminals[0], terminals[1]],  # the outer terminals
            "modifier": ["p1", "p2"]  # the pages
        },
        # inner terminals are after one outer terminal and before the other
        {
            "type": "NODES_PREDECESSOR",
            "arguments": [terminals[0]],
            "modifier": [terminals[2], terminals[3]],
        },
        {
            "type": "NODES_PREDECESSOR",
            "arguments": [terminals[2], terminals[3]],
            "modifier": [terminals[1]],
        },
        {
            "type": "NODES_PREDECESSOR",
            "arguments": [terminals[0]],
            "modifier": [n for n in nodes if n != terminals[0]],
        }
    ]

    start = timeit.default_timer()
    solve = SolverInterface.solve(nodes, edges, pages_2, constraints, 42)
    if not solve.satisfiable:
        solve = SolverInterface.solve(nodes, edges, pages_3, constraints, 42)
        solving_time = str(timedelta(milliseconds=(timeit.default_timer() - start)) * 1000.0)

        res = ExResult(graph_type=graph_type,
                       pages=pages_3,
                       constraints=constraints,
                       node_number=len(nodes),
                       edge_number=len(edges),
                       solving_time=solving_time,
                       solver_result=solve,
                       graph_str=graph_str)
        return res
    else:
        solving_time = str(timedelta(milliseconds=(timeit.default_timer() - start)) * 1000.0)
        return ExResult(graph_type=graph_type,
                        pages=pages_2,
                        constraints=constraints,
                        node_number=len(nodes),
                        edge_number=len(edges),
                        solving_time=solving_time,
                        solver_result=solve,
                        graph_str=graph_str)


def callback(my_future: Future):
    if not my_future.done() or my_future.cancelled():
        return
    result: ExResult = my_future.result()
    if not result or result is None or len(result.pages) == 2:
        with open("results_planar_3-tree-2-page-embeddable.json", mode="a") as f:
            print(simplejson.dumps(result), file=f)
        return
    else:
        print("Found graph in {} s. embeddable {}", result.solving_time, result.solver_result.satisfiable)
        with open("results_planar_3-tree.json", mode="a") as f:
            print(simplejson.dumps(result), file=f)


if __name__ == '__main__':
    main()
