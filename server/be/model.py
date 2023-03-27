from typing import List
import time
import numpy as np
from flask_restplus import abort
from numpy import ndarray
from be.custom_types import Edge, PageAssignment, EdgeType, TypeEnum
from be.utils import get_duplicates
from numba import jit
import sys

def static_encode_vertex_order(precedes: ndarray) -> List[List[int]]:
    """
    Generates the clauses to ensure that the node order is asymmetric and transitive.
    Test: precedes[u, u] false for DEQUE
    It is static in order to make optimizing more easy

    :param precedes: precedes[i, j] <=> the vertex i precedes vertex j
    :return: the list of generated clauses
    """
    clauses = []
    # Ensure asymmetry
    for u in range(precedes.shape[0]):
        clauses.append([precedes[u, u]]) # needed for Deque
        for v in range(u):
            if u == v:
                continue
            # i precedes j XOR j precedes i
            clauses.append([precedes[u, v], precedes[v, u]])
            clauses.append([-precedes[u, v], -precedes[v, u]])

            # ensure transitivity
            for w in range(precedes.shape[0]):
                if u == v or v == w or w == u:
                    continue
                # (u_precedes_v & j_precedes_w) >> u_precedes_w   simplified => u_precedes_w | ~u_precedes_v | ~v_precedes_w
                clauses.append([precedes[u, w], -precedes[u, v], -precedes[v, w]])

    return clauses


def static_encode_page_assignment(edge_to_page: ndarray) -> List[List[int]]:
    """
    Generates the clauses to assign each edge to at least one page

    :param edge_to_page: edge_to_page[p, e] <=> the edge e is assigned to page p
        """
    clauses = []
    for e in range(edge_to_page.shape[1]):
        # each edge has to be assigned to at least one page
        clauses.append(list(edge_to_page[:, e]))
        # i_on_page_j >> -i_on_page_k
        # at most one page per edge
        for p in range(edge_to_page.shape[0]):
            for q in range(p + 1, edge_to_page.shape[0]):
                clauses.append([-edge_to_page[p, e], -edge_to_page[q, e]])
    return clauses


def static_encode_not_all_in_page(edge_to_page: ndarray, edges: ndarray, p: int) -> List[List[int]]:
    """
    Encodes the constraint that not all given edges go to the same given page.

    :param edge_to_page: the index of the first edge
    :param edges: the given edges
    :param p: the page
    :return: the generated clauses
    """
    clause = []
    for e in edges:
        clause.append(-edge_to_page[p, e])
    return clause


def static_encode_partial_order(precedes, *vertices: List[int]) -> List[List[int]]:
    """
    This method generates clauses to ensure that a given relative order of the given vertices is met.

    :param precedes: precedes[i, j] <=> vertex i precedes vertex j
    :param vertices: A list of vertices, whose relative node order must be met.
    :return: the generated clauses.
    """
    arg_len = len(vertices)
    assert 2 <= arg_len < 7, "Must pass at least two and at most six arguments"
    clauses = [
        precedes[vertices[0], vertices[1]],
        precedes[vertices[1], vertices[2]],
    ]
    if arg_len == 4:
        clauses.append(precedes[vertices[2], vertices[3]])
    if arg_len == 5:
        clauses.append(precedes[vertices[3], vertices[4]])
    if arg_len == 6:
        clauses.append(precedes[vertices[4], vertices[5]])
    return clauses


def static_to_dimacs(clauses: list) -> str:
    """
    This method generates a string in the `DIMACS <http://www.satcompetition.org/2009/format-benchmarks2009.html>`_ format.
    This method is on of the hotspots for large problem instances. It was compared against various other
    implementations. The exact test done are provided in the full documentations and as
    source code comments below this method.

    :param clauses: the clauses to encode
    :param first_line: the header of the generated file
    :return: a string which encodes all given clauses in DIMACS format
    """
    ret_val = ""
    # Code block 'str translate' took: 26281.30907699233 ms
    s = str(clauses)[2:-2].translate(
        str.maketrans({'\n': None, ' ': None, ',': " "})
    ).replace(
        "] [", " 0\n"
    ) + " 0"
    ret_val += s
    return ret_val
    # Now following are the compared algorithms

    # Code block 'join' took: 47857.816228002775 ms
    # Also does this need a huge amount of RAM
    # lines = [' '.join(map(str, c)) + " 0" for c in clauses]
    # s1 = "\n".join(lines)

    # Code block 'str replace' took: 31469.545044004917 ms
    # s = str(clauses).replace(
    #     "\n", "").replace(
    #     " ", "").replace(
    #     "[[", "").replace(
    #     "]]", " 0").replace(
    #     "],[", " 0\n").replace(
    #     ",", " ")


def static_encode_same_page(edge_to_page: ndarray, e1: int, e2: int, e3: int) -> List[List[int]]:
    """
    This method generates the clauses to encode that two edges must be assigned to the same page.
    Because the corresponding CNF formula gets bloated on many pages, this method only handles up to four pages.

    :param e1: the index of the first edge
    :param e2: the index of the second edge
    :param e3: the index of the third edge
    :param edge_to_page: edge_to_page[p, e] <=> edge e is assigned to page p
    :return: the generated clauses
    """
    # to generate the clauses to add
    # print(str(sympy.to_cnf((e1_p1 & e2_p1) | (e1_p2 & e2_p2) | **...** ))
    # .translate(str.maketrans({'&': '\n', ' ': None, '~': "-", "|":",","(":'[',')':']'})))
    clauses = []
    page_number = edge_to_page.shape[0]
    if page_number == 1:
        pass
    elif page_number == 2:
        e1_p1 = edge_to_page[0, e1]
        e2_p1 = edge_to_page[0, e2]
        e1_p2 = edge_to_page[1, e1]
        e2_p2 = edge_to_page[1, e2]

        clauses.append([e1_p1, e1_p2])
        clauses.append([e1_p1, e2_p2])
        clauses.append([e1_p2, e2_p1])
        clauses.append([e2_p1, e2_p2])
        clauses.append([e2_p1, e3_p2])
    elif page_number == 3:
        e1_p1 = edge_to_page[0, e1]
        e2_p1 = edge_to_page[0, e2]
        e1_p2 = edge_to_page[1, e1]
        e2_p2 = edge_to_page[1, e2]
        e1_p3 = edge_to_page[2, e1]
        e2_p3 = edge_to_page[2, e2]

        clauses.append([e1_p1, e1_p2, e1_p3])
        clauses.append([e1_p1, e1_p2, e2_p3])
        clauses.append([e1_p1, e1_p3, e2_p2])
        clauses.append([e1_p1, e2_p2, e2_p3])
        clauses.append([e1_p2, e1_p3, e2_p1])
        clauses.append([e1_p2, e2_p1, e2_p3])
        clauses.append([e1_p3, e2_p1, e2_p2])
        clauses.append([e2_p1, e2_p2, e2_p3])
    elif page_number == 4:
        e1_p1 = edge_to_page[0, e1]
        e2_p1 = edge_to_page[0, e2]
        e1_p2 = edge_to_page[1, e1]
        e2_p2 = edge_to_page[1, e2]
        e3_p2 = edge_to_page[1, e3]
        e1_p3 = edge_to_page[2, e1]
        e2_p3 = edge_to_page[2, e2]
        e1_p4 = edge_to_page[3, e1]
        e2_p4 = edge_to_page[3, e2]

        clauses.append([e1_p1, e1_p2, e1_p3, e1_p4])
        clauses.append([e1_p1, e1_p2, e1_p3, e2_p4])
        clauses.append([e1_p1, e1_p2, e1_p4, e2_p3])
        clauses.append([e1_p1, e1_p2, e2_p3, e2_p4])
        clauses.append([e1_p1, e1_p3, e1_p4, e2_p2])
        clauses.append([e1_p1, e1_p3, e2_p2, e2_p4])
        clauses.append([e1_p1, e1_p4, e2_p2, e2_p3])
        clauses.append([e1_p1, e2_p2, e2_p3, e2_p4])
        clauses.append([e1_p2, e1_p3, e1_p4, e2_p1])
        clauses.append([e1_p2, e1_p3, e2_p1, e2_p4])
        clauses.append([e1_p2, e1_p4, e2_p1, e2_p3])
        clauses.append([e1_p2, e2_p1, e2_p3, e2_p4])
        clauses.append([e1_p3, e1_p4, e2_p1, e2_p2])
        clauses.append([e1_p3, e2_p1, e2_p2, e2_p4])
        clauses.append([e1_p4, e2_p1, e2_p2, e2_p3])
        clauses.append([e2_p1, e2_p2, e2_p3, e2_p4])
    else:
        abort(501, "The constraint EDGES_SAME_PAGES for {} pages it is not implemented".format(page_number))
    return clauses


