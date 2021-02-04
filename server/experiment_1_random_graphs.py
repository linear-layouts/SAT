import multiprocessing
import timeit
from asyncio import Future
from concurrent.futures.process import ProcessPoolExecutor
from datetime import timedelta

import simplejson

from be.solver import SolverInterface
from be.utils import set_printing, CodeTimer
from experiments.constom_ex_types import ExResult
from experiments.random_graph_gen import graph_generation


def main():
    pool = ProcessPoolExecutor(max_workers=int(multiprocessing.cpu_count() - 2))
    # pool = ProcessPoolExecutor(max_workers=1)
    pages = [{
        'id': "p1",
        'type': 'STACK',
        'constraint': None
    }, {
        'id': "p2",
        'type': 'STACK',
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
    experiments = [
        # (graph_generation.random_planar_gh, 300, [15, 10]),
        (graph_generation.random_planar, 1000, [110]),
        # (graph_generation.spine_graph, 1, list(range(10, 350, 1)))
    ]
    with open("results_random_planar_110.json", mode="a") as f:

        def callback(my_future: Future):
            if not my_future.done() or my_future.cancelled():
                return
            result: ExResult = my_future.result()

            print(simplejson.dumps(result), file=f)

        for graph_gen, number_of_runs, num_node_list in experiments:
            for num_nodes in num_node_list:
                for i in range(number_of_runs):
                    future = pool.submit(do_experiment, base_constraints, graph_gen, i, num_nodes, pages)
                    future.add_done_callback(callback)

        pool.shutdown(wait=True)


def do_experiment(base_constraints, graph_gen, seed, num_nodes, pages):
    with CodeTimer("{} n: {}".format(str(graph_gen.__name__), num_nodes), do_print=True):
        start = timeit.default_timer()
        nodes, edges, graph_str = graph_gen(num_nodes, seed)

        constraints = base_constraints.copy()
        constraints.append(
            {
                "type": "NODES_PREDECESSOR",
                "arguments": ["0"],
                "modifier": nodes[1:],
            })

        solve = SolverInterface.solve(nodes, edges, pages, constraints, 42)
        solving_time = str(timedelta(milliseconds=(timeit.default_timer() - start)) * 1000.0)
        res = ExResult(graph_gen.__name__, len(nodes), len(edges), solve, graph_str, solving_time=solving_time)
    return res


if __name__ == '__main__':
    main()
