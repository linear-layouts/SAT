import datetime
from typing import NamedTuple, Dict, List

from be.custom_types import SolverResult


class ExResult(NamedTuple):
    graph_type: str
    node_number: int
    edge_number: int
    solver_result: SolverResult
    graph_str: str
    pages: List[Dict]
    constraints: List[Dict]
    version: str = "3"
    date: str = str(datetime.datetime.now())
    solving_time: str = "0"