def static_encode_different_pages(edge_to_page, e1, e2, e3) -> List[List[int]]:
    """
    Encodes different pages for two edges.

    :param e1: the index of the first edge
    :param e2: the index of the second edge
    :param edge_to_page: edge_to_page[p, e] <=> edge e is assigned to page p
    :return: the generated clauses
    """
    clauses = []
    page_number = edge_to_page.shape[0]

    for p in range(page_number):
        clauses.append([-edge_to_page[p, e1], -edge_to_page[p, e2], -edge_to_page[p, e3] ])

    return clauses


def static_encode_absolute_order(precedes, v1, v2) -> List[List[int]]:
    """
    Encodes that two vertices are direct adjacent to each other with v1 being the first of the two.
    In contrast to :func:`~be.model.static_encode_consecutivity` which does not require the intrinsic order.

    :param precedes: precedes[i, j] <=> vertex i precedes vertex j
    :param v1: the index of the first vertex
    :param v2: the index of the second vertex
    :return: the generated clauses
    """
    clauses = []
    for v in range(precedes.shape[0]):
        if v == v1 or v == v2:
            continue
        clauses.append([precedes[v1, v2]])
        clauses.append([precedes[v, v1], precedes[v2, v]])
    return clauses


def static_encode_consecutivity(precedes, v1, v2) -> List[List[int]]:
    """
    Encodes that two vertices are consecutive, i.e., next to each other in any order.
    In contrast to :func:`~be.model.static_encode_node_absolute_order`, here there is no requiring a particular order
    between v1 and v2

    :param precedes: precedes[i, j] <=> vertex i precedes vertex j
    :param v1: the index of the
     vertex
    :param v2: the index of the second vertex
    :return: the generated clauses
        """
    clauses = []
    for v in range(precedes.shape[0]):
        if v == v1 or v == v2:
            continue
        clauses.append([-precedes[v1, v2], precedes[v, v1], precedes[v2, v]])
        clauses.append([precedes[v1, v2], -precedes[v, v1], -precedes[v2, v]])
    return clauses


def static_encode_first_vertex(precedes, v) -> List[List[int]]:
    """
    Encodes that the given vertex is first.

    :param precedes: precedes[i, j] <=> vertex i precedes vertex j
    :param v: the index of the vertex to be the first
        """
    clauses = []
    #print(f'Precedes {precedes}') # TODO: Nikadi de
    for w in range(precedes.shape[0]):
        if w == v:
            continue
        clauses.append([precedes[v, w]])
    #print(f"Clauses {clauses}") # TODO: Nikadi de
    return clauses


def static_encode_last_vertex(precedes, v) -> List[List[int]]:
    """
    Encodes that the given vertex is last.

    :param precedes: precedes[i, j] <=> vertex i precedes vertex j
    :param v: the index of the vertex to be the last
        """
    clauses = []
    for w in range(precedes.shape[0]):
        if w == v:
            continue
        clauses.append([precedes[w, v]])
    #print(f"Clauses {clauses}")  # TODO: Nikadi de
    return clauses


def static_encode_treat_graph_directed(precedes, edges) -> List[List[int]]:
    """
    Encodes that the graph is directed.

    :param precedes: precedes[i, j] <=> vertex i precedes vertex j
    :param edges: np array
        """
    clauses = []

    for edge in edges:
        src = edge[1]
        des = edge[2]
        clauses.append([precedes[src, des]])

    # for w in range(precedes.shape[0]):
    #     if w == v:
    #         continue
    #     clauses.append([precedes[w, v]])
    #print(f"Clauses {clauses}")  # TODO: Nikadi de
    return clauses



def static_encode_stack_page(precedes: ndarray, edge_to_page: ndarray, edges: ndarray, p: int) -> List[List[int]]:
    """
    Encodes a stack page

    :param precedes: precedes[i, j] <=> vertex i precedes vertex j
    :param edge_to_page: edge_to_page[p, e] <=> edge e is assigned to page p
    :param edges: all edges
    :param p: the index of the current page
            """
    clauses = []
    for e in range(edges.shape[0]):
        e1 = edges[e][0]
        e1v1 = edges[e][1]
        e1v2 = edges[e][2]
        for f in range(e):
            e2 = edges[f][0]
            if e1 == e2:
                continue
            e2v1 = edges[f][1]
            e2v2 = edges[f][2]

            duplicates = get_duplicates([e1v1, e1v2, e2v1, e2v2])

            if len(duplicates) > 1:
                # ignore double edges
                continue
                # abort(400,
                #       "Got more than one shared nodes. Multi edges are not allowed. "
                #       "The duplicated nodes where {}".format(duplicates))
            # if the edges share one vertex
            elif len(duplicates) == 1:
                # adjacent edges do not need handling
                continue
            else:
                # forbid alternating patterns
                forbidden_patterns = np.array([
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e1v1, e2v1, e1v2, e2v2),
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e1v1, e2v2, e1v2, e2v1),
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e1v2, e2v1, e1v1, e2v2),
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e1v2, e2v2, e1v1, e2v1),

                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e2v1, e1v1, e2v2, e1v2),
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e2v1, e1v2, e2v2, e1v1),
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e2v2, e1v1, e2v1, e1v2),
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e2v2, e1v2, e2v1, e1v1),
                ])
                clauses.extend((forbidden_patterns * -1).tolist())

    # If the graph is not big, add additional constraint regarding k4s
    if precedes.shape[0] < 300:
        n = precedes.shape[0]
        m = edges.shape[0]
        matrix = [[0 for u in range(n)] for v in range(n)]
        map = [[0 for u in range(n)] for v in range(n)]
        # Create the adjacent matrix
        for e in range(m):
            s = edges[e][1]
            t = edges[e][2]
            matrix[s][t] = 1
            matrix[t][s] = 1
            map[s][t] = e
            map[t][s] = e

        for u in range(n):
            for v in range(u,n):
                for w in range(v,n):
                    for z in range(w,n):
                        if (matrix[u][v] == 1 and matrix[u][w] == 1 and matrix[u][z] == 1 and
                            matrix[v][w] == 1 and matrix[v][z] == 1 and matrix[w][z] == 1):
                            clauses.append(static_encode_not_all_in_page(edge_to_page,
                                                                         np.array([map[u][v], map[u][w], map[u][z],
                                                                          map[v][w], map[v][z], map[w][z]]), p))
    return clauses


