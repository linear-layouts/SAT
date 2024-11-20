from typing import NamedTuple, List

from pebble import ProcessFuture

from enum import Enum


class Edge(NamedTuple):
    id: str
    source: str
    target: str
    weight: int # PQ

class PageAssignment(NamedTuple):
    edge: str
    page: str

# DEQUE
class TypeEnum(Enum):
    TAIL = 0
    HEAD = 1
    QUEUE_T_H = 2
    QUEUE_H_T = 3
    
class EdgeType(NamedTuple):
    edge: str
    edge_type: TypeEnum

class SolverResult(NamedTuple):
    satisfiable: bool
    page_assignments: List[PageAssignment]
    vertex_order: List[str]
    deq_edge_type: List[EdgeType]
    Top: List[List[List[str]]]
    Bottom: List[List[List[str]]]
    List_of_Biarc_Pages: List[str]
    solver_output: str
    entity_id: str

class QueueItem(NamedTuple):
    id: str
    future: ProcessFuture
