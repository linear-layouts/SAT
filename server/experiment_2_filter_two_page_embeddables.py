import multiprocessing
import timeit
from asyncio import Future
from concurrent.futures.process import ProcessPoolExecutor
from datetime import timedelta

import simplejson
from flask import json

from be.graphml_parser import get_nodes_and_edges_from_graph
from be.solver import SolverInterface
from be.utils import set_printing, CodeTimer
from experiments.constom_ex_types import ExResult


def main():
    pool = ProcessPoolExecutor(max_workers=int(multiprocessing.cpu_count() * 0.25))
    pages = [{
        'id': "p1",
        'type': 'STACK',
        'constraint': None
    }, {
        'id': "p2",
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

    with open("results_random_planar_110.json", mode="r") as f:
        for line in f:
            future = pool.submit(do_experiment, base_constraints, pages, line)
            future.add_done_callback(callback)

        pool.shutdown(wait=True)


def do_experiment(base_constraints, pages, line):
    line_obj = json.loads(line)
    start = timeit.default_timer()
    graph_str = line_obj['graph_str']
    edge_number = line_obj['edge_number']
    node_number = line_obj['node_number']
    graph_type = line_obj['graph_type']
    nodes, edges = get_nodes_and_edges_from_graph(graph_str)

    constraints = base_constraints.copy()
    constraints.append(
        {
            "type": "NODES_PREDECESSOR",
            "arguments": ["0"],
            "modifier": nodes[1:],
        })

    solve = SolverInterface.solve(nodes, edges, pages, constraints, 42)
    solving_time = str(timedelta(milliseconds=(timeit.default_timer() - start)) * 1000.0)
    res = ExResult(graph_type=graph_type,
                   pages=pages,
                   constraints=constraints,
                   node_number=node_number,
                   edge_number=edge_number,
                   solving_time=solving_time,
                   solver_result=solve,
                   graph_str=graph_str)
    return res


def callback(my_future: Future):
    if not my_future.done() or my_future.cancelled():
        return
    result: ExResult = my_future.result()
    if result.solver_result.satisfiable:
        return
    else:
        print("kept graph")
        with open("results_random_planar_110_filtered.json", mode="a") as f:
            print(simplejson.dumps(result), file=f)


if __name__ == '__main__':
    main()