def static_encode_queue_page(precedes: ndarray, edge_to_page: ndarray, edges: ndarray, p: int) -> List[List[int]]:
    """
    Encodes the page type queue

    :param precedes: precedes[i, j] <=> vertex i precedes vertex j
    :param edge_to_page: edge_to_page[p, e] <=> edge e is assigned to page p
    :param edges: all edges
    :param p: the index of the current page
    """
    clauses = []
    for e in range(edges.shape[0]):
        e1 = edges[e][0]
        e1v1 = edges[e][1]
        e1v2 = edges[e][2]
        for f in range(e):
            e2 = edges[f][0]
            if e1 == e2:
                continue
            e2v1 = edges[f][1]
            e2v2 = edges[f][2]

            duplicates = get_duplicates([e1v1, e1v2, e2v1, e2v2])

            if len(duplicates) > 1:
                # ignore double edges
                continue
                # abort(400,
                #       "Got more than one shared nodes. Multi edges are not allowed. "
                #       "The duplicated nodes where {}".format(duplicates))
            # if the edges share one vertex
            elif len(duplicates) == 1:
                # adjacent edges do not need handling
                continue
            else:

                # forbid enclosing patterns
                forbidden_patterns = np.array([
                    # e1 encloses e2
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e1v1, e2v1, e2v2, e1v2),
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e1v1, e2v2, e2v1, e1v2),
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e1v2, e2v1, e2v2, e1v1),
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e1v2, e2v2, e2v1, e1v1),

                    # e2 encloses e1
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e2v1, e1v1, e1v2, e2v2),
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e2v1, e1v2, e1v1, e2v2),
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e2v2, e1v1, e1v2, e2v1),
                    [edge_to_page[p, e1], edge_to_page[p, e2]] + static_encode_partial_order(precedes, e2v2, e1v2, e1v1, e2v1),
                ])
                clauses.extend((forbidden_patterns * -1).tolist())
    return clauses

def static_encode_rique_page(precedes: ndarray, edge_to_page: ndarray, edges: ndarray, p: int) -> List[List[int]]:
    """
    Encodes a rique page

    :param precedes: precedes[i, j] <=> vertex i precedes vertex j
    :param edge_to_page: edge_to_page[p, e] <=> edge e is assigned to page p
    :param edges: all edges
    :param p: the index of the current page
            """
    clauses = []
    for e in range(edges.shape[0]):
        e1 = edges[e][0]
        e1v1 = edges[e][1]
        e1v2 = edges[e][2]
        for f in range(e):
            e2 = edges[f][0]
            if e1 == e2:
                continue
            e2v1 = edges[f][1]
            e2v2 = edges[f][2]
            for g in range(f):
                e3 = edges[g][0]
                if e1 == e3 or e2 == e3:
                    continue
                e3v1 = edges[g][1]
                e3v2 = edges[g][2]

                for a1 in (e1v1, e1v2):
                    if a1 == e1v1:
                        a2 = e1v2
                    else:
                        a2 = e1v1
                    for b1 in (e2v1, e2v2):
                        if b1 == e2v1:
                            b2 = e2v2
                        else:
                            b2 = e2v1
                        for c1 in (e3v1, e3v2):
                            if c1 == e3v1:
                                c2 = e3v2
                            else:
                                c2 = e3v1

                            duplicates1 = get_duplicates([a2, b1, c1, b2])
                            duplicates2 = get_duplicates([c2, b1, a1, b2])
                            if len(duplicates1) == 0 and len(duplicates2) == 0:
                                forbidden_patterns = np.array([
                                    [edge_to_page[p, e1], edge_to_page[p, e2], edge_to_page[p, e3], precedes[b2, a2], precedes[b2, c2]] + static_encode_partial_order(precedes, a1, b1, c1, b2),
                                    [edge_to_page[p, e1], edge_to_page[p, e2], edge_to_page[p, e3], precedes[b2, a2], precedes[b2, c2]] + static_encode_partial_order(precedes, c1, b1, a1, b2)
                                ])
                                clauses.extend((forbidden_patterns * -1).tolist())

                            duplicates1 = get_duplicates([a2, c1, b1, c2])
                            duplicates2 = get_duplicates([b2, c1, a1, c2])
                            if len(duplicates1) == 0 and len(duplicates2) == 0:
                                forbidden_patterns = np.array([
                                    [edge_to_page[p, e1], edge_to_page[p, e2], edge_to_page[p, e3], precedes[c2, a2], precedes[c2, b2]] + static_encode_partial_order(precedes, a1, c1, b1, c2),
                                    [edge_to_page[p, e1], edge_to_page[p, e2], edge_to_page[p, e3], precedes[c2, a2], precedes[c2, b2]] + static_encode_partial_order(precedes, b1, c1, a1, c2)
                                ])
                                clauses.extend((forbidden_patterns * -1).tolist())

                            duplicates1 = get_duplicates([b2, a1, c1, a2])
                            duplicates2 = get_duplicates([c2, a1, b1, a2])
                            if len(duplicates1) == 0 and len(duplicates2) == 0:
                                forbidden_patterns = np.array([
                                    [edge_to_page[p, e1], edge_to_page[p, e2], edge_to_page[p, e3], precedes[a2, b2], precedes[a2, c2]] + static_encode_partial_order(precedes, b1, a1, c1, a2),
                                    [edge_to_page[p, e1], edge_to_page[p, e2], edge_to_page[p, e3], precedes[a2, b2], precedes[a2, c2]] + static_encode_partial_order(precedes, c1, a1, b1, a2)
                                ])
                                clauses.extend((forbidden_patterns * -1).tolist())

    return clauses

#@jit(forceobj=True)
def static_encode_deque_types(deq_edge_type: ndarray, p: int, isRique: bool = False, isMonque: bool = False) -> List[List[int]]:
    """
    Generates the clauses to assign each edge to one edge type

    :param deq_edge_type: deq_edge_type[p, type_num, e] <=> edge e is assigned as edge type for page p
    """
    clauses = []
    for e in range(deq_edge_type.shape[2]):
        # each edge has to be assigned to at least one type
        clauses.append(list(deq_edge_type[p, :, e]))
        # at most one type per edge
        for t1 in range(deq_edge_type.shape[1]):
            if isRique: 
                if t1 == TypeEnum.QUEUE_T_H.value:
                    clauses.append([-deq_edge_type[p, t1, e]])
                    continue
                if t1 == TypeEnum.TAIL.value:
                    clauses.append([-deq_edge_type[p, t1, e]])
                    continue
            if isMonque:
                if t1 == TypeEnum.QUEUE_T_H.value:
                    clauses.append([-deq_edge_type[p, t1, e]])
                    continue
            for t2 in range(t1 + 1, deq_edge_type.shape[1]):
                if isRique: 
                    if t2 == TypeEnum.QUEUE_T_H.value:
                        clauses.append([-deq_edge_type[p, t2, e]])
                        continue
                    if t2 == TypeEnum.TAIL.value:
                        clauses.append([-deq_edge_type[p, t2, e]])
                        continue
                if isMonque:
                    if t2 == TypeEnum.QUEUE_T_H.value:
                        clauses.append([-deq_edge_type[p, t2, e]])
                        continue
                clauses.append([-deq_edge_type[p, t1, e], -deq_edge_type[p, t2, e]])
    return clauses

# helper function to make deque page faster
@jit(nopython=True)
def static_encode_deque_constraints_fast(precedes: ndarray, edge_to_page: ndarray, edges: ndarray, p: int, deq_edge_type: ndarray):
    clauses:List[int] = list()
    for e in range(edges.shape[0]):
        e1 = edges[e][0]
        e1v1 = edges[e][1]
        e1v2 = edges[e][2]
        if e1v1 == e1v2:
            continue
        for f in range(edges.shape[0]):
            e2 = edges[f][0]
            if e1 == e2:
                continue
            e2v1 = edges[f][1]
            e2v2 = edges[f][2]
            if e2v1 == e2v2:
                continue
            # adjacent nodes might need handling
            # add clauses if e1 stack edge and e2 queue edge: one node of e2 enclosed
            # enclosed node can't be shared with e1
            # get duplicates e1v1, e1v2, e2v1
            items = np.array([e1v1, e1v2, e2v1])
            s = np.sort(items)
            duplicates = s[:-1][s[1:] == s[:-1]]
            if len(duplicates) == 0:
                forbidden_patterns = np.array([
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.HEAD.value, e1], deq_edge_type[p, TypeEnum.QUEUE_H_T.value, e2], precedes[e1v1, e2v1], precedes[e2v1, e1v2], precedes[e1v2, e2v2]],
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.HEAD.value, e1], deq_edge_type[p, TypeEnum.QUEUE_H_T.value, e2], precedes[e1v2, e2v1], precedes[e2v1, e1v1], precedes[e1v1, e2v2]],

                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.HEAD.value, e1], deq_edge_type[p, TypeEnum.QUEUE_T_H.value, e2], precedes[e2v2, e1v1], precedes[e1v1, e2v1], precedes[e2v1, e1v2]],
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.HEAD.value, e1], deq_edge_type[p, TypeEnum.QUEUE_T_H.value, e2], precedes[e2v2, e1v2], precedes[e1v2, e2v1], precedes[e2v1, e1v1]],

                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.TAIL.value, e1], deq_edge_type[p, TypeEnum.QUEUE_T_H.value, e2], precedes[e1v1, e2v1], precedes[e2v1, e1v2], precedes[e1v2, e2v2]],
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.TAIL.value, e1], deq_edge_type[p, TypeEnum.QUEUE_T_H.value, e2], precedes[e1v2, e2v1], precedes[e2v1, e1v1], precedes[e1v1, e2v2]],

                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.TAIL.value, e1], deq_edge_type[p, TypeEnum.QUEUE_H_T.value, e2], precedes[e2v2, e1v1], precedes[e1v1, e2v1], precedes[e2v1, e1v2]],
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.TAIL.value, e1], deq_edge_type[p, TypeEnum.QUEUE_H_T.value, e2], precedes[e2v2, e1v2], precedes[e1v2, e2v1], precedes[e2v1, e1v1]]
                ])
                clauses.extend(list((map(list, forbidden_patterns*-1))))
            # get duplicates e1v1, e1v2, e2v2
            items = np.array([e1v1, e1v2, e2v2])
            s = np.sort(items)
            duplicates = s[:-1][s[1:] == s[:-1]]
            if len(duplicates) == 0:
                forbidden_patterns = np.array([
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.HEAD.value, e1], deq_edge_type[p, TypeEnum.QUEUE_H_T.value, e2], precedes[e1v1, e2v2], precedes[e2v2, e1v2], precedes[e1v2, e2v1]],
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.HEAD.value, e1], deq_edge_type[p, TypeEnum.QUEUE_H_T.value, e2], precedes[e1v2, e2v2], precedes[e2v2, e1v1], precedes[e1v1, e2v1]],

                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.HEAD.value, e1], deq_edge_type[p, TypeEnum.QUEUE_T_H.value, e2], precedes[e2v1, e1v1], precedes[e1v1, e2v2], precedes[e2v2, e1v2]],
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.HEAD.value, e1], deq_edge_type[p, TypeEnum.QUEUE_T_H.value, e2], precedes[e2v1, e1v2], precedes[e1v2, e2v2], precedes[e2v2, e1v1]],

                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.TAIL.value, e1], deq_edge_type[p, TypeEnum.QUEUE_T_H.value, e2], precedes[e1v1, e2v2], precedes[e2v2, e1v2], precedes[e1v2, e2v1]],
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.TAIL.value, e1], deq_edge_type[p, TypeEnum.QUEUE_T_H.value, e2], precedes[e1v2, e2v2], precedes[e2v2, e1v1], precedes[e1v1, e2v1]],

                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.TAIL.value, e1], deq_edge_type[p, TypeEnum.QUEUE_H_T.value, e2], precedes[e2v1, e1v1], precedes[e1v1, e2v2], precedes[e2v2, e1v2]],
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, TypeEnum.TAIL.value, e1], deq_edge_type[p, TypeEnum.QUEUE_H_T.value, e2], precedes[e2v1, e1v2], precedes[e1v2, e2v2], precedes[e2v2, e1v1]]
                    ])
                clauses.extend(list((map(list, forbidden_patterns*-1))))
            # add clauses if e1 stack edge and e2 queue edge: both nodes of e2 enclosed
            # inserted at same side -> first nodes cant be the same
            for type_num1 in [TypeEnum.HEAD.value, TypeEnum.TAIL.value]:
                type_num2 = None
                if type_num1 == TypeEnum.HEAD.value:
                    type_num2 = TypeEnum.QUEUE_H_T.value
                else:
                    type_num2 = TypeEnum.QUEUE_T_H.value
                if e1v1 != e2v1:
                    forbidden_patterns = np.array([
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v1, e2v1], precedes[e2v1, e2v2], precedes[e2v2, e1v2]]
                    ])
                    clauses.extend(list((map(list, forbidden_patterns*-1))))
                if e1v1 != e2v2:
                    forbidden_patterns = np.array([
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v1, e2v2], precedes[e2v2, e2v1], precedes[e2v1, e1v2]]
                    ])
                    clauses.extend(list((map(list, forbidden_patterns*-1))))
                if e1v2 != e2v1:
                    forbidden_patterns = np.array([
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v2, e2v1], precedes[e2v1, e2v2], precedes[e2v2, e1v1]]
                    ])
                    clauses.extend(list((map(list, forbidden_patterns*-1))))
                if e1v2 != e2v2:
                    forbidden_patterns = np.array([
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v2, e2v2], precedes[e2v2, e2v1], precedes[e2v1, e1v1]]
                    ])
                    clauses.extend(list((map(list, forbidden_patterns*-1))))
            # inserted at different sides -> last nodes cant be the same
            for type_num1 in [TypeEnum.HEAD.value, TypeEnum.TAIL.value]:
                type_num2 = None
                if type_num1 == TypeEnum.HEAD.value:
                    type_num2 = TypeEnum.QUEUE_T_H.value
                else:
                    type_num2 = TypeEnum.QUEUE_H_T.value
                if e1v1 != e2v1:
                    forbidden_patterns = np.array([
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v2, e2v2], precedes[e2v2, e2v1], precedes[e2v1, e1v1]]
                    ])
                    clauses.extend(list((map(list, forbidden_patterns*-1))))
                if e1v1 != e2v2:
                    forbidden_patterns = np.array([
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v2, e2v1], precedes[e2v1, e2v2], precedes[e2v2, e1v1]]
                    ])
                    clauses.extend(list((map(list, forbidden_patterns*-1))))
                if e1v2 != e2v1:
                    forbidden_patterns = np.array([
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v1, e2v2], precedes[e2v2, e2v1], precedes[e2v1, e1v2]]
                    ])
                    clauses.extend(list((map(list, forbidden_patterns*-1))))
                if e1v2 != e2v2:
                    forbidden_patterns = np.array([
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v1, e2v1], precedes[e2v1, e2v2], precedes[e2v2, e1v2]]
                    ])
                    clauses.extend(list((map(list, forbidden_patterns*-1))))
            # add clauses if e1 and e2 queue edges: different directions, one node of e2 enclosed
            for type_num1 in [TypeEnum.QUEUE_H_T.value, TypeEnum.QUEUE_T_H.value]:
                type_num2 = None
                if type_num1 == TypeEnum.QUEUE_H_T.value:
                    type_num2 = TypeEnum.QUEUE_T_H.value
                else:
                    type_num2 = TypeEnum.QUEUE_H_T.value
                # enclosed node must be different from node on the same side (tail, head)
                if e2v1 != e1v1:
                    forbidden_patterns = np.array([
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v2, e2v1], precedes[e2v1, e1v1], precedes[e1v1, e2v2]]
                    ])
                    clauses.extend(list((map(list, forbidden_patterns*-1))))
                if e2v1 != e1v2:
                    forbidden_patterns = np.array([
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v1, e2v1], precedes[e2v1, e1v2], precedes[e1v2, e2v2]]
                    ])
                    clauses.extend(list((map(list, forbidden_patterns*-1))))
                if e2v2 != e1v1:
                    forbidden_patterns = np.array([
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v2, e2v2], precedes[e2v2, e1v1], precedes[e1v1, e2v1]]
                    ])
                    clauses.extend(list((map(list, forbidden_patterns*-1))))
                if e2v2 != e1v2:
                    forbidden_patterns = np.array([
                        [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v1, e2v2], precedes[e2v2, e1v2], precedes[e1v2, e2v1]]
                    ])
                    clauses.extend(list((map(list, forbidden_patterns*-1))))
            # add clauses if e1 and e2 queue edges: different direction, both nodes of e2 enclosed
            for type_num1 in [TypeEnum.QUEUE_H_T.value, TypeEnum.QUEUE_T_H.value]:
                type_num2 = None
                if type_num1 == TypeEnum.QUEUE_H_T.value:
                    type_num2 = TypeEnum.QUEUE_T_H.value
                else:
                    type_num2 = TypeEnum.QUEUE_H_T.value
                forbidden_patterns = np.array([
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v1, e2v1], precedes[e2v1, e2v2], precedes[e2v2, e1v2]],
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v1, e2v2], precedes[e2v2, e2v1], precedes[e2v1, e1v2]],
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v2, e2v1], precedes[e2v1, e2v2], precedes[e2v2, e1v1]],
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num1, e1], deq_edge_type[p, type_num2, e2], precedes[e1v2, e2v2], precedes[e2v2, e2v1], precedes[e2v1, e1v1]]
                ])
                clauses.extend(list((map(list, forbidden_patterns*-1))))
            # adjacent nodes do not need handling
            # get duplicates e1v1, e1v2, e2v1, e2v2
            items = np.array([e1v1, e1v2, e2v1, e2v2])
            s = np.sort(items)
            duplicates = s[:-1][s[1:] == s[:-1]]
            if len(duplicates) > 0:
                continue
            # add stack clauses if both tail or head edges
            for type_num in [TypeEnum.TAIL.value, TypeEnum.HEAD.value]:
                forbidden_patterns = np.array([
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num, e1], deq_edge_type[p, type_num, e2], precedes[e1v1, e2v1], precedes[e2v1, e1v2], precedes[e1v2, e2v2]],
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num, e1], deq_edge_type[p, type_num, e2], precedes[e1v1, e2v2], precedes[e2v2, e1v2], precedes[e1v2, e2v1]],
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num, e1], deq_edge_type[p, type_num, e2], precedes[e1v2, e2v1], precedes[e2v1, e1v1], precedes[e1v1, e2v2]],
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num, e1], deq_edge_type[p, type_num, e2], precedes[e1v2, e2v2], precedes[e2v2, e1v1], precedes[e1v1, e2v1]]
                ])
                clauses.extend(list((map(list, forbidden_patterns*-1))))
            # add clauses if e1 and e2 queue edges: same direction, both nodes of e2 enclosed
            for type_num in [TypeEnum.QUEUE_H_T.value, TypeEnum.QUEUE_T_H.value]:
                forbidden_patterns = np.array([
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num, e1], deq_edge_type[p, type_num, e2], precedes[e1v1, e2v1], precedes[e2v1, e2v2], precedes[e2v2, e1v2]],
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num, e1], deq_edge_type[p, type_num, e2], precedes[e1v1, e2v2], precedes[e2v2, e2v1], precedes[e2v1, e1v2]],
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num, e1], deq_edge_type[p, type_num, e2], precedes[e1v2, e2v1], precedes[e2v1, e2v2], precedes[e2v2, e1v1]],
                    [edge_to_page[p, e1], edge_to_page[p, e2], deq_edge_type[p, type_num, e1], deq_edge_type[p, type_num, e2], precedes[e1v2, e2v2], precedes[e2v2, e2v1], precedes[e2v1, e1v1]]
                ])
                clauses.extend(list((map(list, forbidden_patterns*-1))))
    return clauses

def static_encode_deque_page(precedes: ndarray, edge_to_page: ndarray, edges: ndarray, p: int, deq_edge_type: ndarray) -> List[List[int]]:
    """
    Encodes a deque page

    :param precedes: precedes[i, j] <=> vertex i precedes vertex j
    :param edge_to_page: edge_to_page[p, e] <=> edge e is assigned to page p
    :param edges: all edges
    :param p: the index of the current page
    :param deq_edge_type: deq_edge_type[p, type_num, e] <=> edge e is assigned as edge type for page p
    """
    print("Adding constraints for deque page")
    start_time = time.time()
    clauses = static_encode_deque_constraints_fast(precedes, edge_to_page, edges, p, deq_edge_type)
    print("--- %s seconds ---" % (time.time() - start_time))
    return clauses

class SatModel(object):
    """
    This class is responsible for generating the clauses corresponding to the given Problem instance.
    """

    def __init__(self, pages, edges: Edge, vertices: List[int], constraints):
        """
        Initializes the model with the given params. Also does some basic validation.

        :param pages: the pages
        :param edges: the edges
        :param vertices: the vertices
        :param constraints: the constraints
        """

        self.result = {}
        self.pages = pages
        self.edges = edges
        self.vertices = vertices
        self.constraints = constraints
        self.clauses = []
        self.temp_dimacs_str = ""
        self.clausenum = 0

        # Check for dublicates in ids.
        if len(get_duplicates(vertices)) > 0:
            abort(400, "Vertex ids have to be unique. The id(s) {} occurred multiple times".format(get_duplicates(vertices)))

        if len(get_duplicates([e.id for e in edges])) > 0:
            abort(400, "Edge ids have to be unique. The id(s) {} occurred multiple times".format(get_duplicates([e.id for e in edges])))

        if len(get_duplicates([p['id'] for p in pages])) > 0:
            abort(400, "Page ids have to be unique. The id(s) {} occurred multiple times".format(get_duplicates([p['id'] for p in pages])))

        n = len(vertices)
        self._node_idxs = list(range(n))
        self._node_idx_to_id = {i: n_id for i, n_id in enumerate(vertices)}
        self._node_id_to_idx = {n_id: i for i, n_id in enumerate(vertices)}

        page_number = len(pages)
        self._page_idxs = list(range(page_number))
        self._page_idx_to_id = {i: p['id'] for i, p in enumerate(pages)}
        self._page_id_to_idx = {p['id']: i for i, p in enumerate(pages)}

        m = len(edges)
        self._edge_idxs = list(range(m))
        self._edge_idx_to_id = {i: e.id for i, e in enumerate(edges)}
        self._edge_id_to_idx = {e.id: i for i, e in enumerate(edges)}

        # enumerates all constraints from one on. zero is excluded because its delimiter meaning in dimacs format
        self.max_var = 0

        # self._precedes[i,j] <=> vertex i precedes vertex j
        self._precedes = self._create_variables(n * n).reshape((n, n))

        # self._edges_to_pages[e,p] <=> edge e is assigned to page p
        self._edge_to_page = self._create_variables(page_number * m).reshape((page_number, m))

        # DEQUE: tail (0), head (1), tail to head (2) or head to tail (3)
        # self._deq_edge_type[p, type_num, e] <=> edge e is assigned as edge type for page p
        self._deq_edge_type = self._create_variables(page_number * len(TypeEnum) * m).reshape((page_number, len(TypeEnum), m))

    def _create_variables(self, number: int = 1) -> ndarray:
        assert number >= 1, "cannot create less than 1 new variables"
        new_vars = np.arange(self.max_var + 1, self.max_var + 1 + number)
        self.max_var = np.max(new_vars)
        return new_vars

    def add_relative_order_clauses(self):
        """
        Ensures that asymmetry and transitivity are encoded.

        """
        self._add_clauses(static_encode_vertex_order(self._precedes))

    def add_page_assignment_clauses(self):
        """
        Ensures that each edge is assigned to least one page.

        """
        self._add_clauses(static_encode_page_assignment(self._edge_to_page))

    def get_vertex_order_result(self) -> List[str]:
        """
        Reads the result and translates it back into the computed order of vertices.

        :return: the order of the vertices
        """
        if not self.result or not np.size(self.result['precedes']) > 0:
            raise Exception("Please set the result first")
        ordered = np.argsort(self.result['precedes'].sum(axis=1))[::-1]

        order = []
        for v in ordered:
            order.append(self._node_idx_to_id[v])
        assert len(order) == len(self.vertices), \
            "Not all nodes from >{}< are present in the ordered dict >{}<".format(self.vertices, ordered)
        return order

    def get_assignment_result(self) -> List[List]:
        
        if not self.result or not np.size(self.result['edge_to_page']):
            raise Exception("Please set the result first")
        if not self.result or not np.size(self.result['deq_edge_type']):
            raise Exception("Please set the result first")

        # get the indexes of the page assignment variables which evaluated to True
        as_idxs_page = np.argwhere(self.result['edge_to_page'])
        # get the indexes of the edge type variables which evaluated to True
        as_idxs_type = np.argwhere(self.result['deq_edge_type'])

        # Create a PageAssignment for each True variable and translate the index beck to the given id
        ret_val_page = []
        ret_val_type = []
        for idx in as_idxs_page:
            edge_id = self._edge_idx_to_id[idx[1]]
            page_id = self._page_idx_to_id[idx[0]]
            # only make type assignment to edges that are assigned to a page
            for idx_type in as_idxs_type:
                if page_id == self._page_idx_to_id[idx_type[0]] and edge_id == self._edge_idx_to_id[idx_type[2]]:
                    edge_type = TypeEnum(idx_type[1]).name
                    ret_val_type.append(EdgeType(edge=edge_id, edge_type=edge_type))
            ret_val_page.append(PageAssignment(edge=edge_id, page=page_id))
        return [ret_val_page, ret_val_type]

    def add_page_constraints(self):
        """
        Generates the clauses to encode the page type as well as additional page constraints like DISPERSIBLE or TREE.
        """
        edges = np.array([
            [self._edge_id_to_idx[e.id],
             self._node_id_to_idx[e.source],
             self._node_id_to_idx[e.target]] for
            e in self.edges])
        edge_to_page = self._edge_to_page
        precedes = self._precedes
        deq_edge_type = self._deq_edge_type
        for page in self.pages:
            p = self._page_id_to_idx[page['id']]
            self._add_clauses(self._add_additional_page_constraint(edge_to_page, edges, page.get('constraint', "NONE"), p))

            if page['type'] == 'STACK':
                self._add_clauses(static_encode_stack_page(precedes, edge_to_page, edges, p))
            elif page['type'] == 'QUEUE':
                self._add_clauses(static_encode_queue_page(precedes, edge_to_page, edges, p))
            elif page['type'] == 'RIQUE':
                # ensures that each edge is assigned to exactly one type
                self._add_clauses(static_encode_deque_types(deq_edge_type, p, True))
                # adds page clauses
                self._add_clauses(static_encode_deque_page(precedes, edge_to_page, edges, p, deq_edge_type))
                # add constraints to string (safe RAM)  
                self.to_temp_dimacs_str()
                # the following implementation is by adopting the forbidden pattern
                # self._add_clauses(static_encode_rique_page(precedes, edge_to_page, edges, p))
            elif page['type'] == 'DEQUE':
                # ensures that each edge is assigned to exactly one type
                self._add_clauses(static_encode_deque_types(deq_edge_type, p))
                # adds page clauses
                self._add_clauses(static_encode_deque_page(precedes, edge_to_page, edges, p, deq_edge_type))
                # add constraints to string (safe RAM)                
                self.to_temp_dimacs_str()
            elif page['type'] == "MONQUE":
                # ensures that each edge is assigned to exactly one type
                self._add_clauses(static_encode_deque_types(deq_edge_type, p, False, True))
                # adds page clauses
                self._add_clauses(static_encode_deque_page(precedes, edge_to_page, edges, p, deq_edge_type))
                # add constraints to string (safe RAM)  
                self.to_temp_dimacs_str()
            elif page['type'] == 'NONE':
                continue
            else:
                abort(501, "Page type {} is currently not implemented".format(page['type']))

    def __get_incident_edges(self, node_tag, directed_edges=False):
        incident_edges = set()
        if directed_edges:
            for e in self.edges:
                if e.target == node_tag:
                    incident_edges.add(e.id)
        else:
            for e in self.edges:
                if e.source == node_tag or e.target == node_tag:
                    incident_edges.add(e.id)
        return incident_edges

    def add_additional_constraints(self):
        """
        Adds the clauses to encode the given additional constraints.
        """

        if not self.constraints:
            return
        for constraint in self.constraints:
            clauses = []
            arguments = constraint['arguments']
            modifier = constraint.get('modifier')

            if constraint['type'] == 'EDGES_ON_PAGES_INCIDENT_NODE':
                if not modifier:
                    abort(400, "EDGES_ON_PAGES_INCIDENT_NODE constraints need the modifier set")
                node_tag = arguments[0]
                incident_edges = list(self.__get_incident_edges(node_tag))
                for e in incident_edges:
                    clause = []
                    for p in constraint['modifier']:
                        clause.append(self._edge_to_page[self._page_id_to_idx[p], self._edge_id_to_idx[e]])
                    clauses.append(clause)
            elif constraint['type'] == 'EDGES_ON_PAGES':
                if not modifier:
                    abort(400, "EDGES_ON_PAGES constraints need the modifier set")
                for e in arguments:
                    clause = []
                    for p in constraint['modifier']:
                        clause.append(self._edge_to_page[self._page_id_to_idx[p], self._edge_id_to_idx[e]])
                    clauses.append(clause)

            elif constraint['type'] == 'EDGES_SAME_PAGES_INCIDENT_NODE':
                node_tag = arguments[0]
                incident_edges = self.__get_incident_edges(node_tag)

                e_idxs = [self._edge_id_to_idx[e_id] for e_id in incident_edges]
                for e in range(len(e_idxs)):
                    if e == 0:
                        continue
                    clauses.extend(static_encode_same_page(self._edge_to_page, e_idxs[e - 1], e_idxs[e]))

            elif constraint['type'] == 'EDGES_DIFFERENT_PAGES_INCIDENT_NODE':
                node_tag = arguments[0]
                incident_edges = list(self.__get_incident_edges(node_tag))
                for e, ignore1 in enumerate(incident_edges):
                    for f in range(e):
                        if e == f:
                            continue
                        clauses.extend(static_encode_different_pages(self._edge_to_page,
                                                                     self._edge_id_to_idx[incident_edges[e]],
                                                                     self._edge_id_to_idx[incident_edges[f]]))

            elif constraint['type'] == 'EDGES_SAME_PAGES':
                e_idxs = [self._edge_id_to_idx[e_id] for e_id in arguments]

                for e in range(len(e_idxs)):
                    if e == 0:
                        continue
                    clauses.extend(static_encode_same_page(self._edge_to_page, e_idxs[e - 1], e_idxs[e]))

            elif constraint['type'] == 'EDGES_DIFFERENT_PAGES':
                for e, ignore1 in enumerate(arguments):
                    for f in range(e):
                        if e == f:
                            continue
                        clauses.extend(static_encode_different_pages(self._edge_to_page,
                                                                     self._edge_id_to_idx[arguments[e]],
                                                                     self._edge_id_to_idx[arguments[f]]))

            elif constraint['type'] == 'NOT_ALL_IN_SAME_PAGE':
                page_number = self._edge_to_page.shape[0]
                edges = [self._edge_id_to_idx[e_id] for e_id in arguments]
                for p in range(page_number):
                    clauses.append(static_encode_not_all_in_page(self._edge_to_page, edges, p))

            elif constraint['type'] == 'EDGES_TO_SUB_ARC_ON_PAGES':
                if len(arguments) != 2:
                    abort(400, "The EDGES_TO_SUB_ARC_ON_PAGES constraint only allows exactly two arguments")

                if not modifier or not len(modifier) >= 1:
                    abort(400, "The EDGES_TO_SUB_ARC_ON_PAGES constraint requires at least one modifiers.")
                s_idx = self._node_id_to_idx[arguments[0]]
                t_idx = self._node_id_to_idx[arguments[1]]
                clauses = []
                for e in self.edges:
                    node_set = {e.target, e.source, arguments[0], arguments[1]}
                    if len(node_set) == 3:
                        nodes = node_set
                        nodes.remove(arguments[0])
                        nodes.remove(arguments[1])
                        v = list(nodes)[0]
                        v_idx = self._node_id_to_idx[v]
                        e = self._edge_id_to_idx[e.id]
                        clause = [-self._precedes[s_idx, v_idx],
                                  -self._precedes[v_idx, t_idx]]

                        for p in modifier:
                            p = self._page_id_to_idx[p]
                            clause.append(self._edge_to_page[p, e])

                        clauses.append(clause)
                    else:
                        continue

            elif constraint['type'] == 'EDGES_FROM_NODES_ON_PAGES':
                if not len(arguments) >= 1:
                    abort(400, "The EDGES_FROM_NODES_ON_PAGES constraint requires at least on vertex")

                if not modifier or not len(modifier) >= 1:
                    abort(400, "The EDGES_FROM_NODES_ON_PAGES constraint requires at least on page")
                p_idxs = [self._page_id_to_idx[p_id] for p_id in modifier]
                clauses = []
                for e in self.edges:
                    if e.target in arguments or e.source in arguments:
                        clause = []
                        e = self._edge_id_to_idx[e.id]
                        for p in p_idxs:
                            clause.append(self._edge_to_page[p, e])
                        clauses.append(clause)
                    else:
                        continue

            elif constraint['type'] == 'NODES_PREDECESSOR':
                if not modifier:
                    abort(400, "NODES_PREDECESSOR constraints need the modifier set")
                for first in arguments:
                    for second in constraint['modifier']:
                        if first == second:
                            abort(400,
                                  "The key '{}' is in arguments and modifier which is not allowed".format(first))
                        clauses.append([self._precedes[self._node_id_to_idx[first], self._node_id_to_idx[second]]])

            elif constraint['type'] == 'NODES_ABSOLUTE_ORDER' or constraint['type'] == 'NODES_REQUIRE_ABSOLUTE_ORDER':
                for e in range(len(arguments)):
                    if e == 0:
                        continue
                    clauses.extend(static_encode_absolute_order(self._precedes,
                                                                self._node_id_to_idx[arguments[e - 1]],
                                                                self._node_id_to_idx[arguments[e]]))

            elif constraint['type'] == 'NODES_FORBID_PARTIAL_ORDER':
                clause = []
                for e in range(len(arguments)):
                    if e == 0:
                        continue
                    clause.append(-self._precedes[self._node_id_to_idx[arguments[e - 1]],
                                                  self._node_id_to_idx[arguments[e]]])
                clauses.append(clause)

            elif constraint['type'] == 'NODES_REQUIRE_PARTIAL_ORDER':
                for e in range(len(arguments)):
                    if e == 0:
                        continue
                    clauses.append([self._precedes[self._node_id_to_idx[arguments[e - 1]],
                                                   self._node_id_to_idx[arguments[e]]]])

            elif constraint['type'] == 'NODES_CONSECUTIVE':
                if len(arguments) != 2:
                    abort(400, "The NODES_CONSECUTIVE constraint only allows exactly two arguments")
                clauses.extend(static_encode_consecutivity(self._precedes,
                                                           self._node_id_to_idx[arguments[0]],
                                                           self._node_id_to_idx[arguments[1]]))

            elif constraint['type'] == 'NODES_SET_FIRST':
                if len(arguments) != 1:
                    abort(400, "The NODES_SET_FIRST constraint only allows exactly one argument")
                clauses.extend(static_encode_first_vertex(self._precedes, self._node_id_to_idx[arguments[0]]))

            elif constraint['type'] == 'NODES_SET_LAST':
                if len(arguments) != 1:
                    abort(400, "The NODES_SET_LAST constraint only allows exactly one argument")
                clauses.extend(static_encode_last_vertex(self._precedes, self._node_id_to_idx[arguments[0]]))
                # clauses.extend(static_encode_last_vertex(self._precedes, self._node_id_to_idx[arguments[0]]))

            elif constraint['type'] == 'TREAT_GRAPH_DIRECTED':
                edges = np.array([
                    [self._edge_id_to_idx[e.id],
                     self._node_id_to_idx[e.source],
                     self._node_id_to_idx[e.target]] for
                    e in self.edges])
                clauses.extend(static_encode_treat_graph_directed(self._precedes, edges))
                # clauses.extend(static_encode_last_vertex(self._precedes, self._node_id_to_idx[arguments[0]]))

            else:
                raise abort(500, "The given constraint {} is not implemented yet".format(constraint['type']))
            self._add_clauses(clauses)
        pass

    def _add_clauses(self, clauses):
        self.clauses.extend(clauses)

    def to_dimacs_str(self):
        """
        generates a string in `DIMACS <http://www.satcompetition.org/2009/format-benchmarks2009.html>`_ format
        encoding all the clauses. Out to conserve memory, the clauses will be deleted after the string generation.
        """
        clauses = self.clauses
        last_str = ""
        if(len(clauses) > 0):
            self.clausenum += len(clauses)
            last_str += static_to_dimacs(clauses)
        first_line = "p cnf {} {}\n".format(np.max(self.max_var), self.clausenum)
        res_str = first_line + self.temp_dimacs_str + "\n" + last_str
        # remove the references in order to free memory
        self.clauses = None
        return res_str

    def to_temp_dimacs_str(self):
        """
        generates a string before all clauses are finished, to safe RAM
        """
        clauses = self.clauses
        self.clausenum = self.clausenum + len(clauses)
        res_str = static_to_dimacs(clauses)
        # remove the references in order to free memory
        self.clauses = []
        self.temp_dimacs_str = self.temp_dimacs_str + "\n" + res_str

    def parse_lingeling_result(self, dimacs_string):
        """
        Takes the result string from lingeling and parses it back into the model.

        :param dimacs_string: the result string from lingeling

        """
        result = {}

        lines = dimacs_string.split('\n')
        important_lines = [l for l in lines if not l.startswith('c') and l]
        comment_lines = [l for l in lines if l.startswith('c') and l]
        result['full'] = "\n".join(comment_lines)

        s_marker = [str(l).rsplit(' ') for l in important_lines if l.startswith('s')][0][1:]

        if s_marker[0] == "SATISFIABLE":
            result['satisfiable'] = True
            v_markers = []
            for l in important_lines:
                if l.startswith('v'):
                    splits = str(l).rsplit(' ')
                    splits_without_leading_v = splits[1:]
                    v_markers.extend(splits_without_leading_v)
            if "0" in v_markers:
                v_markers.remove("0")
            assert len(v_markers) == self.max_var, "Could not parse the expected number of variables from the " \
                                                   "lingeling result. Expected {} got {}".format(self.max_var,
                                                                                                 len(v_markers))
            vars = np.array(list(map(int, v_markers)))
            sorted_idx = np.argsort(np.abs(vars))
            vars = vars[sorted_idx]

            # in the result format the positive variable number is used to indicate True and the negative for false
            # the > 0 evaluates to true for all true variables in the result.
            result['precedes'] = vars[
                                   :np.size(self._precedes)].reshape(self._precedes.shape) > 0
            result['edge_to_page'] = vars[
                                        np.size(self._precedes):np.size(self._precedes) + np.size(
                                            self._edge_to_page)].reshape(
                self._edge_to_page.shape) > 0
            result['deq_edge_type'] = vars[
                                        np.size(self._precedes) + np.size(
                                            self._edge_to_page):np.size(self._precedes) + np.size(
                                            self._edge_to_page) + np.size(
                                            self._deq_edge_type)].reshape(
                self._deq_edge_type.shape) > 0
            pass

        else:
            result['satisfiable'] = False

        self.result = result

        return result

    def _add_additional_page_constraint(self, edge_to_page: ndarray, edges: ndarray, constraint: str, p: int):
        """
        This method generates the clauses to encode additional page constraints like dispensable or tree.

        :param edge_to_page: all edge to page variables
        :param edges: all edges
        :param constraint: the constraint for this page
        :param p: the index of the current page
        :return: the generated clauses
        """

        clauses = []
        if constraint == 'NONE' or constraint is None:
            pass
        elif constraint == 'DISPERSIBLE':
            for i in range(edges.shape[0]):
                e1 = edges[i]
                e1_idx = e1[0]
                e1n1 = e1[1]
                e1n2 = e1[2]
                e1_page_var = edge_to_page[p, e1_idx]
                for j in range(i):
                    e2 = edges[j]
                    if e1[0] == e2[0]:
                        continue
                    e2_idx = e2[0]
                    e2_page_var = edge_to_page[p, e2_idx]
                    e2n1 = e2[1]
                    e2n2 = e2[2]

                    duplicates = get_duplicates([e1n1, e1n2, e2n1, e2n2])
                    len_duplicates = len(duplicates)
                    if len_duplicates == 1:
                        clauses.append([-e1_page_var, -e2_page_var])
                    if len_duplicates > 1:
                        continue
                    else:
                        continue
        elif constraint == 'FOREST':
            node_len = len(self.vertices)
            parents = self._create_variables(node_len ** 2).reshape((node_len, node_len))
            ancestors = self._create_variables(node_len ** 2).reshape((node_len, node_len))
            self._add_forrest_constraints(ancestors, edge_to_page, clauses, edges, p, parents)

        elif constraint == 'TREE':
            node_len = len(self.vertices)
            parents = self._create_variables(node_len ** 2).reshape((node_len, node_len))
            ancestors = self._create_variables(node_len ** 2).reshape((node_len, node_len))
            is_root = self._create_variables(node_len).reshape((node_len,))
            self._add_forrest_constraints(ancestors, edge_to_page, clauses, edges, p, parents)

            for i in range(parents.shape[0]):
                parents_of_i: List[int] = list(parents[:, i])
                parents_of_i.remove(parents[i, i])
                # if there is a parent to i, it is not root
                for parent in parents_of_i:
                    clauses.append([-parent, -is_root[i]])

                # no_parents and at least one child implies is_root
                parents_of_i.append(is_root[i])
                for child in list(parents[i, :]):
                    tmp = parents_of_i.copy()
                    tmp.append(-child)
                    clauses.append(tmp)

            # single root
            for i in range(is_root.shape[0]):
                for j in range(i):
                    clauses.append([-is_root[i], -is_root[j]])

        else:
            abort(501, "The page constraint {} is not implemented yet".format(constraint))
        return clauses

    @staticmethod
    def _add_forrest_constraints(ancestors, edge_to_page, clauses, edges, p, parents):
        """
        A helper method to encode a forest constraint for the given page.
        :param ancestors:
        :param edge_to_page:
        :param clauses:
        :param edges:
        :param p:
        :param parents:
                """
        for i in range(edges.shape[0]):
            e1 = edges[i]
            e1_idx = e1[0]
            e1n1 = e1[1]
            e1n2 = e1[2]
            edge_on_page = edge_to_page[p, e1_idx]
            n1_is_parent_of_n2 = parents[e1n1, e1n2]
            n2_is_parent_of_n1 = parents[e1n2, e1n1]

            # either n1 or n2 is the parent of the other one
            # sympy.to_cnf(edge_on_page >> (n1_is_parent_of_n2 ^ n2_is_parent_of_n1))
            clauses.append([-edge_on_page, n1_is_parent_of_n2, n2_is_parent_of_n1])
            clauses.append([-edge_on_page, -n1_is_parent_of_n2, -n2_is_parent_of_n1])

            # no one is parent if the edge is not on this page
            # sympy.to_cnf(~edge_on_page >> (~n1_is_parent_of_n2 & ~n2_is_parent_of_n1))
            clauses.append([edge_on_page, -n1_is_parent_of_n2])
            clauses.append([edge_on_page, -n2_is_parent_of_n1])
        # make sure every unused parent var is false and take away the dont care variable from the solver
        used_ids = {np.abs(item) for sublist in clauses for item in sublist}
        for i in range(parents.shape[0]):
            for j in range(parents.shape[0]):
                if parents[j, i] not in used_ids:
                    clauses.append([-parents[j, i]])
        # at most one parent for each vertex
        for i in range(parents.shape[0]):
            parents_of_i = parents[:, i]
            for j in range(len(parents_of_i)):
                if j == i:
                    continue
                for k in range(j):
                    if k == i or j == k:
                        continue
                    clauses.append([-parents[j, i], -parents[k, i]])
        # every vertex is not its own parent
        for i in range(parents.shape[0]):
            clauses.append([-parents[i, i]])
        # if i is parent of j then i is also ancestor of j
        for i in range(parents.shape[0]):
            for j in range(parents.shape[0]):
                clauses.append([-parents[j, i], ancestors[j, i]])
        for i in range(ancestors.shape[0]):
            clauses.append([-ancestors[i, i]])
            for j in range(ancestors.shape[0]):
                if i == j:
                    continue
                # one of both relations have to be false
                clauses.append([-ancestors[i, j], -ancestors[j, i]])

                # ensure transitivity
                for k in range(ancestors.shape[0]):
                    if i == j or j == k or k == i:
                        continue
                    # (i_anc_of_j & j_anc_of_k) >> i_anc_of_k
                    clauses.append([-ancestors[i, j], -parents[j, k], ancestors[i, k]])